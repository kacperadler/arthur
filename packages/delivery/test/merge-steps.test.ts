import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { jobSlice, temporaryFolder } from "@arthur/core/testing";
import { FOLDER, forkingTest, load, manager, OWNER, running } from "./merge-setup.ts";

// arthur merge (merge-setup.ts): the checks on main, each step's scope, limit, install and PATH, and the sweeps after them.

test("a merge's start removes delivery's cache_ folders older than a day to the minute, as a killed merge leaves them, with what is in them; a younger one, maybe a running merge's, a project's folder named cache-*, another old folder and an old cache_ one below the top stay", async (t) => {
	const { fake, worker, merge, caches } = await load(t);
	const job = await worker({ "bun.lock": '{ "shop": 1 }\n' });
	// A folder below the top is aged before the one holding it, whose time each write in it moves.
	const aged = (name: string, seconds: number, file = join("bun", "deep", "left")) => {
		const path = join(fake.host.folder, name);
		mkdirSync(dirname(join(path, file)), { recursive: true });
		writeFileSync(join(path, file), "what was written there\n");
		const at = new Date(Date.now() - seconds * 1000);
		utimesSync(path, at, at);
		return path;
	};
	const day = 24 * 3600;
	const below = [aged(join("cache_Runnin", "cache_x"), 2 * day), aged(join("cache-shop", "cache_x"), 2 * day)];
	const [old, young, project, other] = [aged("cache_kiLLed", day + 30), aged("cache_Runnin", day - 30), aged("cache-shop", 2 * day, "last-merge"), aged("caches", 2 * day)];
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.deepEqual([old, young, project, other, ...below].map((path) => existsSync(path)), [false, true, true, true, true, true]);
	assert.match(basename(dirname(caches()[0] ?? "")), /^cache_[A-Za-z0-9]{6}$/, "the merge's own cache folder has the name the sweep removes");
});

test("each step on main runs in a scope of its own under the jobs' slice, and what it leaves running is gone once the merge printed its last line", { skip: !manager && "no systemd user manager" }, async (t) => {
	const { uncapped, sleeper, cgroup } = await forkingTest(t);
	assert.deepEqual(uncapped, []);
	assert.match(cgroup, new RegExp(`^0::/.*/${jobSlice.slice}\\.slice/arthur-merge-${process.pid}-\\d+\\.scope$`, "m"));
	assert.equal(running(sleeper), false, `the sleeper ${sleeper} still runs`);
});

test("without a user manager the steps on main run bare, which one uncapped line says, and pass as usual", async (t) => {
	const saved = { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS };
	t.after(() => Object.assign(process.env, saved));
	process.env.XDG_RUNTIME_DIR = temporaryFolder();
	delete process.env.DBUS_SESSION_BUS_ADDRESS;
	const { merged, uncapped } = await forkingTest(t);
	assert.match(merged.out, /\nbun install --frozen-lockfile: passed\.\nnpm test: passed\.\n/);
	assert.equal(uncapped.length, 1, uncapped.join("\n"));
	assert.match(uncapped[0] ?? "", /^uncapped: no systemd scope \(.+\); the steps run bare, outside the jobs' slice, and what they leave behind is not killed$/);
});

test("a failed check resets main and names it, pushing nothing; the board's moves stay, main's own install is put back over a fresh cache, nothing is written, both caches removed", async (t) => {
	const { root, fake, git, take, worker, review, merge, head, status, bun, caches, failBun, installs, uncapped } = await load(t);
	const pushes: unknown[] = [];
	fake.provide("github.push", (branch: unknown) => (pushes.push(branch), Promise.resolve("github: pushed")));
	const job = await worker({ broken: "", "bun.lock": '{ "broken": 1 }\n' });
	await review(job.id, "PASS");
	const before = head();
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, 1);
	assert.equal(merged.err, `arthur merge: check failed on main (npm test); main reset to ${before.slice(0, 7)}, branch kept`);
	assert.deepEqual(pushes, [{ project: "acme", branch: job.branch }], "the PASS pushed the branch; the failed merge pushed no main");
	assert.match(merged.out, /\nnpm test: failed, 1\/2 passed\.\n[\s\S]*ℹ pass 1\nreinstall of main's dependencies, bun install --frozen-lockfile: passed\.$/);
	assert.ok(uncapped.length <= 1, `one probe for the whole merge, the reinstall's runner included:\n${uncapped.join("\n")}`);
	assert.equal(bun(), "install --frozen-lockfile\ninstall --frozen-lockfile\n");
	assert.deepEqual(caches().map((each) => [dirname(dirname(each)), /^cache_/.test(basename(dirname(each))), existsSync(each)]), Array(2).fill([fake.host.folder, true, false]), "both caches in the plugin's folder, named as the sweep at a merge's start removes them, gone after the failed merge");
	assert.notEqual(dirname(caches()[1] ?? ""), dirname(caches()[0] ?? ""), "the reinstall's cache a fresh folder, not the one the branch's install wrote");
	const mergeCommit = git(root, "rev-parse", "ORIG_HEAD");
	assert.deepEqual(installs, [{ project: "acme", commit: "HEAD", head: mergeCommit }, { project: "acme", commit: "HEAD", head: before }], "asked again after the reset, for main's own");
	assert.equal(head(), before);
	assert.equal(existsSync(job.worktree), true, "a failed check prunes nothing");
	assert.equal(readFileSync(join(root, "bun.lock"), "utf8"), "{}\n");
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "M spec/build.json");
	assert.equal(status("AC0001"), "done", "the review's move to done is kept");
	assert.deepEqual(readdirSync(join(root, FOLDER)), ["ticket.md"], "no review filed, no outcome.md");
	assert.equal(existsSync(join(root, "CHANGELOG.md")), false, "no changelog for a merge that did not go in");
	writeFileSync(join(root, "package.json"), "{ not json");
	git(root, "commit", "--quiet", "-am", "a broken package.json");
	await take();
	assert.match((await merge(job.id, "--decision", OWNER)).err, /^arthur merge: check failed on main \(package\.json\); main reset to /);
	failBun();
	const install = await merge(job.id, "--decision", OWNER);
	assert.equal(
		install.err,
		`arthur merge: check failed on main (bun install --frozen-lockfile); main reset to ${head().slice(0, 7)}, branch kept, but reinstalling main's dependencies failed (bun install --frozen-lockfile): they still hold the branch's install`,
	);
	assert.doesNotMatch(install.out, /npm/, "a failed install ends the steps");
	assert.match(install.out, /error: lockfile had changes/);
});

test("a .git that what the checks left behind writes after their last sweep is removed after the reinstall's step, which sweeps against the merge's first look", async (t) => {
	const { root, worker, review, merge, hear } = await load(t);
	const job = await worker({ broken: "", "bun.lock": '{ "broken": 1 }\n' });
	await review(job.id, "PASS");
	// A process `npm test` left running, bare, that writes a repository once npm test's sweep is done: when its result is printed,
	// before the reinstall's runner exists, so a runner that took a look of its own then would count it as main's.
	hear((text) => void (text.startsWith("npm test: failed") && execFileSync("git", ["init", "-q", join(root, "late")])));
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, 1, merged.err);
	assert.match(merged.out, /\nremoved late\/\.git, which bun install --frozen-lockfile left: a git call in that folder would run its config outside any sandbox\nreinstall of main's dependencies, bun install --frozen-lockfile: passed\.$/);
	assert.deepEqual([existsSync(join(root, "late")), existsSync(join(root, "late", ".git"))], [true, false]);
});

test("what the branch itself commits counts as a step's to the sweep: a symlink to a folder outside the checkout and a folder holding a HEAD and a config with core.fsmonitor are removed after the first step, and main goes in; so is the owner's symlink to the plugin's folder, where the merge's caches go", async (t) => {
	const { root, fake, git, worker, review, merge } = await load(t);
	const outside = join(root, "..", "outside");
	mkdirSync(outside);
	const job = await worker({ "fixture/HEAD": "ref: refs/heads/main\n", "fixture/refs/heads/main": "", "fixture/config": "[core]\n\tfsmonitor = touch pwned\n" });
	symlinkSync(outside, join(job.worktree, "out"));
	git(job.worktree, "add", "out");
	git(job.worktree, "commit", "--quiet", "-m", "link out");
	await review(job.id, "PASS");
	// The owner's own, untracked; the temporary folder moved apart, so the plugin's folder is no folder a step writes but as the merge's caches.
	symlinkSync(fake.host.folder, join(root, "delivery"));
	const saved = process.env.TMPDIR;
	process.env.TMPDIR = join(root, "..", "tmp");
	mkdirSync(process.env.TMPDIR);
	t.after(() => void (saved === undefined ? delete process.env.TMPDIR : (process.env.TMPDIR = saved)));
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	const said = (path: string) => `removed ${path}, which bun install --frozen-lockfile left: a git call in that folder would run its config outside any sandbox`;
	assert.deepEqual(merged.out.split("\n").slice(1, 5).sort(), [said("delivery"), said("fixture"), said("out"), "bun install --frozen-lockfile: passed."].sort());
	assert.deepEqual([existsSync(join(root, "fixture")), ...["out", "delivery"].map((name) => lstatSync(join(root, name), { throwIfNoEntry: false })), git(root, "ls-tree", "--name-only", "HEAD", "out", "fixture")], [false, undefined, undefined, "fixture\nout"]);
});

// A project that declares only `test`: no `npm run check` races the short limit on a loaded host (AR0544: 3 s caught it at load
// 40); the slow step's 60 s stays far above it. `npm test` reaches the script in about 200 ms at load 6.
test("a step still running at merge.stepSeconds is killed and fails, though it ignores SIGTERM: main reset, main's own install put back", async (t) => {
	const { root, worker, review, merge, head, bun } = await load(t, { merge: { stepSeconds: 1 } });
	const noted = temporaryFolder();
	const slow = `require("node:fs").writeFileSync(${JSON.stringify(join(noted, "pid"))}, String(process.pid));\nprocess.on("SIGTERM", () => {});\nsetTimeout(() => {}, 60_000);\n`;
	const job = await worker({ "test.js": slow, "bun.lock": '{ "slow": 1 }\n', "package.json": JSON.stringify({ scripts: { test: "node test.js" } }) });
	await review(job.id, "PASS");
	const before = head();
	const started = Date.now();
	const merged = await merge(job.id, "--decision", OWNER);
	const took = Date.now() - started;
	// No pid when a host too loaded to start the script within the limit killed npm first: the limit still held.
	const pid = existsSync(join(noted, "pid")) ? Number(readFileSync(join(noted, "pid"), "utf8")) : 0;
	t.after(() => void (pid > 0 && spawnSync("kill", ["-9", String(pid)])));
	assert.equal(merged.err, `arthur merge: check failed on main (npm test); main reset to ${before.slice(0, 7)}, branch kept`);
	assert.match(merged.out, /\nnpm test: failed, timed out after 1 s\.\n[\s\S]*\nreinstall of main's dependencies, bun install --frozen-lockfile: passed\.$/);
	assert.ok(took >= 1_000, `the slow step runs its full 1 s before it is killed: the merge took ${took} ms`);
	assert.equal(bun(), "install --frozen-lockfile\ninstall --frozen-lockfile\n");
	assert.deepEqual([head(), readFileSync(join(root, "bun.lock"), "utf8")], [before, "{}\n"]);
	if (manager && pid > 0) assert.equal(running(pid), false, `the test's process ${pid} still runs`);
});

test("the install is the project's own, as projects.install answers: a custom command runs, none runs nothing though bun.lock changed, a throw fails the merge", async (t) => {
	const { root, worker, review, merge, head, status, bun, installAs } = await load(t);
	installAs("");
	const job = await worker({ "shop.ts": "export const shop = 1;\n", "bun.lock": '{ "shop": 1 }\n' });
	await review(job.id, "PASS");
	const none = await merge(job.id, "--decision", OWNER);
	assert.equal(none.code, undefined, none.err);
	assert.match(none.out, new RegExp(`^merged ${job.branch} into main: [0-9a-f]+\nnpm run check: passed\\.\nnpm test: 2/2 passed\\.\n`));
	assert.equal(bun(), "", "no install, though the merge changed bun.lock");
	installAs("bun run deps");
	const cart = "spec/features/AC0002-cart";
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, `Ticket: ${cart}/ticket.md`);
	await review(second.id, "PASS");
	const own = await merge(second.id, "--decision", OWNER);
	assert.equal(own.code, undefined, own.err);
	assert.match(own.out, new RegExp(`^merged ${second.branch} into main: [0-9a-f]+\nbun run deps: passed\\.\nnpm run check: passed\\.\n`));
	assert.equal(bun(), "run deps\n", "the project's own command, though no lockfile changed");
	assert.match(readFileSync(join(root, cart, "outcome.md"), "utf8"), /\n## Checks on main\n\n- `bun run deps`: passed\.\n/);
	const refusal = "project acme: two known lockfiles (bun.lock, package-lock.json) and no install; set install in its projects.project(...)";
	installAs(new Error(refusal));
	const pay = "spec/features/AC0003-pay";
	const third = await worker({ "pay.ts": "export const pay = 1;\n", "package-lock.json": "{}\n" }, `Ticket: ${pay}/ticket.md`);
	await review(third.id, "PASS");
	const before = head();
	const thrown = await merge(third.id, "--decision", OWNER);
	assert.equal(thrown.err, `arthur merge: check failed on main (install); main reset to ${before.slice(0, 7)}, branch kept`, "nothing ran, so nothing is reinstalled");
	assert.match(thrown.out, new RegExp(`^merged ${third.branch} into main: [0-9a-f]+\ninstall: failed, ${refusal.replace(/[()]/g, "\\$&")}\\.$`));
	assert.deepEqual([head(), bun(), status("AC0003")], [before, "run deps\n", "done"]);
});

test("with nvm.path provided, the install and checks run on its PATH, asked for main's checkout before them and again for the reinstall; a throw fails the merge", async (t) => {
	const { root, fake, git, take, worker, review, merge, head, status, installAs } = await load(t);
	// nvm's Node: a `node` that notes its arguments, then runs this Node.
	const node = temporaryFolder();
	writeFileSync(join(node, "node"), `#!/bin/sh\necho "$*" >> '${join(node, "node.log")}'\nexec '${process.execPath}' "$@"\n`, { mode: 0o755 });
	const ran = () => (existsSync(join(node, "node.log")) ? readFileSync(join(node, "node.log"), "utf8").split("\n") : []);
	const asked: unknown[] = [];
	let answer: string | Error = "";
	fake.provide("nvm.path", (request: { readonly root: string }) => {
		asked.push({ ...request, head: head() });
		if (answer instanceof Error) throw answer;
		return answer;
	});
	writeFileSync(join(root, "install.js"), 'console.log("installed");\n');
	git(root, "add", "install.js");
	git(root, "commit", "--quiet", "-m", "an install script");
	await take();
	installAs("node install.js");
	answer = `${node}${delimiter}${process.env.PATH}`;
	const job = await worker();
	await review(job.id, "PASS");
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.deepEqual(asked, [{ root, head: git(root, "rev-parse", "HEAD^") }], "asked once, for the merge commit, before the steps");
	assert.deepEqual([ran().includes("install.js"), ran().includes("-e "), ran().includes("test.js")], [true, true, true], ran().join("\n"));

	const cart = "spec/features/AC0002-cart";
	const second = await worker({ broken: "" }, `Ticket: ${cart}/ticket.md`);
	await review(second.id, "PASS");
	const before = head();
	const failing = await merge(second.id, "--decision", OWNER);
	assert.equal(failing.err, `arthur merge: check failed on main (npm test); main reset to ${before.slice(0, 7)}, branch kept`);
	assert.match(failing.out, /\nreinstall of main's dependencies, node install\.js: passed\.$/);
	assert.deepEqual(asked.slice(1), [{ root, head: git(root, "rev-parse", "ORIG_HEAD") }, { root, head: before }], "asked again for main's own after the reset");

	const refusal = `Node 99, which ${root}/.nvmrc names, is not installed on machine local; fix: nvm install 99 there`;
	answer = new Error(refusal);
	const calls = ran().length;
	const thrown = await merge(second.id, "--decision", OWNER);
	assert.equal(thrown.err, `arthur merge: check failed on main (node); main reset to ${before.slice(0, 7)}, branch kept`, "nothing ran, so nothing is reinstalled");
	assert.equal(thrown.out, `merged ${second.branch} into main: ${git(root, "rev-parse", "--short", "ORIG_HEAD")}\nnode: failed, ${refusal}.`);
	assert.deepEqual([head(), ran().length, status("AC0002")], [before, calls, "done"]);
});
