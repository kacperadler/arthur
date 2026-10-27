import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { coreVersion, ssh, sshAsync } from "../src/job-machine.ts";
import type { Slice } from "../src/job-scope.ts";
import { jobRunner } from "../src/jobs.ts";
import { secretNames } from "../src/secret-names.ts";
import { fakeAgent, fakeHost, jobSlice, temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const commit = (root: string, message: string) => git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", message);

// The fake `ssh` on PATH, for this file: it notes each call in `ssh.log` beside it and runs the command in the folder `machine`
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
if [ -e "$machine/refuse" ]; then echo "kacper@$host: Permission denied (publickey)." >&2; exit 255; fi
cd "$machine" && PATH="$machine/bin:${machinePath}" exec sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// One line per call; a newline in a word goes on the next line, which does not start with an option.
const calls = () => (existsSync(sshLog) ? readFileSync(sshLog, "utf8").split("\n").filter((line) => line.startsWith("-o ")) : []);

// A repository `acme` with one commit, a home folder beside it, and a machine `gpu` in a folder of its own whose `arthur` is
// this core (`arthur` there: the script of `<machine>/bin/arthur`); the runner's plugin `machines` registers it, and `place`
// answers its `jobs.place`, `caps` its `jobs.limits`, `roles` its `roles.model`, `prompt` its `prompt`, one answer per plugin
// that provides it; `hide` names the env values (secret-names.ts). The runner's clock stands at `now.at`, which a test moves.
function setup(options: { readonly agent?: string; readonly arthur?: string; readonly place?: () => readonly unknown[]; readonly caps?: () => readonly unknown[]; readonly roles?: () => readonly unknown[]; readonly prompt?: () => readonly unknown[]; readonly hide?: (text: string) => string; readonly slice?: Slice } = {}) {
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
	const limits = { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...(options.slice ?? jobSlice) };
	const jobs = jobRunner(home, root, join(root, "env"), limits, options.agent ?? "omp", time, eventBus(home, options.hide), collect);
	jobs.registerMachine("machines", { name: "gpu", ssh: "gpu", home: there, labels: { os: "linux" } });
	return { root, home, machine, there, jobs, now };
}

async function until<T>(what: string, predicate: () => T | undefined | false): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const read = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
const events = (home: string, name: string) => readEvents(home, 1).filter((event) => event.name === name).map((event) => event.data as Record<string, unknown>);

test("a worker on another machine runs there over SSH; the sweep copies its record and brings its branch back, running no hook of the checkout's config", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it.", cost: 0.25 }] });
	const { root, home, there, jobs } = setup({ agent });
	// Hooks that refuse every push and every ref update, named by the checkout's config as a job's program may have set them.
	const hooks = temporaryFolder();
	writeFileSync(join(hooks, "pre-push"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	git(root, "config", "core.hooksPath", hooks);
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	const repository = join(there, "repos/acme.git");
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	assert.deepEqual([job.machine, job.worktree, job.root], ["gpu", worktree, root]);
	assert.equal(git(repository, "rev-parse", "--is-bare-repository"), "true", "the project's repository there was created");
	assert.equal(git(worktree, "branch", "--show-current"), job.branch);
	assert.equal(git(worktree, "rev-parse", "HEAD"), git(root, "rev-parse", "HEAD"));
	assert.equal(read(home, job.id, "machine"), "gpu");
	assert.equal(read(there, job.id, "root"), repository);
	// There no config exists: its record guards Arthur's install there and the user's own files only.
	// A second `systemd` and `gitxdg` line, for an `XDG_CONFIG_HOME` the tests run with, is the same key.
	const keys = (folder: string) => [...new Set(read(folder, job.id, "guarded").split("\n").map((line) => line.split(" ")[0]))];
	assert.deepEqual([keys(home), keys(there)], [["config", "env", "install", "ssh", "systemd", "gitconfig", "gitxdg"], ["install", "ssh", "systemd", "gitconfig", "gitxdg"]]);
	for (const call of calls()) assert.match(call, /^-o BatchMode=yes -o StrictHostKeyChecking=yes .*gpu /, "every step runs through ssh's batch mode, host key checked");
	assert.equal(calls().filter((call) => call.includes("receive-pack")).length, 1);
	assert.equal(events(home, "job-started")[0]?.machine, "gpu");

	// The agent's commit there, made while it waits; the main checkout has the job's branch from an earlier run already.
	commit(worktree, "the change");
	const tip = git(worktree, "rev-parse", "HEAD");
	git(root, "branch", job.branch ?? "", git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit-tree", "main^{tree}", "-p", "main", "-m", "the earlier run"));
	assert.equal(existsSync(join(root, "..", ".arthur-worktrees", job.id)), false, "no worktree here");
	jobs.sweep();
	assert.equal(read(home, job.id, "state"), "working");
	assert.equal(read(home, job.id, "pid"), read(there, job.id, "pid"), "the sweep copied the run's files");
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	assert.equal(events(home, "job-ended").length, 0);
	writeFileSync(join(hooks, "reference-transaction"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	jobs.sweep();
	assert.deepEqual(["state", "reason", "result", "cost"].map((name) => read(home, job.id, name)), ["ended", "finished", "Built it.", "0.2500"]);
	assert.match(read(home, job.id, "commits"), /the change/);
	assert.equal(git(root, "rev-parse", job.branch ?? ""), tip, "the branch is fetched over the one from the earlier run");
	assert.deepEqual(git(root, "branch", "--list", "arthur/*", "--format=%(refname:short)").split("\n"), [job.branch]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	assert.deepEqual(events(home, "job-state").map((data) => [data.machine, data.to]), [["gpu", "ended"]]);
	const copies = calls().length;
	jobs.sweep();
	assert.equal(calls().length, copies, "an ended job is not copied again");
	assert.equal(events(home, "job-ended").length, 1);

	const second = await jobs.spawn({ task: "Again.", machine: "gpu", kind: "worker" });
	assert.equal(second.failed, undefined);
	assert.equal(calls().filter((call) => call.includes("receive-pack")).length, 1, "the base commit there is not pushed twice");
});

test("the prompt a job on another machine gets names each env value, there as here", async () => {
	const agent = fakeAgent({ steps: [{ message: "Done." }] });
	const { home, there, jobs } = setup({ agent, prompt: () => ["Call it with s3cret-t0ken-123."], hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	for (const folder of [home, there]) assert.match(read(folder, job.id, "prompt"), /Call it with ARTHUR_TEST_TOKEN\.\n/, folder);
});

test("the sweep's copy of a job on another machine names each env value in its log, final message and reason here", async () => {
	const agent = fakeAgent({ steps: [{ stderr: "401 for s3cret-t0ken-123" }, { message: "Blocked: user is s3cret-t0ken-123 still valid?" }] });
	const { home, there, jobs } = setup({ agent, hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	jobs.prepare("test", () => ({ ARTHUR_INSTALL: "echo installed with s3cret-t0ken-123" }));
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "blocked");
	assert.match(read(there, job.id, "log"), /installed with s3cret-t0ken-123\n/, "the wrapper there names nothing: no env file there");
	jobs.sweep();
	assert.deepEqual(["state", "reason", "result"].map((name) => read(home, job.id, name)), ["blocked", "user: is ARTHUR_TEST_TOKEN still valid?", "Blocked: user is ARTHUR_TEST_TOKEN still valid?"]);
	assert.match(read(home, job.id, "log"), /installed with ARTHUR_TEST_TOKEN\n[\s\S]*401 for ARTHUR_TEST_TOKEN\n/);
	const files = readdirSync(home, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
	for (const file of files) assert.ok(!readFileSync(file, "utf8").includes("s3cret-t0ken-123"), file);
});

test("a sweep's copy of the log a job on another machine appended since the last one names each env value", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ stderr: "first line" }, { waitFor: gate }, { stderr: "401 for s3cret-t0ken-123" }, { message: "Done." }] });
	const { home, there, jobs } = setup({ agent, hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await until("the first line there", () => existsSync(join(there, "jobs", job.id, "log")) && read(there, job.id, "log").includes("first line\n"));
	jobs.sweep();
	assert.match(read(home, job.id, "log"), /first line\n/);
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	jobs.sweep();
	assert.match(read(home, job.id, "log"), /first line\n[\s\S]*401 for ARTHUR_TEST_TOKEN\n/);
	assert.doesNotMatch(read(home, job.id, "log"), /s3cret-t0ken-123/);
});

test("the push of a job's base to another machine and the fetch of its branch back are refused while the checkout's own config sets a key that may name a program", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it.", cost: 0 }] }) });
	const said = (verb: string) => `git ${verb}: ${join(root, ".git", "config")} sets remote.gpu.receivepack, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	git(root, "config", "remote.gpu.receivepack", "program");
	await assert.rejects(jobs.spawn({ task: "Build it.", machine: "gpu" }), { message: said("push") });
	assert.equal(calls().filter((call) => call.includes("receive-pack")).length, 0, "nothing pushed");
	git(root, "config", "--unset", "remote.gpu.receivepack");
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	git(root, "config", "remote.gpu.receivepack", "program");
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	assert.throws(() => jobs.sweep(), { message: said("fetch") });
	assert.equal(git(root, "branch", "--list", job.branch ?? ""), "", "its branch not brought back");
});

test("the push of a job's base and the fetch of its branch run no transport helper nor a folder's hooks that a remote named as the machine's URL names", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it.", cost: 0 }] }) });
	const ran = join(temporaryFolder(), "ran");
	const helpers = temporaryFolder();
	writeFileSync(join(helpers, "git-remote-evil"), `#!/bin/sh\necho helper "$@" >> '${ran}'\nexit 1\n`, { mode: 0o755 });
	const folder = temporaryFolder();
	git(folder, "init", "--quiet", "--bare");
	writeFileSync(join(folder, "hooks", "pre-receive"), `#!/bin/sh\necho hook >> '${ran}'\n`, { mode: 0o755 });
	const path = process.env.PATH;
	process.env.PATH = `${helpers}${delimiter}${path}`;
	try {
		// Git reads `gpu:<there>/repos/acme.git` first as the name of a remote, which a job may add to the checkout's config.
		const named = `remote.gpu:${join(there, "repos", "acme.git")}.url`;
		for (const [url, transport] of [["evil::x", "evil"], ["evil://x", "evil"], [folder, "file"]] as const) {
			git(root, "config", named, url);
			await assert.rejects(jobs.spawn({ task: "Build it.", machine: "gpu" }), { message: `git push: fatal: transport '${transport}' not allowed` }, url);
		}
		git(root, "config", "--unset", named);
		const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
		git(root, "config", named, "evil::x");
		writeFileSync(gate, "");
		await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
		assert.throws(() => jobs.sweep(), { message: "git fetch: fatal: transport 'evil' not allowed" });
		assert.equal(git(root, "branch", "--list", job.branch ?? ""), "", "its branch not brought back");
		assert.equal(existsSync(ran), false, "nothing run");
	} finally {
		process.env.PATH = path;
	}
});

test("under umask 022 a spawn leaves the home here and the one there their user's alone: one made 0755 earlier and a new one are 0700", async (t) => {
	const mask = process.umask(0o022);
	t.after(() => process.umask(mask));
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Built it.", cost: 0 }] }) });
	mkdirSync(home);
	assert.equal(statSync(home).mode & 0o777, 0o755, "the umask in force");
	assert.equal(existsSync(there), false);
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	assert.deepEqual([statSync(home).mode & 0o777, statSync(there).mode & 0o777], [0o700, 0o700]);
});

// AR0235 F2: a review on another machine checks out a worker's tip that only this repository holds.
test("a spawn's fetch goes to the machine with its base, to refs/arthur/fetch, once; a fetch that is no commit here is refused before any record", async () => {
	const agent = fakeAgent({ steps: [{ message: "Done." }] });
	const { root, home, there, jobs } = setup({ agent });
	git(root, "checkout", "--quiet", "-b", "side");
	commit(root, "the worker's change");
	const tip = git(root, "rev-parse", "HEAD");
	git(root, "checkout", "--quiet", "main");
	for (const fetch of ["side", "f".repeat(40)])
		await assert.rejects(jobs.spawn({ task: "Review it.", machine: "gpu", fetch }), { message: `fetch: "${fetch}" is no commit of ${root}; give its hex id` });
	assert.equal(existsSync(join(home, "jobs")), false);
	const job = await jobs.spawn({ task: "Review it.", machine: "gpu", fetch: tip });
	assert.equal(job.failed, undefined);
	const repository = join(there, "repos/acme.git");
	assert.equal(git(repository, "rev-parse", "refs/arthur/fetch"), tip);
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	git(worktree, "checkout", "--quiet", "--detach", tip);
	assert.equal(git(worktree, "rev-parse", "HEAD"), tip, "the tip checks out there");
	const pushes = calls().filter((call) => call.includes("receive-pack")).length;
	assert.equal(pushes, 2, "the base and the fetch");
	await jobs.spawn({ task: "Again.", machine: "gpu", fetch: tip });
	assert.equal(calls().filter((call) => call.includes("receive-pack")).length, pushes, "neither is pushed again");
});

test("a prepare's variables reach the agent there through the launch's stdin, and again through a continue's, never an argument nor the record there or here", async () => {
	const omp = fakeAgent({ steps: [{ message: "Done." }] });
	const agent = join(dirname(omp), "env-omp");
	writeFileSync(agent, `#!/bin/sh\nenv > '${join(dirname(omp), "env")}'\nexec '${omp}' "$@"\n`, { mode: 0o755 });
	const { home, there, jobs } = setup({ agent });
	const continued: boolean[] = [];
	jobs.prepare("models", (_job, _env, again) => (continued.push(again), { OLLAMA_BASE_URL: "http://100.101.102.103:11434", OLLAMA_API_KEY: "remote-s3cr3t", ARTHUR_AGENT_MODEL: "ollama/qwen3" }));
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu", model: "mac/qwen3" });
	assert.equal(job.failed, undefined);
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	const env = readFileSync(join(dirname(omp), "env"), "utf8");
	assert.match(env, /^OLLAMA_API_KEY=remote-s3cr3t$/m);
	assert.match(env, /^OLLAMA_BASE_URL=http:\/\/100\.101\.102\.103:11434$/m);
	const starts = () => readFileSync(join(dirname(omp), "starts.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line).args as string[]);
	const [start] = starts();
	assert.equal(start?.[start.indexOf("--model") + 1], "ollama/qwen3");
	jobs.sweep();
	assert.equal(read(home, job.id, "model"), "mac/qwen3");
	rmSync(join(dirname(omp), "env"));
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	await until("the continued job's end there", () => starts().length === 2 && read(there, job.id, "state") === "ended");
	const again = readFileSync(join(dirname(omp), "env"), "utf8");
	assert.match(again, /^OLLAMA_API_KEY=remote-s3cr3t$/m);
	assert.match(again, /^OLLAMA_BASE_URL=http:\/\/100\.101\.102\.103:11434$/m);
	const second = starts()[1] ?? [];
	assert.deepEqual([second[second.indexOf("--model") + 1], continued], ["ollama/qwen3", [false, true]]);
	jobs.sweep();
	const secret = (folder: string) => readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && readFileSync(join(folder, entry.name), "utf8").includes("remote-s3cr3t")).map((entry) => entry.name);
	assert.deepEqual([secret(join(there, "jobs", job.id)), secret(join(home, "jobs", job.id)), calls().filter((call) => call.includes("remote-s3cr3t"))], [[], [], []]);
});

test("a job on another machine starts with none of its role's MCP servers, nor its continue, and its spawn warns, naming them", async () => {
	const omp = fakeAgent({ steps: [{ message: "Done." }] });
	const mcp = { docs: { command: "docs-mcp", env: { TOKEN: "mcp-s3cr3t" } }, web: { type: "http", url: "https://example.com/mcp" } };
	const { home, there, jobs } = setup({ agent: omp, roles: () => [{ mcp }] });
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	const told = (warnings: readonly string[]) => warnings.filter((warning) => warning.startsWith("MCP"));
	assert.deepEqual([job.failed, told(job.warnings)], [undefined, ["MCP servers left out on gpu, which Arthur sends no MCP secret (arthur spawn --help, \"On another machine\"): docs, web"]]);
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	const args = JSON.parse(readFileSync(join(dirname(omp), "starts.jsonl"), "utf8").split("\n")[0] ?? "").args as string[];
	assert.deepEqual([args.includes("--plugin-dir"), args.includes("--config")], [false, false]);
	jobs.sweep();
	assert.deepEqual([existsSync(join(home, "jobs", job.id, "mcp")), existsSync(join(there, "jobs", job.id, "mcp")), calls().filter((call) => call.includes("mcp-s3cr3t"))], [false, false, []]);
	// A continue there: no local wrapper ever removes a `mcp/` here, so none may be written (AR0337).
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	const starts = () => readFileSync(join(dirname(omp), "starts.jsonl"), "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line).args as string[]);
	await until("the continued job's end there", () => starts().length === 2 && read(there, job.id, "state") === "ended");
	jobs.sweep();
	assert.deepEqual([starts()[1]?.includes("--plugin-dir"), existsSync(join(home, "jobs", job.id, "mcp")), existsSync(join(there, "jobs", job.id, "mcp")), calls().filter((call) => call.includes("mcp-s3cr3t"))], [false, false, false, []]);
	const local = await jobs.spawn({ task: "Build it here." });
	// Its record's `mcp/` lies there only during its run (AR0337): the flag of its start says it got them.
	await until("the local job's start", () => starts().length === 3);
	assert.deepEqual([told(local.warnings), starts()[2]?.includes("--plugin-dir")], [[], true], "a local job gets them");
});

test("an unknown machine, a refused key, arthur missing there or of another version refuse the spawn before any record", async () => {
	const nothing = (home: string, there: string) => [existsSync(join(home, "jobs")), existsSync(join(there, "jobs")), existsSync(join(there, "repos/.arthur-worktrees"))];
	const unknown = setup();
	await assert.rejects(unknown.jobs.spawn({ task: "Go.", machine: "mac" }), { message: "unknown machine mac; machines: gpu, local" });
	assert.deepEqual(calls(), []);

	const refused = setup();
	writeFileSync(join(refused.machine, "refuse"), "");
	await assert.rejects(refused.jobs.spawn({ task: "Go.", machine: "gpu" }), { message: "machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey)." });
	assert.deepEqual(nothing(refused.home, refused.there), [false, false, false]);

	const missing = setup({ arthur: "" });
	await assert.rejects(missing.jobs.spawn({ task: "Go.", machine: "gpu" }), {
		message: new RegExp(`^machine gpu: arthur is not there \\(.*arthur.*not found\\); install the version here, ${coreVersion()} \\(docs/deploy\\.md\\)$`),
	});
	assert.deepEqual(nothing(missing.home, missing.there), [false, false, false]);

	const other = setup({ arthur: `#!/bin/sh\necho 0123456789ab\n` });
	await assert.rejects(other.jobs.spawn({ task: "Go.", machine: "gpu" }), { message: `machine gpu runs arthur 0123456789ab, this one is ${coreVersion()}; both need the same version` });
	assert.deepEqual(nothing(other.home, other.there), [false, false, false]);
	assert.equal(calls().length, 1, "nothing after the version");
});

test("a job on local takes no SSH step, at its spawn or at a sweep, while another machine is registered", async () => {
	const { home, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go." });
	assert.equal(read(home, job.id, "machine"), "local");
	await until("the job's end", () => read(home, job.id, "state") === "ended");
	jobs.sweep();
	assert.deepEqual(calls(), []);
});

test("without --machine the spawn goes where jobs.place answers; an unknown answer is refused", async () => {
	const placed = setup({ place: () => [Promise.resolve("gpu")] });
	const job = await placed.jobs.spawn({ task: "Go.", kind: "worker" });
	assert.equal(read(placed.home, job.id, "machine"), "gpu");
	const named = await placed.jobs.spawn({ task: "Go.", machine: "local" });
	assert.equal(read(placed.home, named.id, "machine"), "local", "a named machine wins over the placement");
	const wrong = setup({ place: () => [undefined] });
	await assert.rejects(wrong.jobs.spawn({ task: "Go." }), { message: "unknown machine undefined; machines: gpu, local" });
	const two = setup({ place: () => ["gpu", "local"] });
	await assert.rejects(two.jobs.spawn({ task: "Go." }), { message: 'call("jobs.place"): provided by 2 plugins; call needs exactly one' });
	assert.equal(existsSync(join(two.home, "jobs")), false);
});

test("a prepare that throws on a job on another machine removes its worktree and record there and here", async () => {
	const { home, there, jobs } = setup();
	jobs.prepare("projects", () => {
		throw new Error("no install");
	});
	await assert.rejects(jobs.spawn({ task: "Go.", machine: "gpu" }), { message: "plugin projects: prepare failed: no install; the job's worktree and record were removed" });
	assert.deepEqual([readdirSync(join(home, "jobs")), readdirSync(join(there, "jobs")), readdirSync(join(there, "repos/.arthur-worktrees"))], [[], [], []]);
	assert.equal(git(join(there, "repos/acme.git"), "branch", "--list"), "");
});

// Whole lines only: a line the agent is still appending has no line break yet.
const messages = (agent: string) => (existsSync(join(agent, "..", "messages.jsonl")) ? readFileSync(join(agent, "..", "messages.jsonl"), "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line) as unknown) : []);
const starts = (agent: string) => (existsSync(join(agent, "..", "starts.jsonl")) ? readFileSync(join(agent, "..", "starts.jsonl"), "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line) as { readonly cwd: string }) : []);
const endedThere = (there: string, id: string) => until("the job's end there", () => existsSync(join(there, "jobs", id, "state")) && read(there, id, "state") === "ended");
const UNREACHABLE = "machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey).";

test("arthur steer, stop, continue and prune of a job on another machine run there over SSH", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({ steps: [{ waitFor: join(gates, "one") }, { tool: "read", args: { path: "README.md" } }, { waitFor: join(gates, "two") }, { message: "Done." }] });
	const { root, home, there, jobs } = setup({ agent });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	assert.equal(jobs.steer(job.id, "Use the second file."), "0001");
	writeFileSync(join(gates, "one"), "");
	await until("the steer there", () => messages(agent).length === 1);
	assert.deepEqual(messages(agent), [{ content: "Use the second file.", options: { deliverAs: "steer" }, step: 1 }]);

	assert.equal(await jobs.stop(job.id), `${job.id}: stopped`);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "stopped"], "the end there is here at once");
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["stopped"]);
	assert.equal(git(root, "rev-parse", job.branch ?? ""), git(worktree, "rev-parse", "HEAD"));

	// With both gates open, the continued run plays through to its end.
	writeFileSync(join(gates, "two"), "");
	assert.equal(await jobs.continue(job.id, "Go on.", 3), undefined);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "budget"), read(there, job.id, "budget")], ["working", "3", "3"]);
	assert.deepEqual(events(home, "job-started").map((data) => data.machine), ["gpu", "gpu"]);
	await endedThere(there, job.id);
	assert.deepEqual(starts(agent).map((start) => start.cwd), [worktree, worktree], "both runs there, in its worktree");
	assert.equal(read(there, job.id, "continue"), "Go on.");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	// A second continue, whose wrapper does not start there, ends here at once.
	rmSync(join(there, "jobs", job.id, "timeout"));
	const failed = await jobs.continue(job.id, "Once more.");
	assert.match(failed ?? "", /^the wrapper exited 1 before it wrote its pid; see /);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", `failed: ${failed}`]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["stopped", "finished", `failed: ${failed}`]);

	assert.deepEqual(jobs.prune([job.id]), [`${job.id}: worktree ${worktree} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`]);
	assert.deepEqual([existsSync(worktree), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [false, false, false]);
	assert.deepEqual([git(join(there, "repos/acme.git"), "branch", "--list"), git(root, "branch", "--list", "arthur/*")], ["", ""]);
	for (const step of ["steer", "stop", "continue", "prune"]) assert.ok(calls().some((call) => call.includes(`'remote-job' '${step}'`)), step);
});

test("a spawn's push to another machine and a prune there run no hook and no fsmonitor that the repository there names", async () => {
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const first = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, first.id);
	jobs.sweep();
	// Each hook these steps could run there, and an fsmonitor, noting its name in `ran`, as a job's program there may have set them.
	const [hooks, ran, repository] = [temporaryFolder(), join(temporaryFolder(), "ran"), join(there, "repos/acme.git")];
	for (const name of ["pre-receive", "update", "post-receive", "post-update", "reference-transaction", "post-checkout", "fsmonitor"])
		writeFileSync(join(hooks, name), `#!/bin/sh\necho ${name} >> '${ran}'\n`, { mode: 0o755 });
	git(repository, "config", "core.hooksPath", hooks);
	git(repository, "config", "core.fsmonitor", join(hooks, "fsmonitor"));
	commit(root, "second");
	const second = await jobs.spawn({ task: "Again.", machine: "gpu" });
	assert.equal(git(repository, "rev-parse", "refs/arthur/base"), git(root, "rev-parse", "HEAD"), "the new base was pushed there");
	await endedThere(there, second.id);
	jobs.sweep();
	const removed = (id: string, branch = "") => `${id}: worktree ${join(there, "repos/.arthur-worktrees", id)} removed there; branch ${branch} deleted there; branch ${branch} deleted; record deleted`;
	assert.deepEqual(jobs.prune([first.id, second.id]), [removed(first.id, first.branch), removed(second.id, second.branch)]);
	assert.equal(existsSync(ran) ? readFileSync(ran, "utf8") : "", "");
	git(repository, "worktree", "add", "--quiet", "-b", "control", join(temporaryFolder(), "control"), "refs/arthur/base");
	assert.match(readFileSync(ran, "utf8"), /^reference-transaction$[^]*^post-checkout$/m, "a plain git call there runs them");
});

const MAY_RUN = "which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig";

test("a spawn is refused before any push while the repository there sets a key that may name a program, which a hookless push there runs and the fetch back does not", async () => {
	const { root, home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const repository = join(there, "repos/acme.git");
	assert.equal(spawnSync(process.execPath, [CLI, "remote-job", "repo", there, "acme", "HEAD"], { cwd: machine, encoding: "utf8" }).stdout, "missing\n");
	// As a job's program there may write it: a command for the refs of the alternates, which `git receive-pack` runs.
	const [other, ran, script] = [temporaryFolder(), join(temporaryFolder(), "ran"), join(temporaryFolder(), "alternate-refs")];
	git(other, "init", "--quiet");
	commit(other, "other");
	writeFileSync(join(repository, "objects/info/alternates"), `${join(other, ".git/objects")}\n`);
	writeFileSync(script, `#!/bin/sh\necho ran >> '${ran}'\n`, { mode: 0o755 });
	git(repository, "config", "core.alternateRefsCommand", script);
	await assert.rejects(jobs.spawn({ task: "Go.", machine: "gpu" }), { message: `machine gpu: arthur remote-job repo: no push: ${join(repository, "config")} sets core.alternaterefscommand, ${MAY_RUN}` });
	assert.deepEqual([calls().filter((call) => call.includes("receive-pack")).length, existsSync(ran)], [0, false], "nothing pushed, nothing run");
	assert.deepEqual([existsSync(join(home, "jobs")), existsSync(join(there, "jobs")), existsSync(join(there, "repos/.arthur-worktrees"))], [false, false, false]);
	git(repository, "config", "--unset", "core.alternateRefsCommand");
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(git(repository, "rev-parse", "refs/arthur/base"), git(root, "rev-parse", "HEAD"), "pushed once the key is gone");
	git(repository, "config", "core.alternateRefsCommand", script);
	await endedThere(there, job.id);
	jobs.sweep();
	assert.deepEqual([git(root, "branch", "--list", job.branch ?? "").trim(), existsSync(ran)], [job.branch, false], "its branch fetched back, nothing run");
	commit(root, "second");
	git(root, "push", "--quiet", "--receive-pack=git -c core.hooksPath=/dev/null receive-pack", repository, "HEAD:refs/heads/control");
	assert.match(readFileSync(ran, "utf8"), /^ran$/m, "the push Arthur sends runs it");
});

test("a prune there is refused, removing nothing, while the job's worktree there reads a key that may name a program, from the shared config or its own", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const [repository, worktree] = [join(there, "repos/acme.git"), join(there, "repos/.arthur-worktrees", job.id)];
	// A file a clean filter reads, as a job's commit leaves it; `git status` in the worktree runs the filter while its stat is stale.
	writeFileSync(join(worktree, ".gitattributes"), "a filter=x\n");
	writeFileSync(join(worktree, "a"), "a\n");
	git(worktree, "add", ".gitattributes", "a");
	commit(worktree, "a file");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	jobs.sweep();
	const [ran, filter] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "clean")];
	writeFileSync(filter, `#!/bin/sh\necho clean >> '${ran}'\ncat\n`, { mode: 0o755 });
	const [old, kept] = [new Date("2000-01-01"), `${job.id}: kept its worktree, branch and record: machine gpu: arthur remote-job prune: git worktree:`];
	const all = () => [existsSync(worktree), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id)), existsSync(ran)];
	git(repository, "config", "filter.x.clean", filter);
	utimesSync(join(worktree, "a"), old, old);
	assert.deepEqual(jobs.prune([job.id]), [`${kept} ${join(repository, "config")} sets filter.x.clean, ${MAY_RUN}`]);
	assert.deepEqual(all(), [true, true, true, false], "the shared config's: everything kept, nothing run");
	// The worktree's own config.worktree, which Git reads once `extensions.worktreeConfig` is on (core.bare moved, as commit-rules does).
	git(repository, "config", "--unset", "filter.x.clean");
	git(repository, "config", "--unset", "core.bare");
	git(repository, "config", "extensions.worktreeConfig", "true");
	git(repository, "config", "--worktree", "core.bare", "true");
	git(worktree, "config", "--worktree", "filter.x.clean", filter);
	assert.deepEqual(jobs.prune([job.id]), [`${kept} ${join(repository, "worktrees", job.id, "config.worktree")} sets filter.x.clean, ${MAY_RUN}`]);
	assert.deepEqual(all(), [true, true, true, false], "the worktree's own: everything kept, nothing run");
	git(worktree, "status", "--porcelain");
	assert.match(readFileSync(ran, "utf8"), /^clean$/m, "git status in the worktree, which git worktree remove runs, runs it");
	// A worktree gone there leaves no `git status` to run: `git worktree prune` takes its place, the key still set.
	rmSync(ran);
	rmSync(worktree, { recursive: true, force: true });
	assert.match(jobs.prune([job.id])[0] ?? "", new RegExp(`^${job.id}: branch ${job.branch} deleted there; `));
	assert.deepEqual(all(), [false, false, true, false], "pruned there, nothing run");
});

test("a prune there reads past a replacement under refs/replace in the repository there: the job's clean worktree is removed", async () => {
	const { there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, job.id);
	jobs.sweep();
	// The worktree's commit (of no file) read as one with a file, as a job's git replace there would write: its deletion would
	// look staged, so a plain `git worktree remove` refuses the clean worktree.
	const repository = join(there, "repos/acme.git");
	const blob = execFileSync("git", ["-C", repository, "hash-object", "-w", "--stdin"], { input: "x\n", encoding: "utf8" }).trim();
	const tree = execFileSync("git", ["-C", repository, "mktree"], { input: `100644 blob ${blob}\tx\n`, encoding: "utf8" }).trim();
	git(repository, "replace", git(repository, "rev-parse", "refs/arthur/base"), git(repository, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit-tree", "-m", "fake", tree));
	const removed = `${job.id}: worktree ${join(there, "repos/.arthur-worktrees", job.id)} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`;
	assert.deepEqual(jobs.prune([job.id]), [removed]);
});

test("offline mid-job: stop, steer and continue are refused naming the machine; back before the grace, the job goes on as there", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
	const { root, home, machine, there, jobs, now } = setup({ agent });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	const reason = "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z";
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", reason]);
	await assert.rejects(jobs.stop(job.id), { message: UNREACHABLE });
	assert.throws(() => jobs.steer(job.id, "Also this."), { message: UNREACHABLE });
	await assert.rejects(jobs.continue(job.id, "Go on."), { message: UNREACHABLE });
	commit(worktree, "while offline");
	now.at = new Date("2026-10-16T12:29:59Z");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", reason], "a second short of the grace");

	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), existsSync(join(home, "jobs", job.id, "offline"))], ["working", false], "it kept running there");
	assert.deepEqual(events(home, "job-state").map((data) => [data.to, data.reason]), [["blocked", reason], ["working", ""]]);
	commit(worktree, "once back");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	assert.deepEqual(git(root, "log", "--format=%s", job.branch ?? "").split("\n"), ["once back", "while offline", "first"]);
	assert.equal(starts(agent).length, 1, "the agent ran once");
	assert.deepEqual([events(home, "job-started").length, events(home, "job-ended").length], [1, 1]);
});

test("an ssh refused before it reads its input says ssh's own line, not EPIPE", async () => {
	const { machine, there } = setup();
	writeFileSync(join(machine, "refuse"), "");
	// More than a pipe holds: the write cannot finish before the refused ssh exits.
	const input = "x".repeat(1 << 20);
	const gpu = { name: "gpu", ssh: "gpu", home: there, labels: {} };
	assert.throws(() => ssh(gpu, ["cat"], input), { message: UNREACHABLE });
	await assert.rejects(sshAsync(gpu, ["cat"], input), { message: UNREACHABLE });
});

test("offline past the grace: failed once, the worktree there kept; its end and branch arrive when the machine is back", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs, now } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	now.at = new Date("2026-10-16T12:30:00Z");
	jobs.sweep();
	now.at = new Date("2026-10-16T12:31:00Z");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "failed: machine offline"]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["failed: machine offline"], "failed once");
	const line = "ended: failed: machine offline: machine gpu unreachable since 2026-10-16T12:00:00.000Z, past core.jobs.offlineGraceMinutes (30)";
	assert.equal(read(home, job.id, "log").split("\n").filter((text) => text.includes("machine offline")).length, 1);
	assert.ok(read(home, job.id, "log").includes(`[arthur 2026-10-16T12:30:00.000Z] ${line}\n`));
	assert.equal(read(there, job.id, "state"), "working", "the run there goes on");
	assert.equal(git(worktree, "branch", "--show-current"), job.branch);
	assert.match(jobs.prune([job.id])[0] ?? "", /: kept: it ended here while machine gpu did not answer; /);

	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "failed: machine offline"], "back, while its run there goes on");
	commit(worktree, "the change");
	writeFileSync(join(machine, "refuse"), "");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	jobs.sweep();
	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	assert.equal(git(root, "log", "-1", "--format=%s", job.branch ?? ""), "the change");
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["failed: machine offline", "finished"]);
	const copies = calls().length;
	jobs.sweep();
	assert.equal(calls().length, copies, "its end arrived; it is not followed any more");
});

test("prune never deletes a worktree on a machine it cannot reach, nor one Git refuses there; stopall stops a job there", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	const inRun = spawnSync(process.execPath, [CLI, "remote-job", "prune", there, job.id, ""], { cwd: there, encoding: "utf8" });
	assert.deepEqual([inRun.status, inRun.stderr, existsSync(worktree)], [1, `arthur remote-job: ${job.id} is working there, in a run\n`, true]);
	assert.equal(await jobs.stopAll(), `${job.id}: stopped`);
	assert.equal(read(home, job.id, "state"), "ended");
	writeFileSync(join(machine, "refuse"), "");
	assert.deepEqual(jobs.prune([job.id]), [`${job.id}: kept its worktree, branch and record: ${UNREACHABLE}`]);
	rmSync(join(machine, "refuse"));
	writeFileSync(join(worktree, "notes.txt"), "not committed\n");
	assert.deepEqual(jobs.prune([job.id]), [
		`${job.id}: kept its worktree, branch and record: machine gpu: arthur remote-job prune: git worktree: fatal: '${worktree}' contains modified or untracked files, use --force to delete it`,
	]);
	assert.deepEqual([existsSync(join(worktree, "notes.txt")), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [true, true, true]);
	const other = jobRunner(home, there, join(there, "env"), { timeoutMinutes: 1, budgetUsd: 1, idleMinutes: 1, offlineGraceMinutes: 1, ...jobSlice }, "omp", clock("UTC", undefined), eventBus(home), () => []);
	await assert.rejects(other.stop(job.id), { message: `${job.id} runs on machine gpu, which no plugin registers; machines: local` });
});

test("a job there gets the machine's own joint limit, not this config's", { skip: spawnSync("systemctl", ["--user", "show-environment"]).status !== 0 && "no systemd user manager" }, async () => {
	const { jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }), slice: { ...jobSlice, cpu: 0.5, memory: "1G" } });
	await jobs.spawn({ task: "Go.", machine: "gpu" });
	const show = (property: string) => execFileSync("systemctl", ["--user", "show", `${jobSlice.slice}.slice`, "-p", property, "--value"], { encoding: "utf8" }).trim();
	assert.equal(show("CPUQuotaPerSecUSec"), `${Math.max(1, availableParallelism() - 1)}s`);
	assert.ok(Math.abs(Number(show("MemoryMax")) / totalmem() - 0.7) < 0.01, `MemoryMax ${show("MemoryMax")} of ${totalmem()}`);
});

test("a job with caps on a machine without a user manager runs bare there with its caps, the machine told once here, by name", async () => {
	const { home, there, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }), caps: () => [{ cpu: 2, memory: "1G" }] });
	writeFileSync(join(machine, "bin/systemctl"), "#!/bin/sh\necho 'Failed to connect to bus: No medium found' >&2\nexit 1\n", { mode: 0o755 });
	const [first, second] = [await jobs.spawn({ task: "Go.", machine: "gpu" }), await jobs.spawn({ task: "Go.", machine: "gpu" })];
	assert.deepEqual([first.failed, second.failed], [undefined, undefined]);
	assert.deepEqual(["cpu", "memory"].map((name) => read(there, second.id, name)), ["2", "1G"]);
	assert.match(read(there, second.id, "log"), /no systemd scope: Failed to connect to bus: No medium found; the job runs bare/);
	const text = "machine gpu runs jobs without a systemd scope (Failed to connect to bus: No medium found): a job's memory cap there is held by sampling its processes every 10 s, its CPU is not capped, and a ticket's CPU and memory caps, shared by all its jobs, are not held";
	assert.deepEqual(events(home, "notice"), [{ text }]);
});

test("a copy brings only the log's new bytes, appended here; arthur remote-job records sends the log from the byte asked", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	jobs.sweep();
	const before = read(there, job.id, "log");
	assert.equal(read(home, job.id, "log"), before);
	appendFileSync(join(there, "jobs", job.id, "log"), "one more line ✓\n");
	jobs.sweep();
	assert.equal(read(home, job.id, "log"), `${before}one more line ✓\n`);
	const records = (asked: string) => {
		const run = spawnSync(process.execPath, [CLI, "remote-job", "records", there, `${job.id}=${asked}`], { cwd: there, encoding: "utf8" });
		return (JSON.parse(run.stdout) as Record<string, { files: Record<string, string>; logFrom: number; logSize: number }>)[job.id];
	};
	const size = Buffer.byteLength(`${before}one more line ✓\n`);
	assert.deepEqual(records(`0:${Buffer.byteLength(before)}`), { ...records("0:0"), logFrom: Buffer.byteLength(before), files: { ...records("0:0")?.files, log: "one more line ✓\n" } });
	assert.deepEqual([records("0:0")?.logFrom, records("0:0")?.logSize, records(`0:${size + 1}`)?.logFrom], [0, size, 0], "a log shorter than asked comes whole");
	assert.deepEqual([records(`0:${size}`)?.logFrom, records(`0:${size}`)?.files.log], [size, ""], "caught up exactly: nothing new, not the whole log");
	writeFileSync(gate, "");
});

test("a copy refuses a record file whose name is not a plain record key, naming it, and writes nothing of that answer", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const [job, other] = [await jobs.spawn({ task: "Go.", machine: "gpu" }), await jobs.spawn({ task: "Go.", machine: "gpu" })];
	jobs.sweep();
	// From here `arthur remote-job records` there answers by hand what `answer` holds; every other step is this core's.
	const answer = join(machine, "answer");
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && exec cat '${answer}'\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const copy = (files: Record<string, string>) => writeFileSync(answer, JSON.stringify({ [job.id]: { state: "working", reason: "", since: "2026-10-16T12:00:00.000Z", at: 1, logFrom: 0, logSize: 0, files } }));
	writeFileSync(join(home, "outside"), "mine\n");
	const files = (folder: string) => readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => `${join(entry.parentPath, entry.name)}: ${readFileSync(join(entry.parentPath, entry.name), "utf8")}`).sort();
	const before = files(home);
	for (const key of [`sub/../../${other.id}/branch`, "../../outside", "state.lock"]) {
		copy({ cost: "9.0000", [key]: "theirs\n" });
		assert.throws(() => jobs.sweep(), { message: `machine gpu: job ${job.id} sent a record file ${JSON.stringify(key)}; expected a name of lowercase letters, digits and dashes` });
		assert.deepEqual(files(home), before, `${key}: nothing of the answer is written, here or elsewhere`);
	}
	copy({ cost: "9.0000" });
	jobs.sweep();
	assert.equal(read(home, job.id, "cost"), "9.0000", "a plain key is still written");
	writeFileSync(gate, "");
});

// AR0347: what a machine sends lands only in the run's files of the job's record, and the end fetches the job's own branch.
// From the call, `arthur remote-job records` there answers by hand: each job of `ended` at its end, with those files.
function byHand(machine: string, ended: Readonly<Record<string, Record<string, string>>>) {
	const answer = join(machine, "answer");
	const copy = (files: Record<string, string>) => ({ state: "ended", reason: "finished", since: "2026-10-16T12:00:00.000Z", at: 1, logFrom: 0, logSize: 0, files });
	writeFileSync(answer, JSON.stringify(Object.fromEntries(Object.entries(ended).map(([id, files]) => [id, copy(files)]))));
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && exec cat '${answer}'\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
}

test("a copy writes only the run's files: a branch, project, task and kind sent keep the record's, and the end fetches arthur/<id> only", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	jobs.sweep();
	// There, the job's branch and a branch `side` hold a commit; here, `side` is free, at `main`.
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	commit(worktree, "the change");
	const tip = git(worktree, "rev-parse", "HEAD");
	git(worktree, "branch", "side", tip);
	git(root, "branch", "side");
	const refs = () => git(root, "for-each-ref", "--format=%(refname) %(objectname)");
	const before = refs();
	const kept = ["branch", "project", "task", "kind", "root", "worktree", "base", "prompt", "timeout", "idle-minutes", "machine"];
	const spawned = kept.map((name) => read(home, job.id, name));
	const sent = Object.fromEntries(kept.map((name) => [name, `theirs ${name}`]));
	const run = ["pid", "active", "cost", "tool-calls", "activity", "result", "commits", "budget", "continue", "cpu", "memory", "feature", "feature-cpu", "feature-memory"];
	const theirs = Object.fromEntries(run.map((name) => [name, `theirs ${name}\n`]));
	byHand(machine, { [job.id]: { ...sent, ...theirs, branch: "side", project: "other", hold: "theirs" } });
	jobs.sweep();
	assert.deepEqual(kept.map((name) => read(home, job.id, name)), spawned, "the spawn's keys stay");
	assert.equal(existsSync(join(home, "jobs", job.id, "hold")), false);
	assert.deepEqual(Object.fromEntries(run.map((name) => [name, read(home, job.id, name)])), theirs, "every file of the run is copied");
	assert.equal(read(home, job.id, "state"), "ended");
	assert.equal(refs(), [...before.split("\n"), `refs/heads/${job.branch} ${tip}`].sort().join("\n"), "only arthur/<id> is fetched, side as it was");
	assert.deepEqual(calls().filter((call) => call.includes("git-upload-pack")).map((call) => call.split(" ").at(-1)), [`'${there}/repos/acme.git'`]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	writeFileSync(gate, "");
});

test("a record here whose branch is not arthur/<id> refuses the machine's copy, naming it, nothing written or fetched; a job without a branch fetches none", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const role = join(temporaryFolder(), "reviewer.md");
	writeFileSync(role, "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(role), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	const [job, review] = [await jobs.spawn({ task: "Go.", machine: "gpu" }), await jobs.spawn({ task: "Review it.", kind: "review", machine: "gpu" })];
	jobs.sweep();
	assert.equal(read(home, review.id, "branch"), "");
	byHand(machine, { [review.id]: { result: "PASS" } });
	jobs.sweep();
	assert.deepEqual(["state", "result"].map((name) => read(home, review.id, name)), ["ended", "PASS"]);
	assert.equal(calls().filter((call) => call.includes("git-upload-pack")).length, 0, "nothing is fetched for a job without a branch");
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	commit(worktree, "the change");
	git(worktree, "branch", "side", "HEAD");
	git(root, "branch", "side");
	writeFileSync(join(home, "jobs", job.id, "branch"), "side");
	const refs = git(root, "for-each-ref", "--format=%(refname) %(objectname)");
	byHand(machine, { [job.id]: { cost: "0.5000" } });
	assert.throws(() => jobs.sweep(), { message: `machine gpu: job ${job.id} names the branch "side" in its record here; expected arthur/${job.id} or none` });
	assert.equal(git(root, "for-each-ref", "--format=%(refname) %(objectname)"), refs, "side's tip is unchanged");
	assert.deepEqual(["state", "cost"].map((name) => read(home, job.id, name)), ["working", "0.0000"]);
	writeFileSync(gate, "");
});

test("a wrapper that does not start there ends the job there, and here at once with job-ended", async () => {
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	// The record there loses a file between its add and the launch: the wrapper fails reading it, before its pid.
	jobs.prepare("projects", (job) => rmSync(join(there, "jobs", job.id, "timeout")));
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.match(job.failed ?? "", /^the wrapper exited 1 before it wrote its pid; see /);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", `failed: ${job.failed}`]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.id), [job.id]);
});

test("a plugin's hold on a job there stands at each copy while it runs there and through an offline spell, and ends with its run", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, there, jobs, now } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	jobs.block(job.id, "waiting for AR0001");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "hold")], ["blocked", "waiting for AR0001"]);
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	assert.equal(read(home, job.id, "reason"), "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z");
	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", "dependency: waiting for AR0001"], "back: the hold's reason again");

	// Past the grace the hold goes with the run here, so the job is no longer in a run.
	const held = await jobs.spawn({ task: "Hold.", machine: "gpu" });
	jobs.block(held.id, "waiting for AR0002");
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	now.at = new Date("2026-10-16T13:00:00Z");
	jobs.sweep();
	assert.deepEqual([read(home, held.id, "reason"), existsSync(join(home, "jobs", held.id, "hold"))], ["failed: machine offline", false]);
	rmSync(join(machine, "refuse"));
	writeFileSync(gate, "");
	// The held job's run there went on through the offline spell, and a copy follows it until that run ends: wait for both.
	for (const id of [job.id, held.id]) await until("the job's end there", () => existsSync(join(there, "jobs", id, "state")) && read(there, id, "state") === "ended");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), existsSync(join(home, "jobs", job.id, "hold"))], ["ended", false]);
	const copies = calls().length;
	jobs.sweep();
	assert.equal(calls().length, copies, "a job no longer held nor in a run is not copied again");
});

test("a block with stop on a job there stops its run there and holds it blocked on the user here; the feature slice goes there, a continue's caps too", async () => {
	const gate = join(temporaryFolder(), "go");
	let answer: unknown = { feature: { name: "AC0001", cpu: 1, memory: "1G" } };
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }), caps: () => [answer] });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.deepEqual(["feature", "feature-cpu", "feature-memory"].map((name) => read(there, job.id, name)), ["AC0001", "1", "1G"]);
	await jobs.block(job.id, "feature cap hours reached: 8.00 h of 8 h", true);
	jobs.sweep();
	const reason = "user: feature cap hours reached: 8.00 h of 8 h";
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason"), existsSync(join(home, "jobs", job.id, "hold"))], ["blocked", reason, false]);
	assert.deepEqual([read(there, job.id, "state"), read(there, job.id, "reason")], ["ended", "stopped"]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "blocked", reason }]);
	// The human raised the ticket's caps: the continue there runs with those in force now.
	answer = { memory: "2G", feature: { name: "AC0001", memory: "4G" } };
	writeFileSync(gate, "");
	assert.equal(await jobs.continue(job.id, "The cap was raised; go on."), undefined);
	const names = ["cpu", "memory", "feature", "feature-cpu", "feature-memory"];
	assert.deepEqual(names.map((name) => read(there, job.id, name)), ["", "2G", "AC0001", "", "4G"]);
	assert.deepEqual(names.map((name) => read(home, job.id, name)), ["", "2G", "AC0001", "", "4G"]);
	await endedThere(there, job.id);
});

test("jobs.limits' feature must name its slice in letters and digits, or the spawn is refused before anything exists", async () => {
	const { home, jobs } = setup({ caps: () => [{ feature: { name: "AC-1" } }] });
	await assert.rejects(jobs.spawn({ task: "Go." }), { message: 'jobs.limits: feature.name must be letters and digits, got "AC-1"' });
	assert.equal(existsSync(join(home, "jobs")), false);
});

test("arthur spawn --machine names the machine; arthur remote-job refuses an unknown step, a relative home and a bad project", () => {
	const root = setup().root;
	writeFileSync(join(root, "arthur.config.ts"), 'export default { core: { timeZone: "UTC" }, plugins: [{ name: "orchestration", setup() {} }] };\n');
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8" });
	const spawned = arthur("spawn", "Go.", "--machine", "mac");
	assert.deepEqual([spawned.status, spawned.stderr], [1, "arthur spawn: unknown machine mac; machines: local\n"]);
	const usage = "usage: arthur remote-job repo|add|launch|stop|steer|continue|prune|remove|records <home> [args]\n";
	assert.deepEqual([arthur("remote-job", "push", "/x").status, arthur("remote-job", "push", "/x").stderr], [2, `arthur remote-job: unknown step "push"\n${usage}`]);
	assert.deepEqual([arthur("remote-job", "repo", "home").status, arthur("remote-job", "repo", "home").stderr], [2, `arthur remote-job: the home folder must be an absolute path\n${usage}`]);
	const home = temporaryFolder();
	const bad = arthur("remote-job", "repo", home, "../acme", "HEAD");
	assert.deepEqual([bad.status, bad.stderr], [1, 'arthur remote-job: a project name, got "../acme"\n']);
	assert.deepEqual(readdirSync(home), []);
});

test("arthur remote-job repo creates the project's repository bare once, then leaves its config as it is", () => {
	const home = temporaryFolder();
	const repo = (commitId: string) => spawnSync(process.execPath, [CLI, "remote-job", "repo", home, "acme", commitId], { cwd: home, encoding: "utf8" });
	assert.deepEqual([repo("HEAD").stdout, git(join(home, "repos/acme.git"), "rev-parse", "--is-bare-repository")], ["missing\n", "true"]);
	// As a `prepare` that turns on `extensions.worktreeConfig` leaves it: `core.bare` moved out of the shared config.
	const config = join(home, "repos/acme.git/config");
	git(join(home, "repos/acme.git"), "config", "--file", config, "--unset", "core.bare");
	const before = readFileSync(config, "utf8");
	assert.equal(repo("HEAD").stdout, "missing\n");
	assert.equal(readFileSync(config, "utf8"), before, "no core.bare written back");
});

test("registerMachine refuses local, a machine registered twice, a bad name, an ssh that is an option, and a relative home; machines() names the rest", () => {
	const { jobs } = setup();
	const machine = { name: "mac", ssh: "mac", home: "/Users/kacper/.arthur", labels: {} };
	assert.throws(() => jobs.registerMachine("machines", { ...machine, name: "local" }), { message: "machine local: registered by core and by machines; a machine belongs to one plugin" });
	assert.throws(() => jobs.registerMachine("other", { ...machine, name: "gpu" }), { message: "machine gpu: registered by machines and by other; a machine belongs to one plugin" });
	assert.throws(() => jobs.registerMachine("machines", { ...machine, name: "Mac" }), { message: 'machine "Mac": expected a name of lowercase letters, digits and dashes' });
	assert.throws(() => jobs.registerMachine("machines", { ...machine, ssh: "-oProxyCommand=sh" }), { message: 'machine mac: ssh must be a Host of ~/.ssh/config or a host name, got "-oProxyCommand=sh"' });
	assert.throws(() => jobs.registerMachine("machines", { ...machine, home: ".arthur" }), { message: 'machine mac: home must be an absolute path, got ".arthur"' });
	jobs.registerMachine("machines", machine);
	assert.deepEqual(jobs.machines(), ["local", "gpu", "mac"], "local first, then in the order registered, no refused one");
	const host = fakeHost({ name: "machines" }).host;
	assert.throws(() => host.jobs.registerMachine({ ...machine, name: "local" }), { message: "machine local: registered by core and by machines; a machine belongs to one plugin" });
	assert.deepEqual(host.jobs.machines(), ["local"]);
});

test("jobs.run runs one command on a machine: words with spaces, quotes, backticks and newlines arrive intact, the exit code comes back", async () => {
	const { machine, jobs } = setup();
	const words = ["a b", `it's "quoted"`, "$HOME", "", "; touch hacked", "`touch ticked`", "line\nnext; touch newline"];
	assert.deepEqual(await jobs.run("gpu", ["printf", "%s|", ...words]), { code: 0, stdout: `${words.join("|")}|`, stderr: "" });
	assert.deepEqual(["hacked", "ticked", "newline"].map((name) => existsSync(join(machine, name))), [false, false, false]);
	assert.deepEqual(await jobs.run("gpu", ["sh", "-c", "pwd; echo no >&2; exit 3"]), { code: 3, stdout: `${machine}\n`, stderr: "no\n" });
	assert.equal(calls().length, 2);
	assert.match(calls()[0] ?? "", /^-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 gpu 'printf' /);
	writeFileSync(join(machine, "refuse"), "");
	assert.deepEqual(await jobs.run("gpu", ["true"]), { code: 255, stdout: "", stderr: "kacper@gpu: Permission denied (publickey).\n" });
	await assert.rejects(jobs.run("mac", ["true"]), { message: "unknown machine mac; machines: gpu, local" });
	await assert.rejects(jobs.run("gpu", []), { message: "run: argv must be a non-empty list of words" });

	const host = fakeHost({ name: "projects" }).host;
	assert.deepEqual(await host.jobs.run("local", ["sh", "-c", 'printf "%s" "$1"; exit 4', "sh", "a b"]), { code: 4, stdout: "a b", stderr: "" });
	assert.deepEqual(await host.jobs.run("local", ["no-such-command-here"]), { code: 127, stdout: "", stderr: "no-such-command-here: spawn no-such-command-here ENOENT" });
	assert.equal(calls().length, 3, "local takes no SSH step");
});

test("jobs.run past limitSeconds kills the command and resolves at once, though a child of it holds its pipes", async () => {
	const { jobs } = setup();
	const started = Date.now();
	assert.deepEqual(await jobs.run("local", ["sh", "-c", "echo begun; sleep 10 & sleep 10"], 0.3), { code: null, stdout: "begun\n", stderr: "timed out after 0.3 s\n" });
	// Well before the 10 s the pipes stay open, with room for a slow runner.
	assert.ok(Date.now() - started < 8000, `resolved after ${Date.now() - started} ms, not at the limit`);
	assert.deepEqual(await jobs.run("gpu", ["sh", "-c", "echo there"], 5), { code: 0, stdout: "there\n", stderr: "" }, "within its limit it runs as without one");
	await assert.rejects(jobs.run("local", ["true"], 0), { message: "run: limitSeconds must be above 0, got 0" });
});

test("arthur version prints the core's version, without a config", () => {
	const run = spawnSync(process.execPath, [CLI, "version"], { cwd: temporaryFolder(), encoding: "utf8" });
	assert.deepEqual([run.status, run.stdout], [0, `${coreVersion()}\n`]);
	assert.match(coreVersion(), /^[0-9a-f]{12}$/);
});
