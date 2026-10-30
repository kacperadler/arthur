import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Host } from "@arthur/core/plugin";
import { entryOf } from "./auto-merge.ts";

// The merge without the coordinator (AR0576): after a PASS, a `no review` or CI passed on a waiting branch, with `autoMerge` on,
// `arthur merge --auto <job>` runs as a child of `arthur run` (the core's CLI, in the folder it runs in), so the checks on main never
// hold its loop; its output wakes the coordinator once. Only `arthur run` acts (`start`); `<folder>/<job>/forwarded` keeps each
// cause, so a repeated event runs no second merge. docs/commands/merge.md, "On its own".

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/cli"));
// A job id, as a merge takes it and a folder name: never a flag, never a path.
const JOB = /^\w[\w-]*$/;

// `forward(project, job, why, key)`: false, running nothing, when `project` does not merge on its own; `why` opens the wake and
// `key` names the cause. `start`: `arthur run`'s, from which on it acts.
export type Forward = (project: string, job: string, why: string, key: string) => boolean;
export type PassForward = { readonly start: () => void; readonly forward: Forward };

export function passForward(host: Host): PassForward {
	let open = () => {};
	const opened = new Promise<void>((resolve) => (open = resolve));
	const run = (project: string, job: string, why: string, key: string) => {
		const mark = join(host.folder, job, "forwarded");
		if (existsSync(mark) && readFileSync(mark, "utf8").split("\n").includes(key)) return;
		mkdirSync(join(host.folder, job), { recursive: true });
		appendFileSync(mark, `${key}\n`);
		execFile(process.execPath, [CLI, "merge", "--auto", job], { encoding: "utf8", maxBuffer: Infinity }, (error, stdout, stderr) => {
			const ran = `${why} ${project} merges on its own (autoMerge), so delivery ran arthur merge --auto ${job}`;
			const end = error === null ? "it went in; follow the procedure it printed last" : `exit ${error.code ?? error.signal}, it did not go in; act on its last line as arthur merge --help, "What the coordinator does with the result", says`;
			host.events.emit("coordinator-message", { text: `${ran}: ${end}. What it printed:\n\n${`${stdout}${stderr}`.trim()}` });
		});
	};
	const forward: Forward = (project, job, why, key) => {
		if (entryOf(host, project)?.autoMerge !== true || !JOB.test(job)) return false;
		void opened.then(() => run(project, job, why, key));
		return true;
	};
	// `arthur review-needed`'s `no review`, emitted in its own process (review-needed.ts) and delivered here from the log.
	host.events.on("no-review", ({ data }) => {
		const { id, project, ticket, branch, commit } = (data ?? {}) as Readonly<Record<string, unknown>>;
		if (typeof id === "string" && typeof project === "string" && typeof commit === "string") forward(project, id, `arthur review-needed answered no review for ${String(ticket)}, ${String(branch)} at ${commit.slice(0, 7)}.`, `no review ${commit}`);
	});
	return { start: () => open(), forward };
}
