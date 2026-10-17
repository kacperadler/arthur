import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { FEATURE, taskTickets } from "./board-jobs.ts";
import type { Clock } from "./clock.ts";
import type { Bus } from "./events.ts";
import { steerJob, stopJob, wrapperRuns } from "./job-control.ts";
import { type Machine, ssh, sshAsync } from "./job-machine.ts";
import { blockJob, current, field, ID, inRun, jobIds, moveJob, STATES, told, unblockJob } from "./job-state.ts";
import { syncMachine } from "./machine-sync.ts";
import { processTable } from "./process-table.ts";

// Every project's job records `<home>/jobs/<id>/`: docs/commands/jobs.md, prune.md and stopall.md.

// An ended job as a plugin's `jobs.keep` gets it; `branch` is empty for a read-only kind.
export type FinishedJob = { readonly [key in "id" | "kind" | "project" | "task" | "state" | "reason" | "branch" | "worktree"]: string };
// A job as `host.jobs.list()` gives it, in any state; `tickets` are the paths its task names on `Ticket:`, `hold` empty unless held.
export type JobRecord = { readonly [key in "id" | "kind" | "project" | "state" | "reason" | "hold" | "branch"]: string } & { readonly tickets: readonly string[] };

// The full id of the one job `query` names; refused when none or several match, naming them.
export function findJob(home: string, query: string): string {
	const found = jobIds(home).filter((id) => id === query || id.endsWith(`-${query}`));
	if (found.length === 1) return found[0] ?? "";
	if (found.length === 0) throw new Error(`${query}: no such job in ${join(home, "jobs")}`);
	throw new Error(`${query} matches ${found.length} jobs: ${found.join(", ")}; name one by its full id`);
}

// `sweep` ends a working or idle job whose wrapper and agent are both gone, on this sweep and the one before. `there` is the
// machine of a job on another one, where `stop`, `steer` and `prune` run through `arthur remote-job` (spec/roadmap.md, entry
// 22); a machine that does not answer refuses them, naming it.
export function jobUpkeep(home: string, time: Clock, bus: Bus, keep: (job: FinishedJob) => readonly unknown[], there: (id: string) => Machine | undefined) {
	let gone = new Set<string>();
	const stop = async (id: string): Promise<string> => {
		const machine = there(id);
		if (machine === undefined) return stopJob(home, id);
		const line = (await sshAsync(machine, ["arthur", "remote-job", "stop", machine.home, id])).trim();
		// Its end there, here at once.
		syncMachine(home, machine, bus);
		return line;
	};
	const records = (): JobRecord[] =>
		jobIds(home).map((id) => {
			const read = field(home, id);
			return { id, kind: read("kind"), project: read("project"), ...current(home, id), branch: read("branch"), tickets: taskTickets(read("task")) };
		});
	const running = (): string[] => records().filter(inRun).map((job) => job.id);
	return {
		list: (state?: string) => jobsText(home, time, state),
		block: (id: string, reason: string) => blockJob(home, id, reason, bus, time.now()),
		unblock: (id: string) => unblockJob(home, id, bus, time.now()),
		stop,
		// Returns the steer's number.
		steer(id: string, text: string): string {
			const machine = there(id);
			return machine === undefined ? steerJob(home, id, text) : ssh(machine, ["arthur", "remote-job", "steer", machine.home, id], text).trim();
		},
		// `"all"` frees every finished job; an empty list is refused, never read as everything.
		prune(ids: readonly string[] | "all") {
			if (ids.length === 0) throw new Error('prune needs one or more ids, or "all" for every finished job');
			// Every id is found first, so a typo refuses the prune before anything is removed.
			const all = ids === "all" ? jobIds(home) : [...new Set(ids.map((query) => findJob(home, query)))];
			return all.length === 0 ? ["no jobs"] : all.map((id) => `${id}: ${prune(home, id, keep, there)}`);
		},
		records,
		running,
		async stopAll() {
			const ids = running();
			bus.emit("core", "stop-all", { ids });
			if (ids.length === 0) return "no running jobs";
			return (await Promise.all(ids.map((id) => stop(id).catch((error: Error) => error.message)))).join("\n");
		},
		sweep() {
			const table = processTable();
			const seen = new Set<string>();
			for (const id of jobIds(home)) {
				const read = field(home, id);
				const [pid, folder] = [read("pid"), join(home, "jobs", id)];
				// The agent's command line names the record's prompt.
				const alive = wrapperRuns(pid, id, table) || table.some(({ args }) => args.includes(join(folder, "prompt")));
				// A job on another machine is copied from there (job-machine.ts), not swept here.
				if (!["working", "idle"].includes(read("state")) || alive || !["", "local"].includes(read("machine"))) continue;
				seen.add(id);
				if (!gone.has(id)) continue;
				const reason = "failed: process gone";
				const moved = moveJob(home, id, bus, (now) => {
					if (!["working", "idle"].includes(now.state)) return undefined;
					appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] ended: ${reason}: its wrapper ${pid || "(no pid)"} and its agent were not running on two sweeps in a row\n`);
					return ["ended", reason];
				}, time.now());
				if (!moved) continue;
				bus.emit("core", "job-ended", { id, kind: read("kind"), project: read("project"), state: "ended", reason });
			}
			gone = seen;
		},
	};
}

// `only` keeps the jobs in that state.
function jobsText(home: string, time: Clock, only?: string): string {
	const ids = jobIds(home).filter((id) => only === undefined || field(home, id)("state") === only);
	if (ids.length === 0) return only === undefined ? "no jobs" : `no ${only} jobs`;
	const many = new Set(ids.map((id) => field(home, id)("project"))).size > 1;
	// Each state's group, in the order of STATES; a state written by hand after them.
	const groups = new Map<string, string[]>(STATES.map((state) => [state, []]));
	for (const id of ids) {
		const read = field(home, id);
		const [state, reason] = [read("state") || "-", read("reason")];
		const ticket = taskTickets(read("task")).map((path) => FEATURE.exec(path)?.[1]).find(Boolean) ?? "-";
		const at = Date.parse(read("since"));
		const [minutes, end] = [Math.max(0, Math.floor((time.now().getTime() - at) / 60_000)), time.local(new Date(Number.isNaN(at) ? 0 : at))];
		const when = Number.isNaN(at) ? "-" : state !== "ended" ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m` : end.date === time.local().date ? end.time : end.date;
		const cost = `$${Number(read("cost") || 0).toFixed(2)}/$${Number(read("budget")).toFixed(2)}`;
		const line = [ticket, read("kind"), state, when, cost, ...(many ? [read("project")] : []), id.slice(-8), ...(reason === "" ? [] : [reason])];
		groups.set(state, [...(groups.get(state) ?? []), line.join("  ")]);
	}
	return [...groups].flatMap(([group, each]) => (each.length > 0 ? [`${group}\n${each.join("\n")}`] : [])).join("\n\n");
}

// Git decides what is safe: a worktree with changes, or a branch with commits HEAD does not have, stays with the record. On
// another machine `arthur remote-job prune` removes the worktree there, Git deciding there, the branch there when it is the
// one here (`tip`), and the record there; a machine that does not answer keeps everything.
function prune(home: string, id: string, keep: (job: FinishedJob) => readonly unknown[], there: (id: string) => Machine | undefined): string {
	const read = field(home, id);
	const [root, worktree, branch] = ["root", "worktree", "branch"].map(read) as [string, string, string];
	const now = current(home, id);
	if (now.state !== "ended") return `kept: it is ${told(now)}, not ended`;
	if (read("offline") !== "") return `kept: it ended here while machine ${read("machine")} did not answer; the sweep follows its run there until its end arrives`;
	if (root === "") return "kept: its record names no repository (root)";
	// The first line of what Git said when it refused, else undefined.
	const git = (...args: string[]) => {
		const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
		return run.status === 0 ? undefined : `git ${args[0]}: ${(run.error?.message ?? run.stderr).trim().split("\n")[0]}`;
	};
	const tip = branch === "" ? "" : (spawnSync("git", ["-C", root, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { encoding: "utf8" }).stdout?.trim() ?? "");
	let done: string[];
	try {
		const machine = there(id);
		if (machine === undefined) {
			const present = existsSync(worktree);
			const refused = present ? git("worktree", "remove", worktree) : git("worktree", "prune");
			if (refused !== undefined) return `kept its worktree, branch and record: ${refused}`;
			done = present ? [`worktree ${worktree} removed`] : [];
		} else done = [ssh(machine, ["arthur", "remote-job", "prune", machine.home, id, tip]).trim()].filter((line) => line !== "");
	} catch (error) {
		return `kept its worktree, branch and record: ${error instanceof Error ? error.message : String(error)}`;
	}
	if (tip !== "") {
		const kept = git("branch", "--quiet", "-d", branch);
		if (kept !== undefined) return [...done, `kept branch ${branch} and the record: ${kept}`].join("; ");
		done.push(`branch ${branch} deleted`);
	}
	const reasons = keep({ id, kind: read("kind"), project: read("project"), task: read("task"), state: now.state, reason: now.reason, branch, worktree }).filter((reason) => typeof reason === "string" && reason.trim() !== "");
	if (reasons.length > 0) return [...done, `kept the record: ${reasons.join("; ")}`].join("; ");
	rmSync(join(home, "jobs", id), { recursive: true, force: true });
	return [...done, "record deleted"].join("; ");
}
