import { appendFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Bus } from "./events.ts";
import type { Job } from "./jobs.ts";
import { checkLimits } from "./job-limits.ts";
import { type Machine, sshAsync } from "./job-machine.ts";
import { capFields, recordedJob } from "./job-record.ts";
import { type Caps, launch, type Slice } from "./job-scope.ts";
import { GRACE_SECONDS } from "./job-stop.ts";
import { current, field, ID, inRun, moveJob, told, write } from "./job-state.ts";
import { takeLock } from "./lock.ts";
import { launched, syncMachine } from "./machine-sync.ts";
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

// The pids of job `id`'s wrappers, told by their command line `.../wrapper.ts <home> <id> <agent>` (`launch`, job-scope.ts),
// also before one wrote its `pid` (a continue killed meanwhile left that moment) and not a process that took its pid since.
export function wrappers(id: string, table = processTable()): string[] {
	return table.filter(({ args }) => args.includes(` ${id} `, args.indexOf("/wrapper.ts ") + 1) && args.includes("/wrapper.ts ")).map((entry) => String(entry.pid));
}

// Returns the line `arthur stop` prints once the job's run is over.
export async function stopJob(home: string, id: string): Promise<string> {
	const { field } = record(home, id);
	const now = current(home, id);
	if (!inRun(now)) throw new Error(`${id} is ${told(now)}, not in a run; nothing to stop`);
	const pid = field("pid");
	if (!wrappers(id).includes(pid)) throw new Error(`${id}: its wrapper ${pid} is gone though its state says ${now.state}; nothing to stop`);
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
// taken before the state is read and released here only when the continue fails; else the new wrapper removes it. A job on
// another machine (`there`) is checked here, then continued there by `arthur remote-job continue`, which refuses it as here.
// `check` runs the `beforeSpawn` checks and holds the spawn lock (spawn-check.ts) until the job is `working` again, and answers
// the caps in force now (`jobs.limits`), which replace the record's before the launch; `prepare` runs the prepares told it is a
// continue, their variables going to the wrapper here, else on the stdin of `remote-job continue` as at a spawn, never into the
// record; `uncapped` hears why a job with caps runs bare here (job-scope.ts).
export async function continueJob(home: string, id: string, instruction: string, budgetUsd: number | undefined, agent: string, slice: Slice, bus: Bus, uncapped: (why: string) => void, steps: { readonly check: (job: Job) => Promise<{ readonly release: () => void; readonly caps: Caps }>; readonly prepare: (job: Job) => Promise<Readonly<Record<string, string>>> }, there?: Machine): Promise<string | undefined> {
	const { folder, field } = record(home, id);
	if (instruction.trim() === "") throw new Error("the instruction is empty");
	const lock = takeLock(join(folder, "continuing"));
	if ("heldBy" in lock) throw new Error(`${id}: being continued`);
	let [failed, release] = ["refused" as string | undefined, () => {}];
	try {
		const recorded = recordedJob(id, field);
		const { kind, project, branch, worktree, tickets, machine } = recorded;
		const now = current(home, id);
		if (inRun(now)) throw new Error(`${id} is ${told(now)}, in a run; a job in a run is not continued, arthur steer gives it a correction`);
		if (branch === undefined) throw new Error(`${id} is a ${kind}, a read-only kind without a branch of its own; only a job with a branch is continued`);
		if (worktree === "" || (there === undefined && !existsSync(worktree))) throw new Error(`${id}: its worktree was pruned; spawn a new job on its branch ${branch}`);
		checkLimits("continue", { budgetUsd });
		const asked = { ...recorded, budgetUsd: budgetUsd ?? recorded.budgetUsd };
		const passed = await steps.check(asked);
		release = passed.release;
		const job = { ...asked, cpu: passed.caps.cpu, memory: passed.caps.memory, feature: passed.caps.feature };
		const env = await steps.prepare(job);
		const budget = budgetUsd === undefined ? [] : [String(budgetUsd)];
		// A new scope of the job's name cannot start while a wrapper of the job still runs in it, and two wrappers never run for a
		// job: one that runs on past the grace refuses the continue. Its `pid` goes, so `launch` waits for the new one's.
		for (const end = Date.now() + GRACE_SECONDS * 1000; there === undefined; await sleep(50)) {
			const running = wrappers(id);
			if (running.length === 0) break;
			if (Date.now() > end) throw new Error(`${id}: its wrapper ${running.join(", ")} still runs ${GRACE_SECONDS} seconds on; a second one is not started beside it`);
		}
		const startedThere = there && launched(home, there, await sshAsync(there, ["arthur", "remote-job", "continue", there.home, id, agent, slice.slice, JSON.stringify(passed.caps), ...budget], JSON.stringify({ instruction: instruction.trim(), env })), bus);
		if (budgetUsd !== undefined) write(folder, "budget", String(budgetUsd));
		for (const [name, text] of Object.entries(capFields(passed.caps))) write(folder, name, text);
		if (there === undefined) {
			rmSync(join(folder, "pid"), { force: true });
			write(folder, "continue", instruction.trim());
			appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] arthur continue: ${instruction.trim().split("\n")[0]}\n`);
		}
		moveJob(home, id, bus, () => ["working", ""]);
		release();
		bus.emit("core", "job-started", { id, kind, project, root: job.root, branch, worktree, tickets, machine });
		failed = there === undefined ? await launch(home, job, agent, slice, bus, uncapped, env) : startedThere;
		// The wrapper there did not start: its end, here at once.
		if (there !== undefined && failed !== undefined) syncMachine(home, there, bus);
		return failed;
	} finally {
		release();
		// A wrapper there removes the lock there, not this one.
		if (failed !== undefined || there !== undefined) lock.release();
	}
}
