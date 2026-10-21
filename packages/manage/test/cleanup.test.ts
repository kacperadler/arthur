import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, lutimesSync, mkdirSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { cleanup } from "../src/cleanup.ts";
import { type ManageOptions, manage } from "../src/manage.ts";

// The daily cleanup of `prune.keepJobsDays` against the fake host, the test providing `schedule.register` as the schedule
// plugin would: old ended jobs freed by the core's prune, and the `arthur-*` folders of a temporary folder of the test's own.

const NOW = new Date("2026-10-21T03:00:00Z");
const DAY = 86_400_000;
const UID = process.getuid?.() ?? -1;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", cwd, ...args], { encoding: "utf8" });

// A repository with one commit, `acme` in a folder of its own, its jobs' worktrees beside it.
function repository(): string {
	const root = join(temporaryFolder(), "acme");
	git(dirname(root), "init", "--quiet", "--initial-branch=main", root);
	git(root, "commit", "--quiet", "--allow-empty", "-m", "first");
	return root;
}

// Manage set up with `options` at NOW; `entries` what it registered with the schedule, `printed` what its run printed. The
// run sweeps `os.tmpdir()`, so `TMPDIR` points at `temp`, a folder of the test's own, until the test ends: a run never
// touches the system's temporary folder, where other processes' `arthur-*` folders are.
async function load(t: TestContext, options: ManageOptions) {
	const [temp, before] = [temporaryFolder(), process.env.TMPDIR];
	process.env.TMPDIR = temp;
	t.after(() => (before === undefined ? delete process.env.TMPDIR : (process.env.TMPDIR = before)));
	const fake = fakeHost({ name: "manage", options, now: NOW });
	const entries: Record<string, unknown>[] = [];
	fake.provide("schedule.register", (plugin: unknown, list: Record<string, unknown>[]) => void entries.push(...list.map((entry) => ({ plugin, ...entry }))));
	await fake.setup(manage(options));
	const printed: string[] = [];
	t.mock.method(console, "log", (line: string) => printed.push(line));
	return { fake, entries, printed, temp, home: dirname(fake.host.folder) };
}

// A job record as the core writes it, its state taken at `since`.
function record(home: string, id: string, fields: Readonly<Record<string, string>>): void {
	mkdirSync(join(home, "jobs", id), { recursive: true });
	for (const [name, value] of Object.entries({ kind: "review", project: "acme", task: "Review.", root: "", worktree: "", branch: "", reason: "", ...fields })) writeFileSync(join(home, "jobs", id, name), value);
}

// A folder of `temp` last changed at `at`.
function folder(temp: string, name: string, at: Date): string {
	const path = join(temp, name);
	mkdirSync(join(path, "inside"), { recursive: true });
	writeFileSync(join(path, "inside", "file"), "x");
	utimesSync(path, at, at);
	return path;
}

test("prune.keepJobsDays registers one daily entry with the schedule, at 03:00, running manage's own code", async (t) => {
	const { entries } = await load(t, { prune: { keepJobsDays: 7 } });
	assert.deepEqual(entries.map(({ run, ...rest }) => ({ ...rest, run: typeof run })), [{ plugin: "manage", id: "prune", at: "03:00", option: "prune.keepJobsDays", run: "function" }]);
	const none = await load(t, {});
	assert.deepEqual(none.entries, [], "no prune option, no entry");
});

test("prune.keepJobsDays without the schedule plugin refuses the load, saying why; without the option nothing is asked of it", async () => {
	await assert.rejects(Promise.try(() => manage({ prune: { keepJobsDays: 7 } }).setup(fakeHost({ name: "manage", options: { prune: { keepJobsDays: 7 } } }).host)), {
		message: "prune.keepJobsDays needs the schedule plugin, which runs the daily prune; add schedule() to the config's plugins, or leave prune out",
	});
	await fakeHost({ name: "manage" }).setup(manage());
});

test("the run frees each job that ended keepJobsDays days ago or longer, as arthur prune does; a newer, running or unreadable one stays", async (t) => {
	const { entries, printed, home } = await load(t, { prune: { keepJobsDays: 7 } });
	const root = repository();
	const worktree = join(dirname(root), ".arthur-worktrees", "2026-10-01-worker-0000000a");
	git(root, "worktree", "add", "--quiet", "-b", "arthur/2026-10-01-worker-0000000a", worktree);
	const ended = { state: "ended", reason: "finished", root };
	record(home, "2026-10-01-worker-0000000a", { ...ended, kind: "worker", since: ago(20 * DAY).toISOString(), worktree, branch: "arthur/2026-10-01-worker-0000000a" });
	record(home, "2026-10-14-review-0000000b", { ...ended, since: ago(7 * DAY).toISOString() });
	record(home, "2026-10-14-review-0000000c", { ...ended, since: ago(7 * DAY - 1000).toISOString() });
	record(home, "2026-10-01-review-0000000d", { ...ended, since: "not a time" });
	record(home, "2026-10-01-review-0000000e", { state: "working", since: ago(30 * DAY).toISOString(), root });
	record(home, "2026-10-01-review-0000000f", { state: "blocked", reason: "user: which one?", since: ago(30 * DAY).toISOString(), root });
	await (entries[0]?.run as () => Promise<void>)();
	assert.deepEqual(readdirSync(join(home, "jobs")).sort(), ["2026-10-01-review-0000000d", "2026-10-01-review-0000000e", "2026-10-01-review-0000000f", "2026-10-14-review-0000000c"], "20 days and exactly 7 days ago pruned; a second under 7 days, a broken time, working and blocked kept");
	assert.deepEqual(printed.filter((line) => line.startsWith("manage: prune: ")).sort(), [
		`manage: prune: 2026-10-01-worker-0000000a: worktree ${worktree} removed; branch arthur/2026-10-01-worker-0000000a deleted; record deleted`,
		"manage: prune: 2026-10-14-review-0000000b: record deleted",
	]);
	assert.equal(existsSync(worktree), false);
	assert.equal(git(root, "branch", "--list", "arthur/*"), "");
	printed.length = 0;
	await (entries[0]?.run as () => Promise<void>)();
	assert.deepEqual(printed, [], "a second run has nothing left to free and prints nothing");
});

test("keepJobsDays 0 frees every ended job at the next run, never a running one", async (t) => {
	const { entries, home } = await load(t, { prune: { keepJobsDays: 0 } });
	const root = repository();
	record(home, "2026-10-21-review-0000000a", { state: "ended", reason: "finished", since: NOW.toISOString(), root });
	record(home, "2026-10-21-review-0000000b", { state: "idle", since: ago(DAY).toISOString(), root });
	await (entries[0]?.run as () => Promise<void>)();
	assert.deepEqual(readdirSync(join(home, "jobs")), ["2026-10-21-review-0000000b"]);
});

test("the run removes the arthur-* folders of the temporary folder older than a day, with what is inside; any other, a file or a link stays", async (t) => {
	const { entries, printed, temp } = await load(t, { prune: { keepJobsDays: 7 } });
	const outside = folder(temporaryFolder(), "kept", ago(3 * DAY));
	const paths = {
		old: folder(temp, "arthur-test-old", ago(DAY + 1000)),
		older: folder(temp, "arthur-config-test-older", ago(30 * DAY)),
		day: folder(temp, "arthur-test-day", ago(DAY)),
		fresh: folder(temp, "arthur-test-fresh", ago(60_000)),
		other: folder(temp, "h-eval-old", ago(30 * DAY)),
		file: join(temp, "arthur-file"),
		link: join(temp, "arthur-link"),
	};
	writeFileSync(paths.file, "x");
	utimesSync(paths.file, ago(30 * DAY), ago(30 * DAY));
	symlinkSync(outside, paths.link);
	lutimesSync(paths.link, ago(30 * DAY), ago(30 * DAY));
	await (entries[0]?.run as () => Promise<void>)();
	assert.deepEqual(Object.entries(paths).flatMap(([name, path]) => (existsSync(path) ? [name] : [])), ["day", "fresh", "other", "file", "link"], "a day old at most kept");
	assert.equal(existsSync(join(outside, "inside", "file")), true, "a link is never followed");
	assert.deepEqual(printed, [`manage: removed 2 temporary folders of Arthur's from ${temp}`]);
	printed.length = 0;
	await (entries[0]?.run as () => Promise<void>)();
	assert.deepEqual(printed, [], "nothing left to remove: nothing printed");
});

test("a folder made since a running job's current run began stays, however old; one older than the run goes", async (t) => {
	const { fake, home } = await load(t, {});
	const temp = temporaryFolder();
	// In a run for 3 days: 1 day in an earlier run, 2 in this one.
	record(home, "2026-10-18-worker-0000000a", { state: "working", since: ago(2 * DAY).toISOString(), ran: String(DAY / 1000) });
	const made = folder(temp, "arthur-test-made-in-the-run", ago(2 * DAY - 1000));
	const earlier = folder(temp, "arthur-test-earlier", ago(3 * DAY + 1000));
	await cleanup(fake.host, 7, temp, UID);
	assert.deepEqual([existsSync(made), existsSync(earlier)], [true, false]);
	writeFileSync(join(home, "jobs", "2026-10-18-worker-0000000a", "state"), "ended");
	await cleanup(fake.host, 7, temp, UID);
	assert.equal(existsSync(made), false, "once the run ended, the folder is only a day older than it may be");
});

test("a folder another user owns is kept with a line; one that cannot be removed whole is named with the reason; the prune still runs", { skip: UID === 0 && "root removes anything" }, async (t) => {
	const { fake, printed, home } = await load(t, {});
	const temp = temporaryFolder();
	const theirs = folder(temp, "arthur-test-theirs", ago(2 * DAY));
	assert.equal(await cleanup(fake.host, 7, temp, UID + 1), undefined);
	assert.equal(existsSync(theirs), true);
	assert.deepEqual(printed, [`manage: kept ${theirs}: user ${UID} owns it, not Arthur's user ${UID + 1}`]);
	printed.length = 0;
	const locked = folder(temp, "arthur-test-locked", ago(2 * DAY));
	chmodSync(join(locked, "inside"), 0o555);
	t.after(() => chmodSync(join(locked, "inside"), 0o755));
	utimesSync(locked, ago(2 * DAY), ago(2 * DAY));
	await cleanup(fake.host, 7, temp, UID);
	assert.equal(printed.length, 2);
	assert.equal(printed[0], `manage: removed 1 temporary folder of Arthur's from ${temp}`, "the folder kept before, its owner now Arthur's user");
	assert.match(printed[1] ?? "", new RegExp(`^manage: kept ${locked}: EACCES`));
	// The temporary folder gone: the prune still frees its job, and the run fails naming the part that did not.
	record(home, "2026-10-01-review-0000000a", { state: "ended", reason: "finished", since: ago(20 * DAY).toISOString(), root: repository() });
	await assert.rejects(cleanup(fake.host, 7, join(temp, "gone"), UID), { message: /^the temporary folders: ENOENT/ });
	assert.equal(existsSync(join(home, "jobs", "2026-10-01-review-0000000a")), false);
});
