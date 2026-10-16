import { appendFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { taskTickets } from "./board-jobs.ts";
import type { Bus } from "./events.ts";
import type { Spawn } from "./jobs.ts";
import { checkLimits } from "./job-limits.ts";
import { launch, type Slice } from "./job-scope.ts";
import { GRACE_SECONDS } from "./job-stop.ts";
import { current, field, ID, inRun, moveJob, told, write } from "./job-state.ts";
import { takeLock } from "./lock.ts";
import { processTable } from "./process-table.ts";
import { queueSteer } from "./steer-inbox.ts";

// Stop, steer and continue a job from its record `<home>/jobs/<id>/`: docs/commands/stop.md, steer.md and continue.md.

// How long `arthur stop` waits for the wrapper to write the end: the grace, the SIGKILL, the scope.
const STOP_WAIT_SECONDS = GRACE_SECONDS + 10;

// The job's record folder and a reader of its files; refused for an id that names no job.
function record(home: string, id: string): { readonly folder: string; readonly field: (name: string) => string } {
	const folder = join(home, "jobs", id);
	if (!ID.test(id) || !existsSync(join(folder, "kind"))) throw new Error(`${id}: no such job in ${join(home, "jobs")}`);
	return { folder, field: field(home, id) };
}

// Whether `pid` is still the wrapper of job `id`, not a process that took its pid after it ended.
export function wrapperRuns(pid: string, id: string, table = processTable()): boolean {
	return table.some((entry) => String(entry.pid) === pid && entry.args.includes("wrapper.ts") && entry.args.includes(id));
}

// Returns the line `arthur stop` prints once the job's run is over.
export async function stopJob(home: string, id: string): Promise<string> {
	const { field } = record(home, id);
	const now = current(home, id);
	if (!inRun(now)) throw new Error(`${id} is ${told(now)}, not in a run; nothing to stop`);
	const pid = field("pid");
	if (!wrapperRuns(pid, id)) throw new Error(`${id}: its wrapper ${pid} is gone though its state says ${now.state}; nothing to stop`);
	process.kill(Number(pid), "SIGTERM");
	for (const end = Date.now() + STOP_WAIT_SECONDS * 1000; inRun(current(home, id)); await sleep(50))
		if (Date.now() > end) throw new Error(`${id}: its wrapper ${pid} did not end the job within ${STOP_WAIT_SECONDS} seconds of SIGTERM`);
	const final = current(home, id);
	return final.reason === "stopped" ? `${id}: stopped` : `${id}: ${told(final)} before the stop`;
}

// Returns the steer's number.
export function steerJob(home: string, id: string, text: string): string {
	const { folder, field } = record(home, id);
	if (text.trim() === "") throw new Error("the text is empty");
	const now = current(home, id);
	if (!inRun(now)) throw new Error(`${id} is ${told(now)}, not in a run; a steer reaches only a job in a run, and arthur continue resumes an ended or blocked worker`);
	try {
		return queueSteer(join(folder, "steer"), field("pid"), text.trim());
	} catch (error) {
		throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}; arthur continue ${id} with it`);
	}
}

// `arthur continue` (docs/commands/continue.md): returns why the wrapper did not start, or undefined. Its lock `continuing` is
// taken before the state is read and released here only when the continue fails; else the new wrapper removes it.
export async function continueJob(home: string, id: string, instruction: string, budgetUsd: number | undefined, agent: string, slice: Slice, bus: Bus, check: (spawn: Omit<Spawn, "tickets">) => Promise<void>): Promise<string | undefined> {
	const { folder, field } = record(home, id);
	if (instruction.trim() === "") throw new Error("the instruction is empty");
	const lock = takeLock(join(folder, "continuing"));
	if ("heldBy" in lock) throw new Error(`${id}: being continued`);
	let failed: string | undefined = "refused";
	try {
		const [task = "", kind = "", project = "", root, branch, worktree, model, thinking] = ["task", "kind", "project", "root", "branch", "worktree", "model", "thinking"].map((name) => field(name) || undefined);
		const now = current(home, id);
		if (inRun(now)) throw new Error(`${id} is ${told(now)}, in a run; a job in a run is not continued, arthur steer gives it a correction`);
		if (branch === undefined) throw new Error(`${id} is a ${kind}, a read-only kind without a branch of its own; only a job with a branch is continued`);
		if (worktree === undefined || !existsSync(worktree)) throw new Error(`${id}: its worktree was pruned; spawn a new job on its branch ${branch}`);
		checkLimits("continue", { budgetUsd });
		const machine = field("machine") || "local";
		await check({ task, kind, project, model, thinking, machine, timeoutMinutes: Number(field("timeout")), budgetUsd: budgetUsd ?? Number(field("budget")) });
		// A new scope of the job's name cannot start while the old wrapper still runs in it; its `pid` goes, so `launch` waits for the new one's.
		for (const end = Date.now() + GRACE_SECONDS * 1000; Date.now() < end && wrapperRuns(field("pid"), id); ) await sleep(50);
		rmSync(join(folder, "pid"), { force: true });
		if (budgetUsd !== undefined) write(folder, "budget", String(budgetUsd));
		write(folder, "continue", instruction.trim());
		appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] arthur continue: ${instruction.trim().split("\n")[0]}\n`);
		moveJob(home, id, bus, () => ["working", ""]);
		bus.emit("core", "job-started", { id, kind, project, root, branch, worktree, tickets: taskTickets(task), machine });
		failed = await launch(home, { id, kind, project }, agent, slice, bus);
		return failed;
	} finally {
		if (failed !== undefined) lock.release();
	}
}
