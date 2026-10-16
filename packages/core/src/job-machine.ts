import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Bus } from "./events.ts";
import { jobIds } from "./job-records.ts";
import type { Slice } from "./job-scope.ts";
import { current, field, inRun, moveJob, type State, write } from "./job-state.ts";
import type { Added } from "./remote-job.ts";

// Jobs on another machine (spec/roadmap.md, entry 21), the main Arthur's half: every step over SSH, the other half is
// `arthur remote-job` there. docs/commands/spawn.md and remote-job.md.

// `ssh`: a `Host` of `~/.ssh/config` or a host name; `home`: Arthur's home folder there; `labels` are the placement's (entry 31).
export type Machine = { readonly name: string; readonly ssh: string; readonly home: string; readonly labels: Readonly<Record<string, unknown>> };

// What `arthur remote-job records` answers per job: the state read first, then each file changed since the time asked, and
// `at`, the newest modification time there, which the next sweep asks from.
export type Copy = { readonly state: string; readonly reason: string; readonly since: string; readonly at: number; readonly files: Readonly<Record<string, string>> };

// ssh never asks for a password nor accepts a host key on its own.
const OPTIONS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes"];
const HOST = /^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/;
// Files a copy never overwrites: the repository is the main checkout here; the state moves through `moveJob`.
const OWN = ["root", "machine", "state", "reason", "since"];
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
export function machineRegistry(home: string, bus: Bus) {
	const machines = new Map([[LOCAL, { owner: "core", machine: { name: LOCAL, ssh: "", home, labels: {} } as Machine }]]);
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
		// The machine a spawn runs on: the one it names, else the one a plugin's `jobs.place` answers, else `local`.
		async pick(named: string | undefined, place: () => readonly unknown[]): Promise<Machine> {
			let name: unknown = named;
			if (name === undefined) {
				const answers = place();
				if (answers.length > 1) throw new Error(`call("jobs.place"): provided by ${answers.length} plugins; call needs exactly one`);
				name = answers.length === 0 ? LOCAL : await answers[0];
			}
			const found = typeof name === "string" ? machines.get(name) : undefined;
			if (found === undefined) throw new Error(`unknown machine ${typeof name === "string" ? name : JSON.stringify(name)}; machines: ${[...machines.keys()].sort().join(", ")}`);
			return found.machine;
		},
		// The sweep's copy from every other machine; a machine that fails is named and the others still copy.
		sync(): void {
			const failed: string[] = [];
			for (const { machine } of machines.values()) {
				try {
					if (machine.name !== LOCAL) syncMachine(home, machine, bus);
				} catch (error) {
					failed.push(error instanceof Error ? error.message : String(error));
				}
			}
			if (failed.length > 0) throw new Error(failed.join("\n"));
		},
	};
}

// The project's repository there, bare, created empty on first use.
const repositoryThere = (machine: Machine, project: string) => join(machine.home, "repos", `${project}.git`);
const url = (machine: Machine, project: string) => `${machine.ssh}:${repositoryThere(machine, project)}`;

// Runs `argv` there; its stdout, or an error naming the machine with ssh's or the command's last line.
function ssh(machine: Machine, argv: readonly string[], input = ""): string {
	const run = spawnSync("ssh", [...OPTIONS, machine.ssh, argv.map(quote).join(" ")], { encoding: "utf8", input });
	const said = run.stderr?.trim().split("\n").at(-1) || `exit code ${run.status ?? run.signal}`;
	if (run.error !== undefined) throw new Error(`machine ${machine.name}: ssh: ${run.error.message}`);
	if (run.status === 255) throw new Error(`machine ${machine.name}: ssh ${machine.ssh}: ${said}`);
	if (run.status === 127 && argv[0] === "arthur") throw new Error(`machine ${machine.name}: arthur is not there (${said}); install the version here, ${coreVersion()} (docs/deploy.md)`);
	if (run.status !== 0) throw new Error(`machine ${machine.name}: ${argv.slice(0, 3).join(" ")}: ${said}`);
	return run.stdout;
}

// `git -C <root> <args>` with ssh's options for a remote there.
function gitOver(root: string, args: readonly string[]): void {
	const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...process.env, GIT_SSH_COMMAND: ["ssh", ...OPTIONS].join(" ") } });
	if (run.status !== 0) throw new Error(`git ${args[0]}: ${run.error?.message ?? run.stderr.trim()}`);
}

// Before any record exists: `arthur` there of this version, the project's repository there, and `base` in it, pushed from
// `root` only when it is missing. Returns the repository there.
export function reach(machine: Machine, project: string, root: string, base: string): string {
	const [theirs, ours] = [ssh(machine, ["arthur", "version"]).trim(), coreVersion()];
	if (theirs !== ours) throw new Error(`machine ${machine.name} runs arthur ${theirs}, this one is ${ours}; both need the same version`);
	const there = ssh(machine, ["arthur", "remote-job", "repo", machine.home, project, base]).trim();
	if (there === "missing") gitOver(root, ["push", "--quiet", url(machine, project), `+${base}:refs/arthur/base`]);
	return repositoryThere(machine, project);
}

// With one SSH call, copies the changed files of the records of `machine`'s jobs in a run; a run that ended there brings its
// branch into the job's `root` before its state moves here, then `job-ended`.
function syncMachine(home: string, machine: Machine, bus: Bus): void {
	const ids = jobIds(home).filter((id) => field(home, id)("machine") === machine.name && inRun(current(home, id)));
	if (ids.length === 0) return;
	const asked = ids.map((id) => `${id}=${field(home, id)("synced") || "0"}`);
	const answer = JSON.parse(ssh(machine, ["arthur", "remote-job", "records", machine.home, ...asked])) as Record<string, Copy>;
	for (const id of ids) {
		const copy = answer[id];
		if (copy === undefined) continue;
		const [folder, read] = [join(home, "jobs", id), field(home, id)];
		for (const [name, text] of Object.entries(copy.files)) if (!OWN.includes(name) && read(name) !== text) write(folder, name, text);
		const ended = copy.state !== "working" && copy.state !== "idle";
		const branch = read("branch");
		if (ended && branch !== "") gitOver(read("root"), ["fetch", "--quiet", url(machine, read("project")), `+refs/heads/${branch}:refs/heads/${branch}`]);
		const moved = moveJob(home, id, bus, () => [copy.state as State, copy.reason], new Date(copy.since));
		write(folder, "synced", String(copy.at));
		if (ended && moved) bus.emit("core", "job-ended", { id, kind: read("kind"), project: read("project"), state: copy.state, reason: copy.reason });
	}
}

// The job's worktree and record there, `added` as `arthur remote-job add` reads it; `remove` takes both away again.
export const addThere = (machine: Machine, added: Added) => void ssh(machine, ["arthur", "remote-job", "add", machine.home], JSON.stringify(added));
export const removeThere = (machine: Machine, id: string) => void ssh(machine, ["arthur", "remote-job", "remove", machine.home, id]);

// Starts the job's wrapper there in its own scope of `jobs`' slice; returns why it did not start, which ended the job there
// and, by a copy at once, here.
export function launchThere(home: string, machine: Machine, id: string, agent: string, jobs: Slice, bus: Bus): string | undefined {
	const failed = ssh(machine, ["arthur", "remote-job", "launch", machine.home, id, agent, jobs.slice, String(jobs.cpu), jobs.memory]).trim();
	if (failed === "") return undefined;
	syncMachine(home, machine, bus);
	return failed;
}
