import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
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

test("install runs in the new worktree: the project's own command, else the lockfile's frozen install", async () => {
	writeFileSync(calls, "");
	const [own, locked] = [repository(), repository({ "bun.lock": "{}" })];
	const fake = await load([{ name: "own", prefix: "OW", path: own, install: "touch installed" }, { name: "locked", prefix: "LO", path: locked }]);
	const first = await fake.host.jobs.spawn({ task: "Build it." });
	assert.equal(existsSync(join(first.worktree, "installed")), true);
	assert.equal(existsSync(join(own, "installed")), false, "not in the main checkout");
	const second = await fake.host.jobs.spawn({ task: "Build it.", project: "locked" });
	assert.deepEqual([second.project, called()], ["locked", [`${second.worktree} bun install --frozen-lockfile`]]);
	assert.equal(git(second.worktree, "rev-parse", "HEAD"), git(locked, "rev-parse", "HEAD"), "it starts from that project's HEAD");
});

test('install: "" and no lockfile run nothing', async () => {
	writeFileSync(calls, "");
	const fake = await load([{ name: "off", prefix: "OF", path: repository({ "package-lock.json": "{}" }), install: "" }, { name: "bare", prefix: "BA", path: repository() }]);
	await fake.host.jobs.spawn({ task: "Go." });
	await fake.host.jobs.spawn({ task: "Go.", project: "bare" });
	assert.deepEqual(called(), []);
});

test("the install runs with the PATH a prepare before it returned, as the nvm plugin's Node first; without one, Arthur's own", async () => {
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
	path = undefined;
	const plain = await fake.host.jobs.spawn({ task: "Go." });
	assert.deepEqual(called(), [`${job.worktree} npm ci on v22.1.0`, `${plain.worktree} npm ci`]);
});

test("a read-only kind installs too, in its detached checkout", async () => {
	writeFileSync(calls, "");
	const fake = await load([{ name: "shop", prefix: "SH", path: repository({ "package-lock.json": "{}" }) }]);
	fake.host.jobs.registerKind({ name: "review", readOnly: true, role: "worker" });
	const job = await fake.host.jobs.spawn({ task: "Review it.", kind: "review" });
	assert.deepEqual([job.branch, called()], [undefined, [`${job.worktree} npm ci`]]);
});

test("a failing install refuses the spawn, naming the project and the command; no worktree or record is left", async (t) => {
	writeFileSync(calls, "");
	writeFileSync(join(bin, "fail"), "");
	t.after(() => rmSync(join(bin, "fail"), { force: true }));
	const root = repository({ "bun.lock": "{}" });
	const fake = await load([{ name: "shop", prefix: "SH", path: root }]);
	await assert.rejects(fake.host.jobs.spawn({ task: "Go." }), {
		message: "plugin projects: prepare failed: project shop: install `bun install --frozen-lockfile` exited 1: lockfile is out of date; the job's worktree and record were removed",
	});
	const [line = ""] = called();
	const worktree = line.split(" ")[0] ?? "";
	assert.equal(existsSync(worktree), false);
	assert.equal(existsSync(record(fake, worktree.split("/").at(-1) ?? "")), false);
	assert.equal(git(root, "branch", "--list"), "* main");
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
