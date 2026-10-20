import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { field } from "./job-state.ts";
import type { Added } from "./remote-job.ts";

// Jobs on another machine (spec/roadmap.md, entries 21 and 22), the main Arthur's half: every step over SSH, the other half is
// `arthur remote-job` there. docs/commands/spawn.md and remote-job.md; the sweep's copy from there is machine-sync.ts.

// `ssh`: a `Host` of `~/.ssh/config` or a host name; `home`: Arthur's home folder there; `labels` are the placement's (entry 31).
export type Machine = { readonly name: string; readonly ssh: string; readonly home: string; readonly labels: Readonly<Record<string, unknown>> };
// The labels a job needs (entry 31): the machine's `os` and `arch`, each tool of `tools`; a plugin's `jobs.place` reads them.
export type Requires = { readonly os?: string; readonly arch?: string; readonly tools?: readonly string[] };

// What `host.jobs.run` resolves to.
export type Ran = { readonly code: number | null; readonly stdout: string; readonly stderr: string };

// ssh never asks for a password nor accepts a host key on its own, and gives up on a machine that does not answer in 10 s.
const OPTIONS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10"];
const HOST = /^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/;
const quote = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const LOCAL = "local";

// The version both ends must share: a hash of the core's source files, so two checkouts of one commit agree.
export function coreVersion(): string {
	const hash = createHash("sha256");
	for (const name of readdirSync(import.meta.dirname).sort()) hash.update(name).update(readFileSync(join(import.meta.dirname, name)));
	return hash.digest("hex").slice(0, 12);
}

// The machines of one load, `local` always among them; `owner` is the plugin that registers, named in refusals.
export function machineRegistry(home: string) {
	const machines = new Map([[LOCAL, { owner: "core", machine: { name: LOCAL, ssh: "", home, labels: {} } as Machine }]]);
	const names = () => [...machines.keys()].sort().join(", ");
	return {
		register(owner: string, machine: Machine): void {
			const { name, ssh, home: there, labels } = machine;
			if (typeof name !== "string" || !NAME.test(name)) throw new Error(`machine ${JSON.stringify(name)}: expected a name of lowercase letters, digits and dashes`);
			const first = machines.get(name);
			if (first) throw new Error(`machine ${name}: registered by ${first.owner} and by ${owner}; a machine belongs to one plugin`);
			if (typeof ssh !== "string" || !HOST.test(ssh)) throw new Error(`machine ${name}: ssh must be a Host of ~/.ssh/config or a host name, got ${JSON.stringify(ssh)}`);
			if (typeof there !== "string" || !isAbsolute(there)) throw new Error(`machine ${name}: home must be an absolute path, got ${JSON.stringify(there)}`);
			if (typeof labels !== "object" || labels === null || Array.isArray(labels)) throw new Error(`machine ${name}: labels must be an object`);
			machines.set(name, { owner, machine });
		},
		// The machine a spawn runs on: the one it names, else the one a plugin's `jobs.place` answers, else `local`. A plugin's
		// `jobs.place` is asked about a named machine too, and may refuse it; labels a spawn `requires` need a plugin to place it.
		async pick(named: string | undefined, requires: unknown, place: () => readonly unknown[]): Promise<Machine> {
			const answers = place();
			if (answers.length > 1) throw new Error(`call("jobs.place"): provided by ${answers.length} plugins; call needs exactly one`);
			if (answers.length === 0 && requires !== undefined) throw new Error("requires: no plugin places jobs by labels (jobs.place); the machines plugin does");
			const placed: unknown = answers.length === 0 ? LOCAL : await answers[0];
			const name = named ?? placed;
			const found = typeof name === "string" ? machines.get(name) : undefined;
			if (found === undefined) throw new Error(`unknown machine ${typeof name === "string" ? name : JSON.stringify(name)}; machines: ${names()}`);
			return found.machine;
		},
		// The machine job `id` runs on when it is another one; undefined on `local`; refused when no plugin registers it now.
		of(id: string): Machine | undefined {
			const name = field(home, id)("machine");
			if (name === "" || name === LOCAL) return undefined;
			const found = machines.get(name);
			if (found === undefined) throw new Error(`${id} runs on machine ${name}, which no plugin registers; machines: ${names()}`);
			return found.machine;
		},
		others: (): Machine[] => [...machines.values()].map((entry) => entry.machine).filter((machine) => machine.name !== LOCAL),
		// `host.jobs.run`: `argv` on the machine, here for `local`, else over SSH with each word quoted for the shell there; `input`
		// on its stdin, which keeps a secret out of every process list. ssh's own failure is its exit code 255 and its line on
		// stderr; past `limitSeconds` it is killed (`execute`).
		async run(name: string, argv: readonly string[], limitSeconds?: number, input = ""): Promise<Ran> {
			if (typeof name !== "string") throw new Error(`run: a machine name, got ${JSON.stringify(name)}`);
			if (!Array.isArray(argv) || argv.length === 0 || !argv.every((word) => typeof word === "string")) throw new Error("run: argv must be a non-empty list of words");
			if (limitSeconds !== undefined && !(limitSeconds > 0)) throw new Error(`run: limitSeconds must be above 0, got ${JSON.stringify(limitSeconds)}`);
			const machine = await this.pick(name, undefined, () => []);
			return execute(machine.name === LOCAL ? argv : ["ssh", ...OPTIONS, machine.ssh, argv.map(quote).join(" ")], input, limitSeconds);
		},
	};
}

// Runs `command` here, `input` on its stdin; resolves once it ended, to its exit code (null when a signal killed it; 127 when
// it did not start, as a shell says) and its whole output. Past `limitSeconds` it is killed and resolves at once, its pipes
// closed even when a child of it holds them: code null, `timed out after <n> s` the last line of its stderr.
function execute([command = "", ...args]: readonly string[], input = "", limitSeconds?: number): Promise<Ran> {
	const output = { stdout: "", stderr: "" };
	const child = spawn(command, args, { stdio: "pipe" });
	// A command that ends without reading its input: its exit code tells what happened.
	child.stdin.on("error", () => {}).end(input);
	child.stdout.setEncoding("utf8").on("data", (chunk: string) => (output.stdout += chunk));
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => (output.stderr += chunk));
	const ended = Promise.withResolvers<Ran>();
	const cut = () => {
		child.kill("SIGKILL");
		for (const pipe of [child.stdout, child.stderr]) pipe.destroy();
		ended.resolve({ code: null, stdout: output.stdout, stderr: `${output.stderr}timed out after ${limitSeconds} s\n` });
	};
	const limit = limitSeconds === undefined ? undefined : setTimeout(cut, limitSeconds * 1000);
	child.once("error", (error) => ended.resolve({ code: 127, stdout: output.stdout, stderr: `${command}: ${error.message}` }));
	child.once("close", (code) => ended.resolve({ code, ...output }));
	return ended.promise.finally(() => clearTimeout(limit));
}

// The project's repository there, bare, created empty on first use.
const repositoryThere = (machine: Machine, project: string) => join(machine.home, "repos", `${project}.git`);
export const url = (machine: Machine, project: string) => `${machine.ssh}:${repositoryThere(machine, project)}`;

// Runs `argv` there, `input` on its stdin; its stdout, or the error of `failure`. `sshAsync` waits without blocking.
export function ssh(machine: Machine, argv: readonly string[], input = ""): string {
	const run = spawnSync("ssh", [...OPTIONS, machine.ssh, argv.map(quote).join(" ")], { encoding: "utf8", input });
	// A command that ends without reading its input: its exit code tells what happened.
	const unread = run.status !== null && (run.error as NodeJS.ErrnoException | undefined)?.code === "EPIPE";
	if (run.error !== undefined && !unread) throw new Error(`machine ${machine.name}: ssh: ${run.error.message}`);
	const failed = failure(machine, argv, run.status ?? run.signal, run.stderr);
	if (failed !== undefined) throw failed;
	return run.stdout;
}
export async function sshAsync(machine: Machine, argv: readonly string[], input = ""): Promise<string> {
	const run = await execute(["ssh", ...OPTIONS, machine.ssh, argv.map(quote).join(" ")], input);
	const failed = failure(machine, argv, run.code, run.stderr);
	if (failed !== undefined) throw failed;
	return run.stdout;
}

// Why `argv` failed there, naming the machine with ssh's or the command's last line: the machine did not answer (ssh's exit
// 255, the error's `cause`), `arthur` is missing there, or the command refused; undefined when it exited 0.
function failure(machine: Machine, argv: readonly string[], code: number | string | null, stderr: string): Error | undefined {
	if (code === 0) return undefined;
	const said = stderr.trim().split("\n").at(-1)?.replace(/^arthur remote-job: /, "") || `exit code ${code}`;
	if (code === 255) return new Error(`machine ${machine.name}: ssh ${machine.ssh}: ${said}`, { cause: 255 });
	if (code === 127 && argv[0] === "arthur") return new Error(`machine ${machine.name}: arthur is not there (${said}); install the version here, ${coreVersion()} (docs/deploy.md)`);
	return new Error(`machine ${machine.name}: ${argv.slice(0, 3).join(" ")}: ${said}`);
}

// `git -C <root> <args>` with ssh's options for a remote there.
export function gitOver(root: string, args: readonly string[]): void {
	const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...process.env, GIT_SSH_COMMAND: ["ssh", ...OPTIONS].join(" ") } });
	if (run.status !== 0) throw new Error(`git ${args[0]}: ${run.error?.message ?? run.stderr.trim()}`);
}

// Before any record exists: `arthur` there of this version, the project's repository there, and `base` in it, pushed from
// `root` to `refs/arthur/base` only when it is missing; so is a spawn's `fetch`, to `refs/arthur/fetch`. Returns the repository there.
export function reach(machine: Machine, project: string, root: string, base: string, fetch?: string): string {
	const [theirs, ours] = [ssh(machine, ["arthur", "version"]).trim(), coreVersion()];
	if (theirs !== ours) throw new Error(`machine ${machine.name} runs arthur ${theirs}, this one is ${ours}; both need the same version`);
	for (const [commit, ref] of fetch === undefined ? [[base, "base"]] : [[base, "base"], [fetch, "fetch"]]) {
		const there = ssh(machine, ["arthur", "remote-job", "repo", machine.home, project, commit ?? ""]).trim();
		if (there === "missing") gitOver(root, ["push", "--quiet", url(machine, project), `+${commit}:refs/arthur/${ref}`]);
	}
	return repositoryThere(machine, project);
}

// The job's worktree and record there, `added` as `arthur remote-job add` reads it; `remove` takes both away again.
export const addThere = (machine: Machine, added: Added) => void ssh(machine, ["arthur", "remote-job", "add", machine.home], JSON.stringify(added));
export const removeThere = (machine: Machine, id: string) => void ssh(machine, ["arthur", "remote-job", "remove", machine.home, id]);
