import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "@arthur/core/testing";

// For a host that refuses a Unix socket (unix-socket.ts), as the job sandbox does: a `tmux` without a server and an `omp`,
// together in `bin`, which the test puts first on PATH.
//
// tmux: `new-session -s <name> -c <folder> -e <NAME=value>... <command>` starts the command at once, detached, in that folder
// with those variables added to its own, prints its pid and keeps it as `sessions/<name>`; a session lives while its process
// does, as tmux ends one whose only pane exited. `display-message -t =<name>:` prints `<name> 0` for a live one, `kill-session`
// and `attach-session` exit 1 without one, and `kill-session` ends it with a hangup, as tmux does; any other call does nothing.
// `refuse(name)` makes each `new-session` of that name fail, `stub tmux: refused`. Each call's arguments, its socket's left
// out, go to `calls.jsonl`.
//
// omp: notes each start in `starts.jsonl`, with its time, arguments and the variables a supervisor sets, then exits 1 when
// `ARTHUR_PROJECT` is `crash`, else stays until `end()`; as a job's agent, outside every session, until `releaseJobs()`.

const TMUX = (folder: string) => `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const args = process.argv.slice(4);
fs.appendFileSync(${JSON.stringify(join(folder, "calls.jsonl"))}, JSON.stringify(args) + "\\n");
const live = (pid) => { try { return pid > 0 && (process.kill(pid, 0), true); } catch { return false; } };
const named = (name) => path.join(${JSON.stringify(join(folder, "sessions"))}, name);
const pidOf = (name) => (fs.existsSync(named(name)) ? Number(fs.readFileSync(named(name), "utf8")) : 0);
const target = (args[args.indexOf("-t") + 1] ?? "").replace(/^=/, "").replace(/:$/, "");
if (args[0] === "new-session") {
	const given = { "-F": "", "-s": "", "-c": process.cwd() }, env = {};
	let at = 1;
	for (; args[at]?.startsWith("-"); at += 1) {
		if (args[at] === "-e") { const [key, ...value] = args[++at].split("="); env[key] = value.join("="); }
		else if (args[at] in given) given[args[at]] = args[++at];
	}
	if (live(pidOf(given["-s"]))) { console.error("duplicate session: " + given["-s"]); process.exit(1); }
	if (fs.existsSync(path.join(${JSON.stringify(join(folder, "refused"))}, given["-s"]))) { console.error("stub tmux: refused"); process.exit(1); }
	const child = spawn(args[at], args.slice(at + 1), { cwd: given["-c"], env: { ...process.env, ...env }, detached: true, stdio: "ignore" });
	fs.writeFileSync(named(given["-s"]), String(child.pid));
	child.unref();
	console.log(child.pid);
} else if (args[0] === "display-message") {
	if (live(pidOf(target))) console.log(target + " 0");
	else process.exitCode = 1;
} else if (args[0] === "kill-session" || args[0] === "attach-session") {
	const pid = pidOf(target);
	if (!live(pid)) process.exitCode = 1;
	else if (args[0] === "kill-session") (process.kill(pid, "SIGHUP"), fs.rmSync(named(target)));
}
`;

const OMP = (folder: string) => `#!${process.execPath}
const fs = require("node:fs"), { env } = process;
const noted = { pid: process.pid, at: Date.now(), cwd: process.cwd(), args: process.argv.slice(2) };
for (const name of ["ARTHUR_PROJECT", "ARTHUR_ORCHESTRATION_SESSION", "ARTHUR_ORCHESTRATION_FOLDER", "ARTHUR_ORCHESTRATION_CONTEXT"]) noted[name] = env[name] ?? null;
fs.appendFileSync(${JSON.stringify(join(folder, "starts.jsonl"))}, JSON.stringify(noted) + "\\n");
if (env.ARTHUR_PROJECT === "crash") process.exit(1);
const gate = ${JSON.stringify(join(folder, "release"))} + (env.ARTHUR_ORCHESTRATION_FOLDER === undefined ? "-jobs" : "");
setInterval(() => fs.existsSync(gate) && process.exit(0), 50);
`;

export type Start = {
	readonly pid: number;
	readonly at: number;
	readonly cwd: string;
	readonly args: readonly string[];
	readonly ARTHUR_PROJECT: string | null;
	readonly ARTHUR_ORCHESTRATION_SESSION: string | null;
	readonly ARTHUR_ORCHESTRATION_FOLDER: string | null;
	readonly ARTHUR_ORCHESTRATION_CONTEXT: string | null;
};

// Whole lines only: a line still being appended has no line break yet.
const lines = <T>(file: string): T[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line) as T) : []);

export function fakeTmux() {
	const bin = temporaryFolder();
	writeFileSync(join(bin, "tmux"), TMUX(bin), { mode: 0o755 });
	writeFileSync(join(bin, "omp"), OMP(bin), { mode: 0o755 });
	const [sessions, refused] = [join(bin, "sessions"), join(bin, "refused")];
	for (const folder of [sessions, refused]) mkdirSync(folder);
	// A session's pid, 0 for none: never a signal to pid 0, the test's own process group.
	const pid = (name: string) => Number(readFileSync(join(sessions, name), "utf8")) || 0;
	return {
		bin,
		// The starts of a session's agent, a job's left out.
		starts: () => lines<Start>(join(bin, "starts.jsonl")).filter((start) => start.ARTHUR_ORCHESTRATION_FOLDER !== null),
		calls: () => lines<string[]>(join(bin, "calls.jsonl")),
		// The sessions alive, by name.
		live: () =>
			readdirSync(sessions).filter((name) => {
				try {
					return pid(name) > 0 && process.kill(pid(name), 0);
				} catch {
					return false;
				}
			}),
		refuse: (name: string) => writeFileSync(join(refused, name), ""),
		releaseJobs: () => writeFileSync(join(bin, "release-jobs"), ""),
		// Every agent a session or a job started, ended, also when a check failed before its supervisor's stop.
		end() {
			for (const gate of ["release", "release-jobs"]) writeFileSync(join(bin, gate), "");
			for (const name of readdirSync(sessions))
				try {
					if (pid(name) > 0) process.kill(pid(name), "SIGKILL");
				} catch {}
		},
	};
}
