import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Host } from "@arthur/core/plugin";
import { entryOf } from "./auto-merge.ts";
import { recoverMerge } from "./merge-recovery.ts";

// The merge without the coordinator (AR0576): after a PASS, a `no review` or CI passed on a waiting branch, with `autoMerge` on,
// `arthur run` starts `arthur merge --auto <job>` (the core's CLI, in the folder it runs in), so the checks on main never hold
// its loop; its output wakes the coordinator once. Only `arthur run` acts (`start`); `<folder>/<job>/forwarded` keeps each
// cause, so a repeated event runs no second merge. The merge outlives `arthur run` (AR0629): a session of its own, in a systemd
// scope of its own where a user manager makes one, its output and exit status in `<folder>/merge-runs/<job>-<x>/`, which the
// next `arthur run` reads; one killed half done is rolled back and run again (merge-recovery.ts). docs/commands/merge.md, "On its own".

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/cli"));
// A job id, as a merge takes it and a folder name: never a flag, never a path.
const JOB = /^\w[\w-]*$/;
// How often `arthur run` looks for the end of a merge an earlier `arthur run` started.
const POLL_MS = 5000;

// `forward(project, job, why, key)`: false, running nothing, when `project` does not merge on its own; `why` opens the wake and
// `key` names the cause. `start`: `arthur run`'s, from which on it acts.
export type Forward = (project: string, job: string, why: string, key: string) => boolean;
export type PassForward = { readonly start: () => void; readonly stop: () => void; readonly forward: Forward };
type Run = { readonly project: string; readonly job: string; readonly why: string; readonly pid: number };

export function passForward(host: Host): PassForward {
	let open = () => {};
	const opened = new Promise<void>((resolve) => (open = resolve));
	const runs = join(host.folder, "merge-runs");
	let timer: NodeJS.Timeout | undefined;
	const run = (project: string, job: string, why: string, key: string) => {
		const mark = join(host.folder, job, "forwarded");
		if (existsSync(mark) && readFileSync(mark, "utf8").split("\n").includes(key)) return;
		mkdirSync(join(host.folder, job), { recursive: true });
		appendFileSync(mark, `${key}\n`);
		mkdirSync(runs, { recursive: true });
		const folder = mkdtempSync(join(runs, `${job}-`));
		// `sh` writes the exit status once the merge ended; a merge killed with it leaves none.
		const merge = ["sh", "-c", '"$@"; echo $? > "$0.tmp" && mv "$0.tmp" "$0"', join(folder, "exit"), process.execPath, CLI, "merge", "--auto", job];
		const scope = (unit: string) => ["--user", "--scope", "--quiet", "--collect", `--unit=arthur-merge-${unit}.scope`, "--"];
		const scoped = spawnSync("systemd-run", [...scope(`probe-${process.pid}-${Date.now()}`), "true"]).status === 0;
		const [command = "", ...args] = scoped ? ["systemd-run", ...scope(`${job}-${process.pid}-${Date.now()}`), ...merge] : merge;
		const output = [openSync(join(folder, "out"), "w"), openSync(join(folder, "err"), "w")] as const;
		const child = spawn(command, args, { detached: true, stdio: ["ignore", ...output] });
		output.forEach((fd) => closeSync(fd));
		writeFileSync(join(folder, "run.tmp"), JSON.stringify({ project, job, why, pid: child.pid ?? 0 } satisfies Run));
		renameSync(join(folder, "run.tmp"), join(folder, "run.json"));
		child.on("exit", check).on("error", check).unref();
	};
	// Each merge that ended (an exit status, or its process gone) wakes the coordinator, its folder removed; one killed half done
	// is run again instead, when its merge commit went back.
	function check() {
		for (const name of existsSync(runs) ? readdirSync(runs) : []) {
			const folder = join(runs, name);
			const read = (file: string) => (existsSync(join(folder, file)) ? readFileSync(join(folder, file), "utf8") : "");
			let started: Run;
			try {
				started = JSON.parse(read("run.json"));
			} catch {
				continue;
			}
			const code = read("exit").trim();
			if (code === "" && alive(started.pid)) continue;
			const printed = `${read("out")}${read("err")}`.trim();
			rmSync(folder, { recursive: true, force: true });
			if (code === "" && rerun(started.project)) continue;
			const ran = `${started.why} ${started.project} merges on its own (autoMerge), so delivery ran arthur merge --auto ${started.job}`;
			const end = code === "0" ? "it went in; follow the procedure it printed last" : `${code === "" ? "killed before its end" : `exit ${code}`}, it did not go in; act on its last line as arthur merge --help, "What the coordinator does with the result", says`;
			host.events.emit("coordinator-message", { text: `${ran}: ${end}. What it printed:\n\n${printed}` });
		}
	}
	const forward: Forward = (project, job, why, key) => {
		if (entryOf(host, project)?.pieces?.delivery?.autoMerge !== true || !JOB.test(job)) return false;
		void opened.then(() => run(project, job, why, key));
		return true;
	};
	// A merge of `project` that died half done, rolled back: run again, or left to the owner where `autoMerge` is off now.
	const rerun = (project: string) => {
		const dead = recoverMerge(host, project);
		if (dead !== undefined && !forward(project, dead.job, dead.why, `rerun ${dead.hash}`))
			host.events.emit("coordinator-message", { text: `${dead.why} ${project} no longer merges on its own (autoMerge off): its merge waits for the owner: arthur merge ${dead.job} --decision <the owner's decision id>` });
		return dead !== undefined;
	};
	// `arthur review-needed`'s `no review`, emitted in its own process (review-needed.ts) and delivered here from the log.
	host.events.on("no-review", ({ data }) => {
		const { id, project, ticket, branch, commit } = (data ?? {}) as Readonly<Record<string, unknown>>;
		if (typeof id === "string" && typeof project === "string" && typeof commit === "string") forward(project, id, `arthur review-needed answered no review for ${String(ticket)}, ${String(branch)} at ${commit.slice(0, 7)}.`, `no review ${commit}`);
	});
	const start = () => {
		open();
		check();
		for (const { name } of host.board.projects()) rerun(name);
		timer = setInterval(check, POLL_MS).unref();
	};
	return { start, stop: () => clearInterval(timer), forward };
}

// Whether `pid` still runs: a signal 0 it may not receive (EPERM) still names a process; 0, a spawn that failed, names none.
function alive(pid: number): boolean {
	try {
		return pid > 0 && process.kill(pid, 0);
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}
