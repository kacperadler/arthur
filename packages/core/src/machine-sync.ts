import { appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Bus } from "./events.ts";
import { gitOver, type Machine, ssh, sshAsync, url } from "./job-machine.ts";
import { capFields } from "./job-record.ts";
import { sayUncapped, UNCAPPED } from "./job-scope.ts";
import { current, field, inRun, jobIds, kept, moveJob, type State, write } from "./job-state.ts";

// The sweep's copy of the records of jobs on another machine (spec/roadmap.md, entries 21 and 22), and what a machine that
// does not answer does to them: docs/commands/spawn.md, "On another machine".

// What `arthur remote-job records` answers per job: the state read first, then each file changed since the time asked, the
// `log` from the byte asked (`logFrom`, 0 when the log there is shorter) of its `logSize` bytes up to `logTo`, where the next
// copy asks from, and `at`, the newest modification time there, which the next copy asks from.
export type Copy = {
	readonly state: string;
	readonly reason: string;
	readonly since: string;
	readonly at: number;
	readonly logFrom: number;
	readonly logSize: number;
	readonly logTo: number;
	readonly files: Readonly<Record<string, string>>;
};

// The files a copy brings besides `log`: the run's there, the wrapper's and those `remote-job continue` writes (as `continueJob` here); never the spawn's.
const RUN = ["pid", "active", "cost", "tool-calls", "activity", "result", "commits", "budget", "continue", ...Object.keys(capFields({}))];
const OFFLINE = "failed: machine offline";
// The copy's limits: past either, the machine counts as not answering. `records` sends 256 KiB of log per job at most.
const [COPY_SECONDS, COPY_CHARS] = [20, 64 * 1024 * 1024];

// The jobs of `machine` a copy follows: those in a run, and those its going offline held or failed, the record's `offline`
// naming when it was first found unreachable, until their state there arrives.
function followed(home: string, machine: Machine): string[] {
	return jobIds(home).filter((id) => field(home, id)("machine") === machine.name && (inRun(current(home, id)) || field(home, id)("offline") !== ""));
}

// The sweep's copy from each of `machines` at `at`, all at once; one that does not answer (ssh's exit 255, or no answer within
// COPY_SECONDS or COPY_CHARS) holds its jobs, any other failure is named once every machine was tried.
export async function syncMachines(home: string, machines: readonly Machine[], bus: Bus, at: Date, graceMinutes: number): Promise<void> {
	const failed = (await Promise.all(machines.map((machine) => syncMachine(home, machine, bus).then(() => "", (error: Error) => (error.cause === 255 ? (unreachable(home, machine, bus, at, graceMinutes), "") : error.message))))).filter(Boolean);
	if (failed.length > 0) throw new Error(failed.join("\n"));
}

// With one SSH call, copies the run's changed files of the records of `machine`'s followed jobs, of the log only its new bytes; a
// run that ended there brings its branch into the job's `root` before its state moves here, then `job-ended`. A job failed
// here while the machine was offline takes the state there only once that run ended; a log cut short, once the rest arrived.
export async function syncMachine(home: string, machine: Machine, bus: Bus): Promise<void> {
	const ids = followed(home, machine);
	if (ids.length === 0) return;
	const asked = ids.map((id) => `${id}=${field(home, id)("synced") || "0:0"}`);
	const answer = JSON.parse(await sshAsync(machine, ["arthur", "remote-job", "records", machine.home, ...asked], "", COPY_SECONDS, COPY_CHARS)) as Record<string, Copy>;
	// Before anything of the answer is written, each file's name is a record key (it decides the path written here), and a branch is the job's own or none.
	for (const id of ids) for (const name of Object.keys(answer[id]?.files ?? {})) if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`machine ${machine.name}: job ${id} sent a record file ${JSON.stringify(name)}; expected a name of lowercase letters, digits and dashes`);
	for (const [id, branch] of ids.map((id) => [id, field(home, id)("branch")])) if (branch !== "" && branch !== `arthur/${id}`) throw new Error(`machine ${machine.name}: job ${id} names the branch ${JSON.stringify(branch)} in its record here; expected arthur/${id} or none`);
	for (const [index, id] of ids.entries()) {
		const [copy, folder, read] = [answer[id], join(home, "jobs", id), field(home, id)];
		// Another copy (a stop's beside the sweep's) that wrote since this one asked has these bytes in already.
		if (copy === undefined || asked[index] !== `${id}=${read("synced") || "0:0"}`) continue;
		for (const [name, text] of Object.entries(copy.files)) if (RUN.includes(name) && read(name) !== text) write(folder, name, text);
		if (copy.files.log !== undefined && copy.logFrom > 0) appendFileSync(join(folder, "log"), copy.files.log);
		else if (copy.files.log !== undefined) write(folder, "log", copy.files.log);
		write(folder, "synced", `${copy.at}:${copy.logTo}`);
		if (copy.logTo < copy.logSize) continue;
		const ended = copy.state !== "working" && copy.state !== "idle";
		if (read("state") === "ended" && !ended) continue;
		if (ended && read("branch") !== "") gitOver(read("root"), ["fetch", "--quiet", url(machine, read("project")), `+refs/heads/arthur/${id}:refs/heads/arthur/${id}`]);
		// A plugin's hold here stands while the run goes on there, and ends with it, as the wrapper's does, unless it stopped the run.
		let [state, reason] = [copy.state, copy.reason];
		moveJob(home, id, bus, (now) => {
			if (now.hold !== "" && !ended) return ["blocked", kept(now) ?? `dependency: ${now.hold}`];
			rmSync(join(folder, "hold"), { force: true });
			[state, reason] = kept(now) === undefined ? [state, reason] : ["blocked", now.reason];
			return [state as State, reason];
		}, new Date(copy.since));
		rmSync(join(folder, "offline"), { force: true });
		if (ended) bus.emit("core", "job-ended", { id, kind: read("kind"), project: read("project"), state, reason });
	}
}

// `machine` did not answer at `at`: each followed job is `blocked` on it from the first sweep that found it so, and ended
// `failed: machine offline` once that is `graceMinutes` ago, with one line in its log and `job-ended`; its record and
// worktree there stay, and its state there arrives once the machine answers.
function unreachable(home: string, machine: Machine, bus: Bus, at: Date, graceMinutes: number): void {
	for (const id of followed(home, machine)) {
		const [folder, read] = [join(home, "jobs", id), field(home, id)];
		if (read("offline") === "") write(folder, "offline", at.toISOString());
		const reason = `machine ${machine.name} unreachable since ${read("offline")}`;
		const late = at.getTime() - Date.parse(read("offline")) >= graceMinutes * 60_000;
		const moved = moveJob(home, id, bus, (now) => {
			if (now.state === "ended") return undefined;
			if (!late) return ["blocked", `dependency: ${reason}`];
			rmSync(join(folder, "hold"), { force: true });
			appendFileSync(join(folder, "log"), `[arthur ${at.toISOString()}] ended: ${OFFLINE}: ${reason}, past core.jobs.offlineGraceMinutes (${graceMinutes})\n`);
			return ["ended", OFFLINE];
		}, at);
		if (moved && late) bus.emit("core", "job-ended", { id, kind: read("kind"), project: read("project"), state: "ended", reason: OFFLINE });
	}
}

// Starts the job's wrapper there in its own scope of the slice `slice`, whose limit is the machine's own, with the variables
// `env` the prepares returned, sent on stdin; returns why it did not start, which ended the job there and, by a copy at once, here.
export async function launchThere(home: string, machine: Machine, id: string, agent: string, slice: string, bus: Bus, env: Readonly<Record<string, string>> = {}): Promise<string | undefined> {
	const failed = launched(home, machine, ssh(machine, ["arthur", "remote-job", "launch", machine.home, id, agent, slice], JSON.stringify(env)), bus);
	if (failed !== undefined) await syncMachine(home, machine, bus);
	return failed;
}

// What `arthur remote-job launch` or `continue` printed: a line `uncapped: <why>` is told here once per machine, the rest is
// why the wrapper did not start, nothing once it started.
export function launched(home: string, machine: Machine, printed: string, bus: Bus): string | undefined {
	const lines = printed.trim().split("\n");
	for (const line of lines) if (line.startsWith(UNCAPPED)) sayUncapped(home, machine.name, line.slice(UNCAPPED.length), bus);
	return lines.filter((line) => !line.startsWith(UNCAPPED)).join("\n").trim() || undefined;
}
