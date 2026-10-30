import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { type FakeHost, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { type ProjectEntry, projects } from "../src/projects.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const commit = (root: string, files: Readonly<Record<string, string>>) => {
	for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "change");
};

function repository(files: Readonly<Record<string, string>> = { "README.md": "# demo\n" }): string {
	const root = temporaryFolder();
	git(root, "init", "--quiet", "--initial-branch=main");
	commit(root, files);
	return root;
}

// Fake `npm` and `bun` first on `PATH`, each noting its folder and arguments in `calls`; `bun` exits 1 when `fail` exists.
const bin = temporaryFolder();
const calls = join(bin, "calls");
for (const tool of ["npm", "bun"])
	writeFileSync(join(bin, tool), `#!/bin/sh\necho "$(pwd) ${tool} $*" >> '${calls}'\n[ -e '${bin}/fail' ] && { echo 'lockfile is out of date' >&2; exit 1; }\nexit 0\n`, { mode: 0o755 });
process.env.PATH = [bin, process.env.PATH].join(delimiter);
const called = () => (existsSync(calls) ? readFileSync(calls, "utf8").split("\n").filter(Boolean) : []);

async function load(list: readonly ProjectEntry[]): Promise<FakeHost> {
	const fake = fakeHost({ name: "projects", options: { list } });
	await fake.setup(projects({ list }));
	return fake;
}

const record = (fake: FakeHost, id: string) => join(dirname(fake.host.folder), "jobs", id);
// The reason job `id` ended with, once its record says it ended: the wrapper runs the install first, then the agent, which
// fails here (the fake host's `omp` has no run).
async function ended(fake: FakeHost, id: string): Promise<string> {
	const file = (name: string) => (existsSync(join(record(fake, id), name)) ? readFileSync(join(record(fake, id), name), "utf8") : "");
	await until(`${id} to end`, () => file("state") === "ended");
	return file("reason");
}

test("install runs in the new worktree: the project's own command, else the lockfile's frozen install", async () => {
	writeFileSync(calls, "");
	const [own, locked] = [repository(), repository({ "bun.lock": "{}" })];
	const fake = await load([{ name: "own", prefix: "OW", path: own, install: "touch installed" }, { name: "locked", prefix: "LO", path: locked }]);
	const first = await fake.host.jobs.spawn({ task: "Build it." });
	await ended(fake, first.id);
	assert.equal(existsSync(join(first.worktree, "installed")), true);
	assert.equal(existsSync(join(own, "installed")), false, "not in the main checkout");
	const second = await fake.host.jobs.spawn({ task: "Build it.", project: "locked" });
	await ended(fake, second.id);
	assert.deepEqual([second.project, called()], ["locked", [`${second.worktree} bun install --frozen-lockfile`]]);
	assert.equal(git(second.worktree, "rev-parse", "HEAD"), git(locked, "rev-parse", "HEAD"), "it starts from that project's HEAD");
});

test('install: "" and no lockfile run nothing', async () => {
	writeFileSync(calls, "");
	const fake = await load([{ name: "off", prefix: "OF", path: repository({ "package-lock.json": "{}" }), install: "" }, { name: "bare", prefix: "BA", path: repository() }]);
	for (const project of ["off", "bare"]) {
		const job = await fake.host.jobs.spawn({ task: "Go.", project });
		assert.match(await ended(fake, job.id), /^failed: the agent /, "the agent started");
		assert.doesNotMatch(readFileSync(join(record(fake, job.id), "log"), "utf8"), /install/);
	}
	assert.deepEqual(called(), []);
});

test("the install runs with the PATH the prepares returned, as the nvm plugin's Node first; without one, Arthur's own", async () => {
	writeFileSync(calls, "");
	// The bin folder nvm would name: a `node` that says its version, and an `npm` that notes which node it runs on.
	const nvmBin = temporaryFolder();
	writeFileSync(join(nvmBin, "node"), "#!/bin/sh\necho v22.1.0\n", { mode: 0o755 });
	writeFileSync(join(nvmBin, "npm"), `#!/bin/sh\necho "$(pwd) npm $* on $(node --version)" >> '${calls}'\n`, { mode: 0o755 });
	const root = repository({ "package-lock.json": "{}" });
	const list = [{ name: "shop", prefix: "SH", path: root }];
	const fake = fakeHost({ name: "projects", options: { list } });
	let path: string | undefined;
	fake.host.jobs.prepare(() => (path === undefined ? undefined : { PATH: path }));
	await fake.setup(projects({ list }));
	path = [nvmBin, process.env.PATH].join(delimiter);
	const job = await fake.host.jobs.spawn({ task: "Go." });
	await ended(fake, job.id);
	path = undefined;
	const plain = await fake.host.jobs.spawn({ task: "Go." });
	await ended(fake, plain.id);
	assert.deepEqual(called(), [`${job.worktree} npm ci on v22.1.0`, `${plain.worktree} npm ci`]);
});

test("a read-only kind installs too, in its detached checkout", async () => {
	writeFileSync(calls, "");
	const fake = await load([{ name: "shop", prefix: "SH", path: repository({ "package-lock.json": "{}" }) }]);
	fake.host.jobs.registerKind({ name: "review", readOnly: true, role: "worker" });
	const job = await fake.host.jobs.spawn({ task: "Review it.", kind: "review" });
	await ended(fake, job.id);
	assert.deepEqual([job.branch, called()], [undefined, [`${job.worktree} npm ci`]]);
});

test("a continue installs nothing again: the worktree keeps its spawn's install", async () => {
	writeFileSync(calls, "");
	const fake = await load([{ name: "shop", prefix: "SH", path: repository({ "package-lock.json": "{}" }) }]);
	const job = await fake.host.jobs.spawn({ task: "Go." });
	await ended(fake, job.id);
	await fake.host.jobs.continue(job.id, "Go on.");
	assert.equal(readFileSync(join(record(fake, job.id), "continue"), "utf8"), "Go on.", "the continue went through");
	await ended(fake, job.id);
	assert.deepEqual(called(), [`${job.worktree} npm ci`]);
});

test("a failing install ends the job failed with the command and its last line, before any agent; its worktree, branch and output stay", async (t) => {
	writeFileSync(calls, "");
	writeFileSync(join(bin, "fail"), "");
	t.after(() => rmSync(join(bin, "fail"), { force: true }));
	const root = repository({ "bun.lock": "{}" });
	const fake = await load([{ name: "shop", prefix: "SH", path: root }]);
	const job = await fake.host.jobs.spawn({ task: "Go." });
	assert.equal(job.failed, undefined, "the wrapper started");
	assert.equal(await ended(fake, job.id), "failed: the agent did not start: install `bun install --frozen-lockfile` exited 1: lockfile is out of date");
	assert.deepEqual(called(), [`${job.worktree} bun install --frozen-lockfile`]);
	const log = readFileSync(join(record(fake, job.id), "log"), "utf8");
	assert.match(log, /\] install: bun install --frozen-lockfile\n(\[arthur [^\]]+\] (no )?sandbox: [^\n]*the install writes [^\n]*\n)?lockfile is out of date\n/, "the install's output follows its command, after the sandbox's line where there is one");
	assert.doesNotMatch(log, /\] agent: /, "no agent started");
	assert.equal(existsSync(job.worktree), true);
	assert.equal(git(root, "branch", "--list", `arthur/${job.id}`).replace(/^[*+]?\s*/, ""), `arthur/${job.id}`);
});

test("two lockfiles at the job's base refuse the spawn, though there was one at load", async () => {
	const root = repository({ "bun.lock": "{}" });
	const fake = await load([{ name: "shop", prefix: "SH", path: root }]);
	commit(root, { "package-lock.json": "{}" });
	await assert.rejects(fake.host.jobs.spawn({ task: "Go." }), {
		message: "plugin projects: prepare failed: project shop: two known lockfiles (bun.lock, package-lock.json) and no install; set install in its entry of arthur.config.ts; the job's worktree and record were removed",
	});
	assert.equal(git(root, "branch", "--list"), "* main");
});

test("projects.install answers the install a worktree of that commit gets: own, none, the lockfile's; two lockfiles and an unknown project throw", async () => {
	const locked = repository();
	const first = git(locked, "rev-parse", "HEAD");
	commit(locked, { "bun.lock": "{}" });
	const list = [{ name: "own", prefix: "OW", path: repository(), install: "make deps" }, { name: "off", prefix: "OF", path: repository({ "package-lock.json": "{}" }), install: "" }, { name: "locked", prefix: "LO", path: locked }];
	const fake = await load(list);
	const install = (project: string, commit: string) => fake.collect<string>("projects.install", { project, commit })[0];
	assert.deepEqual([install("own", "HEAD"), install("off", "HEAD"), install("locked", "HEAD"), install("locked", first)], ["make deps", "", "bun install --frozen-lockfile", ""]);
	commit(locked, { "package-lock.json": "{}" });
	assert.throws(() => install("locked", "HEAD"), { message: "project locked: two known lockfiles (bun.lock, package-lock.json) and no install; set install in its entry of arthur.config.ts" });
	assert.throws(() => install("gone", "HEAD"), { message: "no project gone" });
});
