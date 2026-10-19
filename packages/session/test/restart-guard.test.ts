import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type SessionOptions, session } from "../src/session.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { encoding: "utf8" }).trim();

// A repository laid out as Arthur's checkout: the core, the session plugin and telegram, each with code, docs and tests.
function checkout(name: string): string {
	const root = join(temporaryFolder(), name);
	for (const file of ["packages/core/src/host.ts", "packages/session/src/session.ts", "packages/session/docs/session.md", "packages/session/test/session.test.ts", "packages/telegram/src/telegram.ts", "README.md"]) {
		mkdirSync(join(root, dirname(file)), { recursive: true });
		writeFileSync(join(root, file), "one\n");
	}
	git(dirname(root), "init", "--quiet", "--initial-branch=main", root);
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	return root;
}

// A ticket's branch that changes `files`, merged into main as `h merge` and `arthur merge` do; the merge's short hash.
function merge(root: string, id: string, files: readonly string[]): string {
	git(root, "switch", "--quiet", "-c", id);
	for (const file of files) writeFileSync(join(root, file), `${id}\n`);
	git(root, "commit", "--quiet", "--all", "-m", `feat(${id}): change`);
	git(root, "switch", "--quiet", "main");
	git(root, "merge", "--quiet", "--no-ff", "-m", `Merge ${id}: a change`, id);
	return git(root, "rev-parse", "--short", "HEAD");
}

// The session plugin on a fake host whose code is the core and the session package of `arthur` (telegram disabled: not in
// `host.code`), started as `arthur run` starts it at 08:41 in Warsaw; its jobs start in `project`, Arthur's own by default.
async function load(t: TestContext, arthur: string, options: SessionOptions = {}, project = arthur) {
	const code = ["core", "session"].map((name) => join(arthur, "packages", name));
	const fake = fakeHost({ name: "session", options: { compactAt: [], ...options }, timeZone: "Europe/Warsaw", now: new Date("2026-10-18T06:41:00Z"), root: project, code });
	const plugin = session({ compactAt: [], ...options });
	await fake.setup(plugin);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	const loaded = git(arthur, "rev-parse", "--short", "HEAD");
	return {
		fake,
		plugin,
		since: `since arthur run started 2026-10-18 08:41 at ${loaded}`,
		// The spawn's refusal, or `started` once the checks let it start.
		spawn: (ignoreRestart?: boolean) => fake.host.jobs.spawn({ task: "Go.", kind: "worker", ignoreRestart }).then(() => "started", (error: Error) => error.message),
		context: () => fake.host.collectEach<string>("coordinator.context").map((answer) => ("error" in answer ? `failed: ${answer.error.message}` : answer.value)),
	};
}

const due = (merges: string, since: string) => `refused by session: restart due: ${merges} changed Arthur's code ${since}; restart arthur run once no job runs, or pass --ignore-restart`;
const dueLine = (merges: string, since: string) =>
	`Restart: due, ${merges} changed Arthur's code ${since}. Every spawn and continue is refused, unless --ignore-restart, until arthur run starts again (the service: systemctl --user restart arthur, or /restart, which ends it) once no job runs.`;

test("a merge that changed the code arthur run loaded refuses every spawn, unless --ignore-restart, and the context says so; nothing before", async (t) => {
	const arthur = checkout("arthur");
	const box = await load(t, arthur);
	assert.deepEqual(box.context(), [`Restart: none due; no commit changed Arthur's code ${box.since}.`]);
	assert.equal(await box.spawn(), "started");
	merge(arthur, "AR0002", ["packages/session/src/session.ts"]);
	git(arthur, "commit", "--quiet", "--allow-empty", "-m", "chore(board): AR0002 merged");
	writeFileSync(join(arthur, "packages/core/src/host.ts"), "direct\n");
	git(arthur, "commit", "--quiet", "--all", "-m", "fix(core): a direct commit");
	const direct = git(arthur, "rev-parse", "--short", "HEAD");
	assert.equal(await box.spawn(), due(`AR0002, ${direct}`, box.since));
	assert.equal(await box.spawn(false), due(`AR0002, ${direct}`, box.since));
	assert.deepEqual(box.context(), [dueLine(`AR0002, ${direct}`, box.since)]);
	assert.equal(await box.spawn(true), "started");
	assert.equal(await box.spawn(), due(`AR0002, ${direct}`, box.since), "--ignore-restart lets one spawn through, not the next");
});

test("a merge of docs or tests only, or of a disabled plugin's code, does not count; one of loaded code then does", async (t) => {
	const arthur = checkout("arthur");
	const box = await load(t, arthur);
	merge(arthur, "AR0002", ["packages/session/docs/session.md", "packages/session/test/session.test.ts", "README.md"]);
	merge(arthur, "AR0003", ["packages/telegram/src/telegram.ts"]);
	assert.deepEqual(box.context(), [`Restart: none due; no commit changed Arthur's code ${box.since}.`]);
	assert.equal(await box.spawn(), "started");
	merge(arthur, "AR0004", ["packages/core/src/host.ts", "README.md"]);
	assert.equal(await box.spawn(), due("AR0004", box.since));
});

test("a plugin loaded from outside the core's checkout is not watched there", async (t) => {
	const [arthur, elsewhere] = [checkout("arthur"), checkout("elsewhere")];
	const fake = fakeHost({ name: "session", options: { compactAt: [] }, root: arthur, code: [join(arthur, "packages/core"), join(elsewhere, "packages/telegram")] });
	const plugin = session({ compactAt: [] });
	await fake.setup(plugin);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	merge(arthur, "AR0002", ["packages/telegram/src/telegram.ts"]);
	assert.equal(await fake.host.jobs.spawn({ task: "Go." }).then(() => "started"), "started");
});

test("a restart clears it: the next start of arthur run notes the code it loads", async (t) => {
	const arthur = checkout("arthur");
	const box = await load(t, arthur);
	merge(arthur, "AR0002", ["packages/session/src/session.ts"]);
	assert.equal(await box.spawn(), due("AR0002", box.since));
	box.plugin.stop?.();
	box.fake.setNow(new Date("2026-10-18T07:30:00Z"));
	await box.plugin.start?.();
	assert.equal(await box.spawn(), "started");
	const since = `since arthur run started 2026-10-18 09:30 at ${git(arthur, "rev-parse", "--short", "HEAD")}`;
	assert.deepEqual(box.context(), [`Restart: none due; no commit changed Arthur's code ${since}.`]);
});

test("a change undone since does not count; HEAD moved back before the commit noted names the commit it is at", async (t) => {
	const arthur = checkout("arthur");
	merge(arthur, "AR0002", ["packages/session/src/session.ts"]);
	const box = await load(t, arthur);
	merge(arthur, "AR0003", ["packages/core/src/host.ts"]);
	git(arthur, "revert", "--quiet", "--no-edit", "-m", "1", "HEAD");
	assert.equal(await box.spawn(), "started");
	git(arthur, "reset", "--quiet", "--hard", "HEAD~3");
	assert.equal(await box.spawn(), due(git(arthur, "rev-parse", "--short", "HEAD"), box.since));
});

test("the guard on a project other than Arthur's own does nothing: its merges never count, Arthur's own still do", async (t) => {
	const [arthur, shop] = [checkout("arthur"), checkout("shop")];
	const box = await load(t, arthur, {}, shop);
	merge(shop, "SH0001", ["packages/session/src/session.ts", "packages/core/src/host.ts"]);
	assert.equal(await box.spawn(), "started");
	assert.deepEqual(box.context(), [`Restart: none due; no commit changed Arthur's code ${box.since}.`]);
	merge(arthur, "AR0002", ["packages/session/src/session.ts"]);
	assert.equal(await box.spawn(), due("AR0002", box.since), "a job of another project is held too");
});

test("restartGuard: false refuses nothing and adds no context; Arthur outside a Git checkout guards nothing", async (t) => {
	const arthur = checkout("arthur");
	const off = await load(t, arthur, { restartGuard: false });
	merge(arthur, "AR0002", ["packages/session/src/session.ts"]);
	assert.equal(await off.spawn(), "started");
	assert.deepEqual(off.context(), []);
	assert.equal(existsSync(join(off.fake.host.folder, "loaded.json")), false);
	const bare = join(temporaryFolder(), "arthur");
	mkdirSync(join(bare, "packages", "core"), { recursive: true });
	const outside = fakeHost({ name: "session", options: { compactAt: [] }, root: arthur, code: [join(bare, "packages", "core")] });
	const plugin = session({ compactAt: [] });
	await outside.setup(plugin);
	writeFileSync(join(outside.host.folder, "loaded.json"), "{}");
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	assert.equal(existsSync(join(outside.host.folder, "loaded.json")), false, "a note of an earlier run is removed");
	assert.deepEqual(outside.host.collect("coordinator.context"), [undefined]);
	assert.equal(await outside.host.jobs.spawn({ task: "Go." }).then(() => "started"), "started");
});

test("a broken note, or a commit noted that is gone, refuses every spawn, naming why, until the next start notes it again", async (t) => {
	const arthur = checkout("arthur");
	const box = await load(t, arthur);
	const file = join(box.fake.host.folder, "loaded.json");
	for (const text of ["{ torn", "{}", JSON.stringify({ root: arthur, commit: "HEAD", at: "2026-10-18T06:41:00Z", paths: ["packages/core/src"] })]) {
		writeFileSync(file, text);
		const broken = `${file} is not what arthur run notes at its start; it is noted again at the next start`;
		assert.equal(await box.spawn(), `plugin session: beforeSpawn failed: ${broken}`);
		assert.deepEqual(box.context(), [`failed: ${broken}`]);
	}
	const gone = "0".repeat(40);
	writeFileSync(file, JSON.stringify({ root: arthur, commit: gone, at: "2026-10-18T06:41:00Z", paths: ["packages/core/src"] }));
	assert.equal(await box.spawn(), `plugin session: beforeSpawn failed: git diff in ${arthur}: fatal: bad object ${gone}`);
	assert.equal(await box.spawn(true), "started");
	box.plugin.stop?.();
	await box.plugin.start?.();
	assert.equal(await box.spawn(), "started");
});
