import { appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Bus } from "./events.ts";
import { gitOver, type Machine, ssh, url } from "./job-machine.ts";
import { sayUncapped, UNCAPPED } from "./job-scope.ts";
import { current, field, inRun, jobIds, moveJob, type State, write } from "./job-state.ts";

// The sweep's copy of the records of jobs on another machine (spec/roadmap.md, entries 21 and 22), and what a machine that
// does not answer does to them: docs/commands/spawn.md, "On another machine".

// What `arthur remote-job records` answers per job: the state read first, then each file changed since the time asked, the
// `log` from the byte asked (`logFrom`, 0 when the log there is shorter) of its `logSize` bytes, and `at`, the newest
// modification time there, which the next copy asks from.
export type Copy = {
	readonly state: string;
	readonly reason: string;
	readonly since: string;
	readonly at: number;
	readonly logFrom: number;
	readonly logSize: number;
	readonly files: Readonly<Record<string, string>>;
};

// Files a copy never overwrites: the repository is the main checkout here; the state moves through `moveJob`.
const OWN = ["root", "machine", "state", "reason", "since"];
const OFFLINE = "failed: machine offline";

// The jobs of `machine` a copy follows: those in a run, and those its going offline held or failed, the record's `offline`
// naming when it was first found unreachable, until their state there arrives.
function followed(home: string, machine: Machine): string[] {
	return jobIds(home).filter((id) => field(home, id)("machine") === machine.name && (inRun(current(home, id)) || field(home, id)("offline") !== ""));
}

// The sweep's copy from each of `machines` at `at`; one that does not answer (ssh's exit 255) holds its jobs, any other failure
// is named once every machine was tried.
export function syncMachines(home: string, machines: readonly Machine[], bus: Bus, at: Date, graceMinutes: number): void {
	const failed: string[] = [];
	for (const machine of machines) {
		try {
			syncMachine(home, machine, bus);
		} catch (error) {
			if (error instanceof Error && error.cause === 255) unreachable(home, machine, bus, at, graceMinutes);
			else failed.push(error instanceof Error ? error.message : String(error));
		}
	}
	if (failed.length > 0) throw new Error(failed.join("\n"));
}

// With one SSH call, copies the changed files of the records of `machine`'s followed jobs, of the log only its new bytes; a
// run that ended there brings its branch into the job's `root` before its state moves here, then `job-ended`. A job failed
// here while the machine was offline takes the state there only once that run ended.
export function syncMachine(home: string, machine: Machine, bus: Bus): void {
	const ids = followed(home, machine);
	if (ids.length === 0) return;
	const asked = ids.map((id) => `${id}=${field(home, id)("synced") || "0:0"}`);
	const answer = JSON.parse(ssh(machine, ["arthur", "remote-job", "records", machine.home, ...asked])) as Record<string, Copy>;
	for (const id of ids) {
		const copy = answer[id];
		if (copy === undefined) continue;
		const [folder, read] = [join(home, "jobs", id), field(home, id)];
		const { log, ...files } = copy.files;
		for (const [name, text] of Object.entries(files)) if (!OWN.includes(name) && read(name) !== text) write(folder, name, text);
		if (log !== undefined && copy.logFrom > 0) appendFileSync(join(folder, "log"), log);
		else if (log !== undefined) write(folder, "log", log);
		write(folder, "synced", `${copy.at}:${copy.logSize}`);
		const ended = copy.state !== "working" && copy.state !== "idle";
		if (read("state") === "ended" && !ended) continue;
		const branch = read("branch");
		if (ended && branch !== "") gitOver(read("root"), ["fetch", "--quiet", url(machine, read("project")), `+refs/heads/${branch}:refs/heads/${branch}`]);
		// A plugin's hold here stands while the run goes on there, and ends with it, as the wrapper's does.
		moveJob(home, id, bus, (now) => {
			if (now.hold !== "" && !ended) return ["blocked", `dependency: ${now.hold}`];
			rmSync(join(folder, "hold"), { force: true });
			return [copy.state as State, copy.reason];
		}, new Date(copy.since));
		rmSync(join(folder, "offline"), { force: true });
		if (ended) bus.emit("core", "job-ended", { id, kind: read("kind"), project: read("project"), state: copy.state, reason: copy.reason });
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

// Starts the job's wrapper there in its own scope of the slice `slice`, whose limit is the machine's own; returns why it did
// not start, which ended the job there and, by a copy at once, here.
export function launchThere(home: string, machine: Machine, id: string, agent: string, slice: string, bus: Bus): string | undefined {
	const failed = launched(home, machine, ssh(machine, ["arthur", "remote-job", "launch", machine.home, id, agent, slice]), bus);
	if (failed !== undefined) syncMachine(home, machine, bus);
	return failed;
}

// What `arthur remote-job launch` or `continue` printed: a line `uncapped: <why>` is told here once per machine, the rest is
// why the wrapper did not start, nothing once it started.
export function launched(home: string, machine: Machine, printed: string, bus: Bus): string | undefined {
	const lines = printed.trim().split("\n");
	for (const line of lines) if (line.startsWith(UNCAPPED)) sayUncapped(home, machine.name, line.slice(UNCAPPED.length), bus);
	return lines.filter((line) => !line.startsWith(UNCAPPED)).join("\n").trim() || undefined;
}
