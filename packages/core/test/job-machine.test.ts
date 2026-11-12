import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { watch } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { arthurVersion, coreVersion, reach, ssh, sshAsync } from "../src/job-machine.ts";
import { fakeAgent, fakeHost, temporaryFolder, until } from "../src/testing.ts";
import { CLI, calls, commit, endedThere, git, namedAsUrl, plantAfterCheck, read, setup, UNREACHABLE } from "./fake-machine.ts";

// Jobs on another machine (fake-machine.ts): the steps over SSH and their limits, the push and fetch, the version check, arthur remote-job's refusals.

test("the push of a job's base to another machine and the fetch of its branch back are refused while the checkout's own config sets a key that may name a program", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it.", cost: 0 }] }) });
	const said = (verb: string) => `git ${verb}: ${join(root, ".git", "config")} sets remote.gpu.receivepack, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	git(root, "config", "remote.gpu.receivepack", "program");
	await assert.rejects(jobs.spawn({ task: "Build it.", machine: "gpu" }), { message: `machine gpu: ${said("push")}` });
	assert.equal(calls().filter((call) => call.includes("receive-pack")).length, 0, "nothing pushed");
	git(root, "config", "--unset", "remote.gpu.receivepack");
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	git(root, "config", "remote.gpu.receivepack", "program");
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	await assert.rejects(jobs.sweep(), { message: `machine gpu: job ${job.id}: ${said("fetch")}` });
	assert.equal(git(root, "branch", "--list", job.branch ?? ""), "", "its branch not brought back");
});

test("the push of a job's base and the fetch of its branch reach the machine's repository whatever a remote named as its URL names: no helper, folder or other repository", async () => {
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Built it.", cost: 0 }] }) });
	const ran = join(temporaryFolder(), "ran");
	const helpers = temporaryFolder();
	writeFileSync(join(helpers, "git-remote-evil"), `#!/bin/sh\necho helper "$@" >> '${ran}'\nexit 1\n`, { mode: 0o755 });
	// Another repository, a folder whose hooks would run, which the fake ssh reaches at any host.
	const folder = temporaryFolder();
	git(folder, "init", "--quiet", "--bare");
	writeFileSync(join(folder, "hooks", "pre-receive"), `#!/bin/sh\necho hook >> '${ran}'\n`, { mode: 0o755 });
	const path = process.env.PATH;
	process.env.PATH = `${helpers}${delimiter}${path}`;
	const repository = join(there, "repos", "acme.git");
	try {
		for (const [key, url] of [["url", "evil::x"], ["url", "evil://x"], ["url", folder], ["url", `ssh://elsewhere${folder}`], ["pushurl", `ssh://elsewhere${folder}`], ["pushurl", `gpu:${folder}`]] as const) {
			commit(root, `base for ${key} ${url}`);
			git(root, "config", namedAsUrl(there, key), url);
			const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
			assert.equal(job.failed, undefined, `${key} ${url}`);
			assert.equal(git(repository, "rev-parse", "refs/arthur/base"), git(root, "rev-parse", "HEAD"), `${key} ${url}: the base reached the machine's repository`);
			git(root, "config", "--unset", namedAsUrl(there, key));
		}
		const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
		await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
		commit(join(there, "repos", ".arthur-worktrees", job.id), "the change");
		const tip = git(repository, "rev-parse", job.branch ?? "");
		// The other repository holds the job's branch at the base, which a fetch from it would bring back.
		git(folder, "fetch", "--quiet", root, `+main:refs/heads/${job.branch}`);
		git(root, "config", namedAsUrl(there, "url"), `ssh://elsewhere${folder}`);
		// A branch a worktree here has checked out is not moved under it, and is fetched at the next sweep once it is not.
		const checkout = join(temporaryFolder(), "checkout");
		git(root, "worktree", "add", "--quiet", "-b", job.branch ?? "", checkout);
		await assert.rejects(jobs.sweep(), { message: `machine gpu: job ${job.id}: git fetch: fatal: cannot force update the branch '${job.branch}' used by worktree at '${checkout}'` });
		assert.equal(git(root, "rev-parse", job.branch ?? ""), git(root, "rev-parse", "main"), "the checked-out branch stays");
		git(root, "worktree", "remove", checkout);
		await jobs.sweep();
		assert.equal(git(root, "rev-parse", job.branch ?? ""), tip, "its branch from the machine's repository");
		assert.equal(git(folder, "for-each-ref", "refs/arthur"), "", "nothing pushed to the other repository");
		assert.equal(existsSync(ran), false, "nothing run");
	} finally {
		process.env.PATH = path;
	}
});

test("a remote named as the machine's URL that a job writes into the checkout's config after the check sends the push of a job's base nowhere else", async (t) => {
	const { root, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Built it.", cost: 0 }] }) });
	const folder = temporaryFolder();
	git(folder, "init", "--quiet", "--bare");
	plantAfterCheck(t, [[namedAsUrl(there, "pushurl"), `ssh://elsewhere${folder}`]]);
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	assert.equal(git(root, "config", namedAsUrl(there, "pushurl")), `ssh://elsewhere${folder}`, "written before the push");
	assert.equal(git(join(there, "repos", "acme.git"), "rev-parse", "refs/arthur/base"), git(root, "rev-parse", "HEAD"));
	assert.equal(git(folder, "for-each-ref"), "", "nothing pushed elsewhere");
});

// AR0390: neither the base's push nor the branch's fetch takes LFS objects, so a Git LFS project's branch would come back without them.
test("a Git LFS project, a .gitattributes in any folder of its base or of a spawn's fetch naming filter=lfs, is refused on another machine before any SSH step", async () => {
	const agent = fakeAgent({ steps: [{ message: "Done." }] });
	const { root, home, there, jobs } = setup({ agent });
	const add = (path: string, text: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
		git(root, "add", path);
		commit(root, path);
		return git(root, "rev-parse", "HEAD");
	};
	const refused = (commitId: string) => ({ message: `machine gpu: a .gitattributes of ${commitId.slice(0, 7)} names filter=lfs: acme is a Git LFS project, whose jobs run on local only, as its LFS objects do not go to another machine and back (docs/deploy.md)` });
	add(".gitattributes", "*.png binary\n");
	git(root, "checkout", "--quiet", "-b", "side");
	const art = add("art/.gitattributes", "*.psd filter=lfs diff=lfs merge=lfs -text\n");
	git(root, "checkout", "--quiet", "main");
	await assert.rejects(jobs.spawn({ task: "Review it.", machine: "gpu", fetch: art }), refused(art));
	assert.deepEqual([calls(), existsSync(join(home, "jobs")), existsSync(there)], [[], false, false], "no SSH step, no record");
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined, "a .gitattributes without filter=lfs goes there");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	const top = add(".gitattributes", "*.psd filter=lfs diff=lfs merge=lfs -text\n");
	const before = calls().length;
	await assert.rejects(jobs.spawn({ task: "Go.", machine: "gpu" }), refused(top));
	assert.equal(calls().length, before, "no SSH step");
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
		message: new RegExp(`^machine gpu: arthur is not there \\(.*arthur.*not found\\); install the version here, ${arthurVersion()} \\(docs/deploy\\.md\\)$`),
	});
	assert.deepEqual(nothing(missing.home, missing.there), [false, false, false]);

	// Only the hash, the last word, is compared: a line of the hash alone, as an Arthur before releases prints, is refused, naming both lines.
	for (const theirs of ["0123456789ab", coreVersion(), `0.1.0 0123456789ab`, `x 0.1.0 ${coreVersion()}`]) {
		const other = setup({ arthur: `#!/bin/sh\necho '${theirs}'\n` });
		await assert.rejects(other.jobs.spawn({ task: "Go.", machine: "gpu" }), { message: `machine gpu runs arthur ${theirs}, this one is ${arthurVersion()}; both need the same version` });
		assert.deepEqual(nothing(other.home, other.there), [false, false, false]);
		assert.equal(calls().length, 1, "nothing after the version");
	}
});

test("another release of the same hash there passes the version check", async () => {
	const { there, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$1" = version ] && echo '9.9.9 ${coreVersion()}' && exit 0\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await endedThere(there, job.id);
});

test("the push of a base there that has not ended 600 s on fails, naming the machine, and not 1 ms sooner", async (t) => {
	const { root, machine, there } = setup();
	const folder = temporaryFolder(), gate = join(folder, "go");
	t.after(() => writeFileSync(gate, ""));
	const real = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
	// From here `git receive-pack` there notes it began, then waits for `gate`, or 30 s; every other git there is the real one.
	const pushing = `touch '${join(folder, "pushing")}' && n=0 && while [ ! -e '${gate}' ] && [ $n -lt 300 ]; do sleep 0.1; n=$((n + 1)); done`;
	writeFileSync(join(machine, "bin/git"), `#!/bin/sh\n[ "$3" = receive-pack ] && ${pushing}\nexec '${real}' "$@"\n`, { mode: 0o755 });
	// Fake time: 600 s cannot pass for real in a test. The ssh steps before the push end on their own, without a timer.
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const began = watch(folder);
	let said = "";
	void reach({ name: "gpu", ssh: "gpu", home: there, labels: {} }, "acme", root, git(root, "rev-parse", "HEAD")).then(() => (said = "resolved"), (error: Error) => (said = error.message));
	for await (const { filename } of began) if (filename === "pushing") break;
	t.mock.timers.tick(599_999);
	await nextTurn();
	assert.equal(said, "", "still pushing 1 ms before its limit");
	t.mock.timers.tick(1);
	await nextTurn();
	assert.equal(said, "machine gpu: git push: timed out after 600 s");
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

test("an ssh step there that does not end within its limit, or answers more than 1 MiB, fails as a machine that does not answer, naming the step", async () => {
	const { there } = setup();
	const gpu = { name: "gpu", ssh: "gpu", home: there, labels: {} };
	const [late, started] = ["machine gpu: ssh gpu: exec sleep 30: timed out after 0.5 s", Date.now()];
	assert.throws(() => ssh(gpu, ["exec", "sleep", "30"], "", 0.5), { message: late, cause: 255 });
	await assert.rejects(sshAsync(gpu, ["exec", "sleep", "30"], "", 0.5), { message: late, cause: 255 });
	assert.ok(Date.now() - started < 5000, `both gave up after ${Date.now() - started} ms`);
	assert.throws(() => ssh(gpu, ["head", "-c", "2000000", "/dev/zero"]), { message: "machine gpu: ssh gpu: head -c 2000000: answered more than 1048576 bytes", cause: 255 });
	await assert.rejects(sshAsync(gpu, ["head", "-c", "2000000", "/dev/zero"]), { message: "machine gpu: ssh gpu: head -c 2000000: answered more than 1048576 characters", cause: 255 });
});

test("a spawn's step there and the sweep's fetch of an ended job's branch that do not end within 60 s fail, naming the machine and the step, the process answering meanwhile", async (t) => {
	const gate = join(temporaryFolder(), "go");
	t.after(() => writeFileSync(gate, ""));
	const { root, home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, job.id);
	// From here `arthur version` and `git-upload-pack` there note they began, then do not end before `gate` exists, or 90 s on;
	// every other step is this core's.
	const folder = temporaryFolder();
	const wait = (name: string) => `{ touch '${join(folder, name)}'; n=0; while [ ! -e '${gate}' ] && [ $n -lt 900 ]; do sleep 0.1; n=$((n + 1)); done; }`;
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$1" = version ] && ${wait("version")}\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	writeFileSync(join(machine, "bin/git-upload-pack"), `#!/bin/sh\n${wait("fetch")}\nexec git upload-pack "$@"\n`, { mode: 0o755 });
	// Fake time: 60 s need not pass for real. The test's own watch, answered while both steps wait, shows the event loop free.
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const began = watch(folder), seen = new Set<string>();
	const said = (result: PromiseSettledResult<unknown>) => (result.status === "rejected" ? (result.reason as Error).message : "resolved");
	let done = false;
	const both = Promise.allSettled([jobs.spawn({ task: "Go.", machine: "gpu" }), jobs.sweep()]).finally(() => (done = true));
	for await (const { filename } of began) if (seen.add(filename ?? "").has("version") && seen.has("fetch")) break;
	t.mock.timers.tick(59_999);
	await nextTurn();
	assert.equal(done, false, "both still wait 1 ms before their limit");
	t.mock.timers.tick(1);
	const [spawned, swept] = (await both).map(said);
	t.mock.timers.reset();
	assert.deepEqual([spawned, swept], ["machine gpu: ssh gpu: arthur version: timed out after 60 s", `machine gpu: job ${job.id}: git fetch: timed out after 60 s`]);
	assert.deepEqual([readdirSync(join(home, "jobs")), read(home, job.id, "state"), git(root, "branch", "--list", job.branch ?? "")], [[job.id], "working", ""]);
	// The next sweep tries the fetch again.
	rmSync(join(machine, "bin/git-upload-pack"));
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), git(root, "branch", "--list", job.branch ?? "")], ["ended", job.branch]);
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

test("arthur version prints the release, the core's package.json version, and the hash of its source, without a config", () => {
	const run = spawnSync(process.execPath, [CLI, "version"], { cwd: temporaryFolder(), encoding: "utf8" });
	const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	assert.deepEqual([run.status, run.stdout, arthurVersion()], [0, `${version} ${coreVersion()}\n`, `${version} ${coreVersion()}`]);
	assert.match(run.stdout, /^\d+\.\d+\.\d+ [0-9a-f]{12}\n$/);
});
