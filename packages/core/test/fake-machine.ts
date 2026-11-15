import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { TestContext } from "node:test";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import type { Slice } from "../src/job-scope.ts";
import { jobRunner } from "../src/jobs.ts";
import { jobSlice, temporaryFolder, until } from "../src/testing.ts";

// The machine test files' shared setup: a fake `ssh`, a repository and a machine `gpu` there, and the helpers they read records with.

export const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
export const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
export const commit = (root: string, message: string) => git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", message);

// The fake `ssh` on PATH, for the file that imports this: it notes each call in `ssh.log` beside it and runs the command in the folder `machine`
// names in `machine` beside it, with `<machine>/bin` first on PATH, as ssh runs a command in a login's home; a file `refuse`
// there makes it fail as ssh does when the server refuses the key.
const bin = temporaryFolder();
// The machine's PATH has no `arthur` but the one in its own bin: not the one `npm test` puts on this PATH.
const machinePath = (process.env.PATH ?? "").split(delimiter).filter((folder) => !folder.includes("node_modules")).join(delimiter);
const sshLog = join(bin, "ssh.log");
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${sshLog}'
machine=$(cat '${join(bin, "machine")}')
while [ $# -gt 0 ]; do case "$1" in -o|-p|-l) shift 2;; -*) shift;; *) break;; esac; done
host=$1; shift
if [ -e "$machine/refuse" ]; then echo "alice@$host: Permission denied (publickey)." >&2; exit 255; fi
cd "$machine" && PATH="$machine/bin:${machinePath}" exec sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// One line per call; a newline in a word goes on the next line, which does not start with an option.
export const calls = () => (existsSync(sshLog) ? readFileSync(sshLog, "utf8").split("\n").filter((line) => line.startsWith("-o ")) : []);

// A repository `acme` with one commit, a home folder beside it, and a machine `gpu` in a folder of its own whose `arthur` is
// this core (`arthur` there: the script of `<machine>/bin/arthur`); the runner's plugin `machines` registers it, and `place`
// answers its `jobs.place`, `caps` its `jobs.limits`, `roles` its `roles.model`, `prompt` its `prompt`, one answer per plugin
// that provides it; `hide` names the env values (secret-names.ts); `unsandboxed` is `core.jobs.unsandboxed`, default on. The runner's clock stands at `now.at`, which a test moves.
export function setup(options: { readonly agent?: string; readonly arthur?: string; readonly place?: () => readonly unknown[]; readonly caps?: () => readonly unknown[]; readonly roles?: () => readonly unknown[]; readonly prompt?: () => readonly unknown[]; readonly hide?: (text: string) => string; readonly slice?: Slice; readonly unsandboxed?: boolean } = {}) {
	rmSync(sshLog, { force: true });
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	commit(root, "first");
	const home = join(folder, "home");
	const machine = temporaryFolder();
	writeFileSync(join(bin, "machine"), machine);
	mkdirSync(join(machine, "bin"));
	if (options.arthur !== "") writeFileSync(join(machine, "bin/arthur"), options.arthur ?? `#!/bin/sh\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const there = join(machine, "arthur-home");
	const now = { at: new Date("2026-10-16T12:00:00Z") };
	const time = clock("UTC", undefined, () => now.at);
	const answers: Readonly<Record<string, (() => readonly unknown[]) | undefined>> = { "jobs.place": options.place, "jobs.limits": options.caps, "roles.model": options.roles, prompt: options.prompt };
	const collect = (name: string) => [...(answers[name]?.() ?? [])];
	const limits = { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, unsandboxed: options.unsandboxed ?? true, ...(options.slice ?? jobSlice) };
	const jobs = jobRunner(home, root, join(root, "env"), limits, options.agent ?? "omp", time, eventBus(home, options.hide), collect);
	jobs.registerMachine("machines", { name: "gpu", ssh: "gpu", home: there, labels: { os: "linux" } });
	return { root, home, machine, there, jobs, now };
}

export const read = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
export const events = (home: string, name: string) => readEvents(home, 1).filter((event) => event.name === name).map((event) => event.data as Record<string, unknown>);

// Git's `push` and `fetch` read `gpu:<there>/repos/acme.git` first as the name of a remote, which a job may add to the checkout's config.
export const namedAsUrl = (there: string, key: string) => `remote.gpu:${join(there, "repos", "acme.git")}.${key}`;

// A `git` first on PATH until the test ends that writes `keys` into a repository's own config right after Arthur's config check
// (git-config.ts) first lists it, as a job's program would between that check and the git call (AR0392).
export function plantAfterCheck(t: TestContext, keys: readonly (readonly [string, string])[]): void {
	const folder = temporaryFolder();
	const quote = (word: string) => `'${word.replaceAll("'", "'\\''")}'`;
	const real = quote(execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim());
	const plant = keys.map(([key, value]) => `${real} -C "$2" config ${quote(key)} ${quote(value)}\n`).join("");
	const now = `[ "$3 $4 $5" = "config --list --show-scope" ] && mkdir ${quote(join(folder, "planted"))} 2>/dev/null`;
	writeFileSync(join(folder, "git"), `#!/bin/sh\n${real} "$@"\ncode=$?\nif ${now}; then\n${plant}fi\nexit $code\n`, { mode: 0o755 });
	process.env.PATH = [folder, process.env.PATH].join(delimiter);
	t.after(() => void (process.env.PATH = process.env.PATH?.split(delimiter).filter((each) => each !== folder).join(delimiter)));
}

// Whole lines only: a line the agent is still appending has no line break yet.
export const messages = (agent: string) => (existsSync(join(agent, "..", "messages.jsonl")) ? readFileSync(join(agent, "..", "messages.jsonl"), "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line) as unknown) : []);
export const starts = (agent: string) => (existsSync(join(agent, "..", "starts.jsonl")) ? readFileSync(join(agent, "..", "starts.jsonl"), "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line) as { readonly cwd: string }) : []);
export const endedThere = (there: string, id: string) => until("the job's end there", () => existsSync(join(there, "jobs", id, "state")) && read(there, id, "state") === "ended");
export const UNREACHABLE = "machine gpu: ssh gpu: alice@gpu: Permission denied (publickey).";

export const MAY_RUN = "which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig";

// AR0347: what a machine sends lands only in the run's files of the job's record, and the end fetches the job's own branch.
// From the call, `arthur remote-job records` there answers by hand: each job of `ended` at its end, with those files.
export function byHand(machine: string, ended: Readonly<Record<string, Record<string, string>>>) {
	const answer = join(machine, "answer");
	const copy = (files: Record<string, string>) => ({ state: "ended", reason: "finished", since: "2026-10-16T12:00:00.000Z", at: 1, logFrom: 0, logSize: 0, logTo: 0, files });
	writeFileSync(answer, JSON.stringify(Object.fromEntries(Object.entries(ended).map(([id, files]) => [id, copy(files)]))));
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && exec cat '${answer}'\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
}
