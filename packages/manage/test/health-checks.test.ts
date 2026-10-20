import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { JobRecord, Ticket } from "@arthur/core/plugin";
import { temporaryFolder } from "@arthur/core/testing";
import { diskLines, HOUR_MS, type Space, stalledTickets, uncommittedBoard, unpushed } from "../src/health-checks.ts";

// Manage's own checks, each on its own: the tickets and jobs as the host lists them, real Git repositories in the kit's
// folders, and the filesystem's numbers as statfs answers them.

const NOW = Date.parse("2026-01-01T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const PATH = "spec/features/AC0001-shop/ticket.md";
const ticket = (status: Ticket["status"], minutes: number, more: Partial<Ticket> = {}): Ticket => ({ id: "AC0001", title: "Shop", status, path: PATH, updated: ago(minutes), project: "acme", ...more });
const job = (id: string, minutes: number, more: Partial<JobRecord> = {}): JobRecord => ({
	id,
	kind: "worker",
	project: "acme",
	state: "ended",
	reason: "finished",
	hold: "",
	since: ago(minutes),
	branch: `arthur/${id}`,
	machine: "local",
	cost: "0.5",
	budget: "2",
	tickets: [PATH],
	seconds: 600,
	...more,
});

test("a ticket in-progress or in review with no job in a run for an hour is stalled, counted from its move or its last job", () => {
	assert.deepEqual(stalledTickets([ticket("in-progress", 150)], [], [], NOW), ["AC0001 is in-progress with no job in a run for 2 h: Shop"]);
	assert.deepEqual(stalledTickets([ticket("review", 60)], [], [], NOW), ["AC0001 is review with no job in a run for 1 h: Shop"], "exactly an hour");
	assert.deepEqual(stalledTickets([ticket("in-progress", 59)], [], [], NOW), [], "59 minutes");
	assert.deepEqual(stalledTickets([ticket("in-progress", 300)], [job("j1", 30)], [], NOW), [], "its job ended 30 minutes ago");
	assert.deepEqual(stalledTickets([ticket("in-progress", 300)], [job("j1", 400), job("j2", 90)], [], NOW), ["AC0001 is in-progress with no job in a run for 1 h: Shop"], "from its newest job");
	assert.deepEqual(stalledTickets([ticket("in-progress", 300)], [job("j1", 300, { state: "working" })], ["j1"], NOW), [], "a job in a run");
});

test("a stalled check skips the statuses no job works on, and counts no job of another project or ticket", () => {
	for (const status of ["planning", "planned", "done", "merged", "dropped"] as const) assert.deepEqual(stalledTickets([ticket(status, 600)], [], [], NOW), [], status);
	const others = [job("j1", 300, { project: "shop" }), job("j2", 300, { tickets: ["spec/features/AC0002-other/ticket.md"] })];
	assert.deepEqual(stalledTickets([ticket("in-progress", 600)], others, ["j1", "j2"], NOW), ["AC0001 is in-progress with no job in a run for 10 h: Shop"]);
	assert.deepEqual(stalledTickets([ticket("in-progress", 600)], [job("j1", 300, { tickets: [`./${PATH}`] })], ["j1"], NOW), [], "the same path written ./");
});

// A repository with `origin`, a bare one, its main pushed; each commit made at `when`.
function repository() {
	const root = temporaryFolder();
	const [work, origin] = [join(root, "acme"), join(root, "origin.git")];
	const git = (at: string, when: string, ...args: string[]) =>
		execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } }).trim();
	execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin]);
	mkdirSync(work);
	git(work, ago(600), "init", "--quiet", "--initial-branch=main");
	const commit = (when: string, file: string) => {
		writeFileSync(join(work, file), file);
		git(work, when, "add", "--all");
		git(work, when, "commit", "--quiet", "-m", file);
	};
	commit(ago(600), "README.md");
	git(work, ago(600), "remote", "add", "origin", origin);
	git(work, ago(600), "push", "--quiet", "--set-upstream", "origin", "main");
	return { project: { name: "acme", path: work, prefix: "AC" }, git: (...args: string[]) => git(work, ago(0), ...args), commit };
}

test("main ahead of its upstream for an hour is not pushed, by its own oldest commit; pushed, it is not", () => {
	const { project, git, commit } = repository();
	assert.deepEqual(unpushed(project, NOW), [], "pushed");
	commit(ago(59), "a.md");
	assert.deepEqual(unpushed(project, NOW), [], "59 minutes");
	commit(ago(10), "b.md");
	assert.deepEqual(unpushed(project, NOW + 60_000), ["acme: main has 2 commits not pushed to origin/main, the oldest made 1 h ago"]);
	git("push", "--quiet");
	assert.deepEqual(unpushed(project, NOW), []);
	// A branch of old commits merged now: main's own commit is the merge.
	git("checkout", "--quiet", "-b", "old");
	commit(ago(500), "old.md");
	git("checkout", "--quiet", "main");
	git("merge", "--quiet", "--no-ff", "-m", "merge", "old");
	assert.deepEqual(unpushed(project, NOW), [], "the merge was just made");
	assert.deepEqual(unpushed(project, NOW + 2 * HOUR_MS), ["acme: main has 1 commit not pushed to origin/main, the oldest made 2 h ago"]);
});

test("nothing to push to is no line: a branch without an upstream, a detached HEAD, a folder that is no repository", () => {
	const { project, git, commit } = repository();
	commit(ago(300), "a.md");
	git("checkout", "--quiet", "--detach");
	assert.deepEqual(unpushed(project, NOW), [], "detached");
	git("checkout", "--quiet", "-b", "local");
	assert.deepEqual(unpushed(project, NOW), [], "no upstream");
	assert.deepEqual(unpushed({ ...project, path: temporaryFolder() }, NOW), []);
});

test("the board's changes not committed for an hour, by its oldest file's time, untracked tickets included; a deletion has no time", () => {
	const { project, git, commit } = repository();
	mkdirSync(join(project.path, "spec/features/AC0001-shop"), { recursive: true });
	commit(ago(600), "spec/build.json");
	const now = Date.now();
	const touch = (path: string, minutes: number) => {
		writeFileSync(join(project.path, path), `${minutes}\n`);
		const at = new Date(now - minutes * 60_000);
		utimesSync(join(project.path, path), at, at);
	};
	assert.deepEqual(uncommittedBoard(project, now), [], "clean");
	touch("README.md", 600);
	assert.deepEqual(uncommittedBoard(project, now), [], "a change outside the board");
	touch("spec/build.json", 59);
	assert.deepEqual(uncommittedBoard(project, now), [], "59 minutes");
	touch("spec/features/AC0001-shop/ticket.md", 125);
	assert.deepEqual(uncommittedBoard(project, now), ["acme: the board has changes not committed for 2 h: spec/features/AC0001-shop/ticket.md and 1 more"]);
	git("checkout", "--quiet", "--", "spec/build.json");
	rmSync(join(project.path, "spec/features"), { recursive: true });
	git("rm", "--quiet", "--cached", "spec/build.json");
	rmSync(join(project.path, "spec/build.json"));
	assert.deepEqual(uncommittedBoard(project, now), [], "a deletion alone");
	assert.throws(() => uncommittedBoard({ ...project, path: temporaryFolder() }, now), { message: /^git status failed in / });
});

const space = (more: Partial<Space> = {}): Space => ({ blocks: 1000, bavail: 500, bsize: 4_000_000, files: 1000, ffree: 500, ...more });

test("the temporary folder with under 10% of its space free is full, and a filesystem with under 10% of its inodes free is low", () => {
	const [temp, home] = [temporaryFolder(), temporaryFolder()];
	assert.deepEqual(diskLines(temp, [home], () => space()), []);
	assert.deepEqual(diskLines(temp, [home], () => space({ bavail: 100, ffree: 100 })), [], "exactly 10%");
	assert.deepEqual(diskLines(temp, [], () => space({ bavail: 99 })), [`the temporary folder ${temp} has 9% of its space free: 0.4 GB`]);
	assert.deepEqual(diskLines(temp, [], () => space({ ffree: 31 })), [`${temp}: 3% of its filesystem's inodes free, 31 of 1000`]);
	assert.deepEqual(diskLines(temp, [], () => space({ blocks: 0, bavail: 0, files: 0, ffree: 0 })), [], "a filesystem that counts neither");
});

test("each filesystem's inodes are told once, by the first folder on it; a folder that does not exist is skipped", () => {
	const [temp, home] = [temporaryFolder(), temporaryFolder()];
	const asked: string[] = [];
	const low = (path: string) => (asked.push(path), space({ ffree: 1 }));
	assert.deepEqual(diskLines(temp, [join(home, "gone"), home, home], low), [`${temp}: 0% of its filesystem's inodes free, 1 of 1000`]);
	assert.deepEqual(asked, [temp], "the kit's folders share one filesystem, asked once");
});
