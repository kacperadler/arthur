import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE, taskTickets } from "./board-jobs.ts";
import type { Clock } from "./clock.ts";
import type { Bus } from "./events.ts";
import { ID, stopJob } from "./job-control.ts";
import { processTable } from "./process-table.ts";

// Every project's job records `<home>/jobs/<id>/` (spec/roadmap.md, entry 15): `arthur jobs`, `arthur prune`, `/stopall`, and
// the sweep `arthur run` makes for jobs whose processes are gone. A job is named by its full id or its short id, the 8 hex
// digits that end it.

// A finished job as a plugin's `jobs.keep` gets it; `branch` is empty for a read-only kind.
export type FinishedJob = { readonly [key in "id" | "kind" | "project" | "task" | "state" | "branch" | "worktree"]: string };

// A reader of one record's files; a missing one reads empty.
export const field = (home: string, id: string) => (name: string): string => {
	const path = join(home, "jobs", id, name);
	return existsSync(path) ? readFileSync(path, "utf8") : "";
};

// When the file was last written; 0 when it is missing.
const written = (home: string, id: string, name: string) => statSync(join(home, "jobs", id, name), { throwIfNoEntry: false })?.mtimeMs ?? 0;

// Every record, the newest spawn first; a record being written (`.<id>`) is not one yet.
export function jobIds(home: string): string[] {
	const folder = join(home, "jobs");
	const ids = existsSync(folder) ? readdirSync(folder).filter((name) => ID.test(name) && existsSync(join(folder, name, "kind"))) : [];
	return ids.sort((a, b) => written(home, b, "kind") - written(home, a, "kind"));
}

// The full id of the one job `query` names; refused when none or several match, naming them.
export function findJob(home: string, query: string): string {
	const found = jobIds(home).filter((id) => id === query || id.endsWith(`-${query}`));
	if (found.length === 1) return found[0] ?? "";
	if (found.length === 0) throw new Error(`${query}: no such job in ${join(home, "jobs")}`);
	throw new Error(`${query} matches ${found.length} jobs: ${found.join(", ")}; name one by its full id`);
}

// `list`: `arthur jobs`. `prune`: one line per job, of those `ids` names, else of every one; `keep` asks the plugins
// (`collect("jobs.keep", job)`), and each answer that is a text is a reason to keep the record. `stopAll`: emits `stop-all`
// (`ids`: the running jobs), then stops each, one line per job. `sweep`: fails a job whose state says running while neither
// its wrapper nor its agent runs, on this sweep and the one before.
export function jobUpkeep(home: string, time: Clock, bus: Bus, keep: (job: FinishedJob) => readonly unknown[]) {
	let gone = new Set<string>();
	return {
		list: () => jobsText(home, time),
		prune(ids: readonly string[]) {
			// Every id is found first, so a typo refuses the prune before anything is removed.
			const all = ids.length > 0 ? [...new Set(ids.map((query) => findJob(home, query)))] : jobIds(home);
			return all.length === 0 ? ["no jobs"] : all.map((id) => `${id}: ${prune(home, id, keep)}`);
		},
		async stopAll() {
			const running = jobIds(home).filter((id) => field(home, id)("state") === "running");
			bus.emit("core", "stop-all", { ids: running });
			if (running.length === 0) return "no running jobs";
			return (await Promise.all(running.map((id) => stopJob(home, id).catch((error: Error) => error.message)))).join("\n");
		},
		sweep() {
			const table = processTable();
			const seen = new Set<string>();
			for (const id of jobIds(home)) {
				const read = field(home, id);
				const [pid, folder] = [read("pid"), join(home, "jobs", id)];
				// The agent's command line names the record's prompt; the wrapper's, its id.
				const alive = table.some(({ pid: each, args }) => (String(each) === pid && args.includes("wrapper.ts") && args.includes(id)) || args.includes(join(folder, "prompt")));
				if (read("state") !== "running" || alive) continue;
				seen.add(id);
				if (!gone.has(id)) continue;
				appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] failed: process gone: its wrapper ${pid || "(no pid)"} and its agent were not running on two sweeps in a row\n`);
				writeFileSync(join(folder, ".state"), "failed");
				renameSync(join(folder, ".state"), join(folder, "state"));
				bus.emit("core", "job-ended", { id, kind: read("kind"), project: read("project"), state: "failed", reason: "process gone" });
			}
			gone = seen;
		},
	};
}

// Under a heading per group, newest first, one line per job: its ticket, kind, state, how long it has run or when it ended,
// its cost against its budget, its project when the records hold more than one, its short id.
function jobsText(home: string, time: Clock): string {
	const ids = jobIds(home);
	if (ids.length === 0) return "no jobs";
	const many = new Set(ids.map((id) => field(home, id)("project"))).size > 1;
	const lines: Record<"running" | "needs attention" | "done", string[]> = { running: [], "needs attention": [], done: [] };
	for (const id of ids) {
		const read = field(home, id);
		const state = read("state") || "starting";
		const ticket = taskTickets(read("task")).map((path) => FEATURE.exec(path)?.[1]).find(Boolean) ?? "-";
		const at = written(home, id, "state");
		const [minutes, end] = [Math.max(0, Math.floor((time.now().getTime() - at) / 60_000)), time.local(new Date(at))];
		const when = at === 0 ? "-" : state === "running" ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m` : end.date === time.local().date ? end.time : end.date;
		const cost = `$${Number(read("cost") || 0).toFixed(2)}/$${Number(read("budget")).toFixed(2)}`;
		const group = state === "running" || state === "starting" ? "running" : state === "done" ? "done" : "needs attention";
		lines[group].push([ticket, read("kind"), state, when, cost, ...(many ? [read("project")] : []), id.slice(-8)].join("  "));
	}
	return Object.entries(lines).flatMap(([group, each]) => (each.length > 0 ? [`${group}\n${each.join("\n")}`] : [])).join("\n\n");
}

// Git decides what is safe: a worktree with changes, or a branch with commits HEAD does not have, stays with the record.
function prune(home: string, id: string, keep: (job: FinishedJob) => readonly unknown[]): string {
	const read = field(home, id);
	const [state, root, worktree, branch] = ["state", "root", "worktree", "branch"].map(read) as [string, string, string, string];
	if (state === "" || state === "running") return `kept: it is ${state || "not started yet"}, not finished`;
	if (root === "") return "kept: its record names no repository (root)";
	// The first line of what Git said when it refused, else undefined.
	const git = (...args: string[]) => {
		const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
		return run.status === 0 ? undefined : `git ${args[0]}: ${(run.error?.message ?? run.stderr).trim().split("\n")[0]}`;
	};
	const present = existsSync(worktree);
	const refused = present ? git("worktree", "remove", worktree) : git("worktree", "prune");
	if (refused !== undefined) return `kept its worktree, branch and record: ${refused}`;
	const done = present ? [`worktree ${worktree} removed`] : [];
	if (branch !== "" && git("rev-parse", "--verify", "--quiet", `refs/heads/${branch}`) === undefined) {
		const kept = git("branch", "--quiet", "-d", branch);
		if (kept !== undefined) return [...done, `kept branch ${branch} and the record: ${kept}`].join("; ");
		done.push(`branch ${branch} deleted`);
	}
	const reasons = keep({ id, kind: read("kind"), project: read("project"), task: read("task"), state, branch, worktree }).filter((reason) => typeof reason === "string" && reason.trim() !== "");
	if (reasons.length > 0) return [...done, `kept the record: ${reasons.join("; ")}`].join("; ");
	rmSync(join(home, "jobs", id), { recursive: true, force: true });
	return [...done, "record deleted"].join("; ");
}
