import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { readEvents } from "../src/event-log.ts";
import { fakeAgent, temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const LOCK = join(import.meta.dirname, "..", "src", "lock.ts");
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// Each entry under `folder`, itself included, whose mode lets the group or others in, with that mode in octal.
const open = (folder: string) =>
	[folder, ...readdirSync(folder, { recursive: true, encoding: "utf8" }).map((path) => join(folder, path))]
		.map((path) => [path, (lstatSync(path).mode & 0o777).toString(8)] as const)
		.filter(([, mode]) => !mode.endsWith("00"));

test("under umask 022 every file and folder an arthur command and its job write is its user's alone: the record, the logs, a lock and the worktree", async (t) => {
	const mask = process.umask(0o022);
	t.after(() => process.umask(mask));
	const root = join(temporaryFolder(), "acme");
	mkdirSync(root);
	writeFileSync(join(root, ".gitignore"), ".arthur/\n");
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const agent = fakeAgent({ steps: [{ message: "Built it.", cost: 0 }] });
	// A lock the plugin takes at each load and never releases, so its file stays to be looked at.
	const setup = `setup(host) { takeLock(join(host.folder, "held.lock")); }`;
	writeFileSync(join(root, "arthur.config.ts"), `import { join } from "node:path";\nimport { takeLock } from ${JSON.stringify(LOCK)};\nexport default { core: { timeZone: "UTC", agent: { command: ${JSON.stringify(agent)} } }, plugins: [{ name: "orchestration", ${setup} }] };\n`);
	const home = join(root, ".arthur");
	const spawned = spawnSync(process.execPath, [CLI, "spawn", "Build it."], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	assert.equal(spawned.status, 0, spawned.stderr);
	const id = spawned.stdout.trim();
	for (const start = Date.now(); !readEvents(home, 1).some((event) => event.name === "job-ended"); await sleep(20)) if (Date.now() - start > 20_000) assert.fail("the job did not end");
	const record = join(home, "jobs", id);
	const worktree = readFileSync(join(record, "worktree"), "utf8");
	for (const path of [join(record, "task"), join(record, "log"), join(home, "events.jsonl"), join(home, "wrapper.log"), join(home, "orchestration", "held.lock"), join(worktree, ".gitignore")])
		assert.equal((lstatSync(path).mode & 0o777).toString(8), "600", path);
	assert.deepEqual([...open(home), ...open(dirname(worktree))], [], "the home, and .arthur-worktrees with the job's worktree");
});
