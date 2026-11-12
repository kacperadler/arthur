import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { secretNames } from "../src/secret-names.ts";
import { fakeAgent, jobSlice, temporaryFolder, until } from "../src/testing.ts";
import { CLI, calls, commit, endedThere, events, git, MAY_RUN, read, setup } from "./fake-machine.ts";

// Jobs on another machine (fake-machine.ts): a spawn there and what its job starts with.

test("a worker on another machine runs there over SSH; the sweep copies its record and brings its branch back, running no hook of the checkout's config", async () => {
	const gate = join(temporaryFolder(), "go");
	const fake = fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it.", cost: 0.25, usage: { input: 3, output: 4 } }] });
	// The agent there notes the guarded list its launch gave it, then plays the fake agent.
	const agent = join(dirname(fake), "guarded-omp");
	writeFileSync(agent, `#!/bin/sh\nprintf '%s' "$ARTHUR_GUARDED" > '${agent}.part' && mv '${agent}.part' '${agent}.guarded'\nexec '${fake}' "$@"\n`, { mode: 0o755 });
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
	// There no config exists: its launch guards Arthur's install there and the user's own files only, and no record holds the list.
	// A second `systemd` and `gitxdg` line, for an `XDG_CONFIG_HOME` the tests run with, is the same key.
	await until("the agent's start there", () => existsSync(`${agent}.guarded`));
	assert.deepEqual([...new Set(readFileSync(`${agent}.guarded`, "utf8").split("\n").map((line) => line.split(" ")[0]))], ["install", "ssh", "systemd", "gitconfig", "gitxdg"]);
	assert.deepEqual([home, there].map((folder) => existsSync(join(folder, "jobs", job.id, "guarded"))), [false, false]);
	for (const call of calls()) assert.match(call, /^-o BatchMode=yes -o StrictHostKeyChecking=yes .*gpu /, "every step runs through ssh's batch mode, host key checked");
	assert.equal(calls().filter((call) => call.includes("receive-pack")).length, 1);
	assert.equal(events(home, "job-started")[0]?.machine, "gpu");

	// The agent's commit there, made while it waits; the main checkout has the job's branch from an earlier run already.
	commit(worktree, "the change");
	const tip = git(worktree, "rev-parse", "HEAD");
	git(root, "branch", job.branch ?? "", git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit-tree", "main^{tree}", "-p", "main", "-m", "the earlier run"));
	assert.equal(existsSync(join(root, "..", ".arthur-worktrees", job.id)), false, "no worktree here");
	await jobs.sweep();
	assert.equal(read(home, job.id, "state"), "working");
	assert.equal(read(home, job.id, "pid"), read(there, job.id, "pid"), "the sweep copied the run's files");
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	assert.equal(events(home, "job-ended").length, 0);
	writeFileSync(join(hooks, "reference-transaction"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	await jobs.sweep();
	assert.deepEqual(["state", "reason", "result", "cost"].map((name) => read(home, job.id, name)), ["ended", "finished", "Built it.", "0.2500"]);
	assert.deepEqual(JSON.parse(read(home, job.id, "usage")), { "anthropic/fake": { messages: 1, input: 3, output: 4, cacheRead: 0, cacheWrite: 0, cost: 0.25 } }, "usage is copied with the run's files");
	assert.match(read(home, job.id, "commits"), /the change/);
	assert.equal(git(root, "rev-parse", job.branch ?? ""), tip, "the branch is fetched over the one from the earlier run");
	assert.deepEqual(git(root, "branch", "--list", "arthur/*", "--format=%(refname:short)").split("\n"), [job.branch]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	assert.deepEqual(events(home, "job-state").map((data) => [data.machine, data.to]), [["gpu", "ended"]]);
	const copies = calls().length;
	await jobs.sweep();
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
	await jobs.sweep();
	assert.equal(read(home, job.id, "model"), "mac/qwen3");
	rmSync(join(dirname(omp), "env"));
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	await until("the continued job's end there", () => starts().length === 2 && read(there, job.id, "state") === "ended");
	const again = readFileSync(join(dirname(omp), "env"), "utf8");
	assert.match(again, /^OLLAMA_API_KEY=remote-s3cr3t$/m);
	assert.match(again, /^OLLAMA_BASE_URL=http:\/\/100\.101\.102\.103:11434$/m);
	const second = starts()[1] ?? [];
	assert.deepEqual([second[second.indexOf("--model") + 1], continued], ["ollama/qwen3", [false, true]]);
	await jobs.sweep();
	const secret = (folder: string) => readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && readFileSync(join(folder, entry.name), "utf8").includes("remote-s3cr3t")).map((entry) => entry.name);
	assert.deepEqual([secret(join(there, "jobs", job.id)), secret(join(home, "jobs", job.id)), calls().filter((call) => call.includes("remote-s3cr3t"))], [[], [], []]);
});

test("a job on another machine without the sandbox fails there unless core.jobs.unsandboxed is on here; then it runs there bare", async () => {
	for (const unsandboxed of [false, true]) {
		const { machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }), unsandboxed });
		writeFileSync(join(machine, "bin", "python3"), "#!/bin/sh\necho 'Landlock: Operation not supported' >&2\nexit 1\n", { mode: 0o755 });
		const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
		await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
		const why = process.platform === "linux" ? "Landlock: Operation not supported" : `${process.platform} has no Landlock`;
		assert.equal(read(there, job.id, "reason"), unsandboxed ? "finished" : `failed: no sandbox: ${why}; set core.jobs.unsandboxed: true in arthur.config.ts to run the agent with the writes of Arthur's user`, String(unsandboxed));
	}
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
	assert.deepEqual([args.includes("--plugin-dir"), args.some((arg) => arg.endsWith("mcp.yml"))], [false, false]);
	await jobs.sweep();
	assert.deepEqual([existsSync(join(home, "jobs", job.id, "mcp")), existsSync(join(there, "jobs", job.id, "mcp")), calls().filter((call) => call.includes("mcp-s3cr3t"))], [false, false, []]);
	// A continue there: no local wrapper ever removes a `mcp/` here, so none may be written (AR0337).
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	const starts = () => readFileSync(join(dirname(omp), "starts.jsonl"), "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line).args as string[]);
	await until("the continued job's end there", () => starts().length === 2 && read(there, job.id, "state") === "ended");
	await jobs.sweep();
	assert.deepEqual([starts()[1]?.includes("--plugin-dir"), existsSync(join(home, "jobs", job.id, "mcp")), existsSync(join(there, "jobs", job.id, "mcp")), calls().filter((call) => call.includes("mcp-s3cr3t"))], [false, false, false, []]);
	const local = await jobs.spawn({ task: "Build it here." });
	// Its record's `mcp/` lies there only during its run (AR0337): the flag of its start says it got them.
	await until("the local job's start", () => starts().length === 3);
	assert.deepEqual([told(local.warnings), starts()[2]?.includes("--plugin-dir")], [[], true], "a local job gets them");
});

test("a job on local takes no SSH step, at its spawn or at a sweep, while another machine is registered", async () => {
	const { home, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go." });
	assert.equal(read(home, job.id, "machine"), "local");
	await until("the job's end", () => read(home, job.id, "state") === "ended");
	await jobs.sweep();
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

test("a spawn's add, launch and remove there wait without blocking: the process answers while each runs", async () => {
	const gates = temporaryFolder();
	const { machine, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	// From here `arthur remote-job add`, `launch` and `remove` there note they began, and go on only once this process answers
	// with `<step>.go`: a process the step blocks never does, and the step fails 10 s on.
	const wait = `touch '${gates}'/"$2" && n=0 && while [ ! -e '${gates}'/"$2.go" ] && [ $n -lt 100 ]; do sleep 0.1; n=$((n + 1)); done && [ -e '${gates}'/"$2.go" ] || exit 1`;
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\ncase "$2" in add|launch|remove) ${wait};; esac\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const answer = async (step: string) => (await until(`${step} there`, () => existsSync(join(gates, step))), writeFileSync(join(gates, `${step}.go`), ""));
	const [job] = await Promise.all([jobs.spawn({ task: "Go.", machine: "gpu" }), answer("add").then(() => answer("launch"))]);
	assert.equal(job.failed, undefined);
	jobs.prepare("projects", () => {
		throw new Error("no install");
	});
	for (const name of ["add", "add.go"]) rmSync(join(gates, name));
	const refused = assert.rejects(jobs.spawn({ task: "Go.", machine: "gpu" }), { message: "plugin projects: prepare failed: no install; the job's worktree and record were removed" });
	await Promise.all([refused, answer("add").then(() => answer("remove"))]);
});

test("a spawn's push to another machine and a prune there run no hook and no fsmonitor that the repository there names", async () => {
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const first = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, first.id);
	await jobs.sweep();
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
	await jobs.sweep();
	const removed = (id: string, branch = "") => `${id}: worktree ${join(there, "repos/.arthur-worktrees", id)} removed there; branch ${branch} deleted there; branch ${branch} deleted; record deleted`;
	assert.deepEqual(await jobs.prune([first.id, second.id]), [removed(first.id, first.branch), removed(second.id, second.branch)]);
	assert.equal(existsSync(ran) ? readFileSync(ran, "utf8") : "", "");
	git(repository, "worktree", "add", "--quiet", "-b", "control", join(temporaryFolder(), "control"), "refs/arthur/base");
	assert.match(readFileSync(ran, "utf8"), /^reference-transaction$[^]*^post-checkout$/m, "a plain git call there runs them");
});

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
	await jobs.sweep();
	assert.deepEqual([git(root, "branch", "--list", job.branch ?? "").trim(), existsSync(ran)], [job.branch, false], "its branch fetched back, nothing run");
	commit(root, "second");
	git(root, "push", "--quiet", "--receive-pack=git -c core.hooksPath=/dev/null receive-pack", repository, "HEAD:refs/heads/control");
	assert.match(readFileSync(ran, "utf8"), /^ran$/m, "the push Arthur sends runs it");
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

test("a wrapper that does not start there ends the job there, and here at once with job-ended", async () => {
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	// The record there loses a file between its add and the launch: the wrapper fails reading it, before its pid.
	jobs.prepare("projects", (job) => rmSync(join(there, "jobs", job.id, "timeout")));
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.match(job.failed ?? "", /^the wrapper exited 1 before it wrote its pid; see /);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", `failed: ${job.failed}`]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.id), [job.id]);
});

test("jobs.limits' feature must name its slice in letters and digits, or the spawn is refused before anything exists", async () => {
	const { home, jobs } = setup({ caps: () => [{ feature: { name: "AC-1" } }] });
	await assert.rejects(jobs.spawn({ task: "Go." }), { message: 'jobs.limits: feature.name must be letters and digits, got "AC-1"' });
	assert.equal(existsSync(join(home, "jobs")), false);
});
