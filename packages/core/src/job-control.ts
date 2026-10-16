import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { checkLimits } from "./job-limits.ts";
import { launch, type Slice } from "./job-scope.ts";
import { GRACE_SECONDS } from "./job-stop.ts";
import { processTable } from "./process-table.ts";
import { queueSteer } from "./steer-inbox.ts";

// Stop, steer and continue a job (spec/roadmap.md, entry 14), from its record `<home>/jobs/<id>/`. `arthur stop` asks the
// job's wrapper (SIGTERM to it), which runs the one stop (job-stop.ts) and writes the end; `arthur steer` queues a
// correction the agent gets after its next tool call (steer-inbox.ts); `arthur continue` starts the wrapper again in place.

// `<date>-<kind>-<8 hex digits>`, as the spawn makes it: nothing else names a folder in `<home>/jobs/`.
const ID = /^\d{4}-\d\d-\d\d-[a-z][a-z0-9]*(-[a-z0-9]+)*-[0-9a-f]{8}$/;
// How long `arthur stop` waits for the wrapper to write the end: the grace, the SIGKILL, the scope.
const STOP_WAIT_SECONDS = GRACE_SECONDS + 10;

// The job's record folder and a reader of its files, undefined for a missing one; refused for an id that names no job.
function record(home: string, id: string): { readonly folder: string; readonly field: (name: string) => string | undefined } {
	const folder = join(home, "jobs", id);
	if (!ID.test(id) || !existsSync(join(folder, "kind"))) throw new Error(`${id}: no such job in ${join(home, "jobs")}`);
	return { folder, field: (name) => (existsSync(join(folder, name)) ? readFileSync(join(folder, name), "utf8") : undefined) };
}

// Whether `pid` is still the wrapper of job `id`, not a process that took its pid after it ended.
function wrapperRuns(pid: string | undefined, id: string): boolean {
	return processTable().some((entry) => String(entry.pid) === pid && entry.args.includes("wrapper.ts") && entry.args.includes(id));
}

// Returns the line `arthur stop` prints once the job's state is final.
export async function stopJob(home: string, id: string): Promise<string> {
	const { field } = record(home, id);
	const state = field("state");
	if (state !== "running") throw new Error(`${id} is ${state ?? "not started yet"}, not running; nothing to stop`);
	const pid = field("pid");
	if (!wrapperRuns(pid, id)) throw new Error(`${id}: its wrapper ${pid} is gone though its state says running; nothing to stop`);
	process.kill(Number(pid), "SIGTERM");
	for (const end = Date.now() + STOP_WAIT_SECONDS * 1000; field("state") === "running"; await sleep(50))
		if (Date.now() > end) throw new Error(`${id}: its wrapper ${pid} did not end the job within ${STOP_WAIT_SECONDS} seconds of SIGTERM`);
	const final = field("state");
	return final === "stopped" ? `${id}: stopped` : `${id}: ended ${final} before the stop`;
}

// Returns the steer's number.
export function steerJob(home: string, id: string, text: string): string {
	const { folder, field } = record(home, id);
	if (text.trim() === "") throw new Error("the text is empty");
	const state = field("state");
	if (state !== "running") throw new Error(`${id} is ${state ?? "not started yet"}, not running; a steer reaches only a running job, and arthur continue resumes an ended worker`);
	try {
		return queueSteer(join(folder, "steer"), field("pid") ?? "", text.trim());
	} catch (error) {
		throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}; arthur continue ${id} with it`);
	}
}

// Resumes an ended job with a branch of its own in place: its wrapper starts again on the same record, worktree and branch,
// and the agent continues its last session there with `instruction`. `budgetUsd` replaces the budget, since the cost of the
// runs before counts on; the timeout counts from the new start. `agent` and `slice` are the spawn's.
export async function continueJob(home: string, id: string, instruction: string, budgetUsd: number | undefined, agent: string, slice: Slice): Promise<void> {
	const { folder, field } = record(home, id);
	if (instruction.trim() === "") throw new Error("the instruction is empty");
	const state = field("state");
	if (state === undefined || state === "running") throw new Error(`${id} is ${state ?? "not started yet"}; a running job is not continued, arthur steer gives it a correction`);
	if (field("branch") === "") throw new Error(`${id} is a ${field("kind")}, a read-only kind without a branch of its own; only a job with a branch is continued`);
	checkLimits("continue", { budgetUsd });
	// A new scope of the job's name cannot start while the old wrapper still runs in it.
	for (const end = Date.now() + GRACE_SECONDS * 1000; Date.now() < end && wrapperRuns(field("pid"), id); ) await sleep(50);
	if (budgetUsd !== undefined) write(folder, "budget", String(budgetUsd));
	write(folder, "continue", instruction.trim());
	appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] arthur continue: ${instruction.trim().split("\n")[0]}\n`);
	launch(home, id, agent, slice);
}

function write(folder: string, name: string, text: string): void {
	writeFileSync(join(folder, `.${name}`), text);
	renameSync(join(folder, `.${name}`), join(folder, name));
}
