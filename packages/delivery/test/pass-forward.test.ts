import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { startWait } from "../src/ci-wait.ts";
import { fakeMerge, forwarded, load, OTHER, told } from "./review-setup.ts";

// A PASS forwarded in arthur run (review-setup.ts): the merge it starts, and a merge that died half done.

test("in arthur run with autoMerge on, a PASS and then CI passed on a waiting branch each run arthur merge --auto as a child and wake the coordinator once with what it printed; a repeated end runs none, nor a PASS without autoMerge", async (t) => {
	const merge = fakeMerge(t);
	const { fake, worker, review, setAutoMerge } = await load(t, { start: true });
	const off = await worker();
	const unmerged = await review("Clean.\n\nPASS", off.id);
	assert.match(String(fake.collect("coordinator.wake", { id: unmerged.id, kind: "review" })[0]), /File it: arthur ticket file AC0001 /, "without autoMerge the coordinator files it");
	assert.equal(await forwarded(fake.host.folder, off.id), "", "and no merge runs");
	setAutoMerge(true);
	const job = await worker(`Ticket: ${OTHER}`);
	merge.answer("merged arthur/x into main: 1a2b3c4\n\n# After a merge that went in\n", "", 0);
	const passed = await review("Clean.\n\nPASS", job.id);
	await until("the coordinator woken", () => told(fake).length === 1);
	assert.deepEqual(merge.asked(), [["--auto", job.id]]);
	const ran = `acme merges on its own (autoMerge), so delivery ran arthur merge --auto ${job.id}`;
	assert.deepEqual(told(fake), [`Review ${passed.id} says PASS on AC0002, ${job.branch} at ${job.commit.slice(0, 7)}. ${ran}: it went in; follow the procedure it printed last. What it printed:\n\nmerged arthur/x into main: 1a2b3c4\n\n# After a merge that went in`]);
	assert.match(String(fake.collect("coordinator.wake", { id: passed.id, kind: "review" })[0]), new RegExp(`moves to done\\. acme merges on its own \\(autoMerge\\): delivery runs arthur merge --auto ${job.id}, `));
	fake.emit("job-ended", { id: passed.id, state: "ended" });
	assert.equal(await forwarded(fake.host.folder, job.id), `${passed.id}\n`, "the repeated end runs no second merge");
	// CI passed on the branch a refused --auto left waiting: the merge runs again, its refusal one wake.
	merge.answer("", "arthur merge: --auto merges no held path: x changes roles/a.md (a role); its merge waits for the owner: arthur merge x --decision <the owner's decision id>; main is unchanged\n", 1);
	startWait(fake.host, { job: job.id, project: "acme", branch: job.branch, tip: job.commit, own: 1 });
	const run = { id: 7, attempt: 1, sha: job.commit, branch: job.branch, status: "completed", conclusion: "success", url: "https://github.com/acme/shop/actions/runs/7", startedAt: "2026-01-01T00:00:00Z", below: 0 };
	assert.deepEqual(fake.collect("delivery.ciEnded", { project: "acme", branch: job.branch, below: 0, run }), [true]);
	await until("the coordinator woken again", () => told(fake).length === 2);
	assert.deepEqual(merge.asked(), [["--auto", job.id], ["--auto", job.id]]);
	assert.equal(
		told(fake)[1],
		`CI passed on ${job.branch} (run 7, attempt 1, on ${job.commit.slice(0, 7)}): ${run.url}. ${ran}: exit 1, it did not go in; act on its last line as arthur merge --help, "What the coordinator does with the result", says. What it printed:\n\narthur merge: --auto merges no held path: x changes roles/a.md (a role); its merge waits for the owner: arthur merge x --decision <the owner's decision id>; main is unchanged`,
	);
	// A rerun that passes, attempt 2 of the same run: its own cause, so the merge runs again and wakes the coordinator again.
	assert.deepEqual(fake.collect("delivery.ciEnded", { project: "acme", branch: job.branch, below: 0, run: { ...run, attempt: 2 } }), [true]);
	assert.equal(await forwarded(fake.host.folder, job.id), `${passed.id}\nci 7/1\nci 7/2\n`, "each run attempt is a cause of its own");
	await until("the coordinator woken a third time", () => told(fake).length === 3);
	assert.equal(merge.asked().length, 3);
	assert.match(told(fake)[2] ?? "", new RegExp(`^CI passed on ${job.branch} \\(run 7, attempt 2, `));
});

test("a no review of arthur review-needed, in its own process, is merged by arthur run once it starts, with one wake; the same answer again runs none", async (t) => {
	const merge = fakeMerge(t);
	const { fake, worker, setAutoMerge, plugin } = await load(t);
	setAutoMerge(true);
	const job = await worker(undefined, "notes.md");
	merge.answer("", "arthur merge: --auto merges only with CI passed on the branch: no run built the tip yet; it waits: when that run ends, the coordinator is woken with its verdict; main is unchanged\n", 1);
	const needed = async () => {
		const out: string[] = [];
		t.mock.method(console, "log", (text: string) => out.push(text));
		await fake.commands.find((each) => each.name === "review-needed")?.run({ args: [job.id], project: undefined });
		t.mock.restoreAll();
		return out.join("\n");
	};
	assert.equal(await needed(), `no review: 1 file, all docs (*.md)\nAC0001 moves to done.\nacme merges on its own (autoMerge): arthur run runs arthur merge --auto ${job.id} and wakes you with what it printed; nothing to do until then.`);
	assert.equal(await forwarded(fake.host.folder, job.id), "", "a process arthur run did not start runs no merge");
	await plugin.start?.();
	await until("the coordinator woken", () => told(fake).length === 1);
	assert.deepEqual(merge.asked(), [["--auto", job.id]]);
	assert.match(told(fake)[0] ?? "", new RegExp(`^arthur review-needed answered no review for AC0001, ${job.branch} at ${job.commit.slice(0, 7)}\\. acme merges on its own \\(autoMerge\\), so delivery ran arthur merge --auto ${job.id}: exit 1, it did not go in; .*What it printed:\n\narthur merge: --auto merges only with CI passed on the branch: no run built the tip yet; `));
	await needed();
	assert.equal(await forwarded(fake.host.folder, job.id), `no review ${job.commit}\n`, "the same answer on the same tip runs no second merge");
	// An event of another shape, or naming no job, as a hand-written line in the log could: nothing runs.
	fake.emit("no-review", { id: job.id, project: "acme", ticket: "AC0001", branch: job.branch });
	for (const id of ["../outside", "--unreviewed"]) fake.emit("no-review", { id, project: "acme", ticket: "AC0001", branch: job.branch, commit: "f".repeat(40) });
	assert.equal(await forwarded(fake.host.folder, job.id), `no review ${job.commit}\n`, "no commit, no merge");
	assert.deepEqual([existsSync(join(fake.host.folder, "..", "outside")), existsSync(join(fake.host.folder, "--unreviewed"))], [false, false], "an id that is no job's is never a path or a flag");
});

test("a merge delivery started outlives its arthur run: killed with its process group mid-merge, the merge ends all the same, and the next arthur run wakes the coordinator once with what it printed", async (t) => {
	const merge = fakeMerge(t);
	const { fake, worker, setAutoMerge, plugin } = await load(t);
	t.after(() => plugin.stop?.());
	setAutoMerge(true);
	const job = await worker();
	const [gate, never] = [join(temporaryFolder(), "gate"), join(temporaryFolder(), "never")];
	merge.answer("merged arthur/x into main: 1a2b3c4\ngithub: pushed main to origin\n", "", 0, gate);
	// `arthur run` in a process of its own, with only what delivery's merge start reads of its host.
	const host = `{ folder: ${JSON.stringify(fake.host.folder)}, collect: () => [[{ name: "acme", pieces: { delivery: { autoMerge: true } } }]], events: { on() {}, emit() {} }, board: { projects: () => [] }, jobs: { list: () => [] } }`;
	const code = `const { passForward } = await import(${JSON.stringify(import.meta.resolve("../src/pass-forward.ts"))}); const passes = passForward(${host}); passes.start(); passes.forward("acme", ${JSON.stringify(job.id)}, "Review x says PASS.", "x"); setInterval(() => {}, 60000);`;
	const run = spawn(process.execPath, ["--input-type=module", "-e", code], { detached: true, stdio: "ignore" });
	// A test that fails midway leaves no stand-in arthur run; load kills the merges.
	t.after(() => void (run.exitCode === null && run.signalCode === null && process.kill(-(run.pid ?? 0), "SIGKILL")));
	await until("the merge started", () => merge.asked().length === 1);
	process.kill(-(run.pid ?? 0), "SIGKILL");
	await until("arthur run gone", () => run.signalCode === "SIGKILL");
	await plugin.start?.();
	assert.deepEqual(told(fake), [], "a merge still running wakes nobody yet");
	writeFileSync(gate, "");
	await until("the coordinator woken", () => told(fake).length === 1);
	const ran = `Review x says PASS. acme merges on its own (autoMerge), so delivery ran arthur merge --auto ${job.id}`;
	assert.deepEqual(told(fake), [`${ran}: it went in; follow the procedure it printed last. What it printed:\n\nmerged arthur/x into main: 1a2b3c4\ngithub: pushed main to origin`]);
	assert.deepEqual(readdirSync(join(fake.host.folder, "merge-runs")), [], "told once: its folder is gone");
	// A merge killed with its own session, before its end and before any merge commit: one wake that says so.
	merge.answer("", "", 0, never);
	fake.emit("no-review", { id: job.id, project: "acme", ticket: "AC0001", branch: job.branch, commit: "f".repeat(40) });
	await until("the second merge started", () => merge.asked().length === 2);
	const [folder = ""] = readdirSync(join(fake.host.folder, "merge-runs"));
	process.kill(-JSON.parse(readFileSync(join(fake.host.folder, "merge-runs", folder, "run.json"), "utf8")).pid, "SIGKILL");
	await until("the coordinator woken again", () => told(fake).length === 2);
	assert.match(told(fake)[1] ?? "", new RegExp(`so delivery ran arthur merge --auto ${job.id}: killed before its end, it did not go in; act on its last line .*What it printed:\n\n$`));
});

test("arthur run looks for the end of a merge an earlier one started every 5 seconds while it runs, and no more once stopped", async (t) => {
	const { fake, plugin } = await load(t);
	t.mock.timers.enable({ apis: ["setInterval"] });
	const ended = (job: string) => {
		const folder = join(fake.host.folder, "merge-runs", `${job}-x`);
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, "run.json"), JSON.stringify({ project: "acme", job, why: "Why.", pid: spawnSync("true").pid }));
		writeFileSync(join(folder, "out"), "merged\n");
		writeFileSync(join(folder, "exit"), "0\n");
	};
	await plugin.start?.();
	ended("one");
	t.mock.timers.tick(4999);
	assert.deepEqual(told(fake), []);
	t.mock.timers.tick(1);
	assert.deepEqual(told(fake), ["Why. acme merges on its own (autoMerge), so delivery ran arthur merge --auto one: it went in; follow the procedure it printed last. What it printed:\n\nmerged"]);
	await plugin.stop?.();
	ended("two");
	t.mock.timers.tick(5000);
	assert.equal(told(fake).length, 1, "stopped: no look");
});

test("arthur run's start rolls back a merge that died half done, keeping the board, removes its lock and runs it again; a live lock, a merge whose checks passed or one a remote holds, and a HEAD that is not the dead job's merge commit are left alone", async (t) => {
	const merge = fakeMerge(t);
	const { root, fake, git, worker, setAutoMerge, plugin } = await load(t);
	setAutoMerge(true);
	const job = await worker();
	const before = git(root, "rev-parse", "HEAD");
	const board = readFileSync(join(root, "spec/build.json"), "utf8");
	git(root, "-c", "user.name=t", "-c", "user.email=t@example.com", "merge", "--quiet", "--no-ff", "-m", "Merge AC0001: shop", job.branch);
	const merged = git(root, "rev-parse", "HEAD");
	merge.answer("merged again\n", "", 0);
	const own = join(fake.host.folder, "acme");
	const holder = (pid: number) => (mkdirSync(own, { recursive: true }), writeFileSync(join(own, "merge.lock"), `${pid}\n`), writeFileSync(join(own, "merging"), `${job.id}\n`));
	const dead = spawnSync("true").pid ?? 0;
	const tree = `${merged}^{tree}`;
	const side = git(root, "commit-tree", `${before}^{tree}`, "-p", before, "-m", "side");
	// Main moved to `commit`, the files of the merge kept; undone by moving it back.
	const moved = (commit: string) => () => (holder(dead), git(root, "update-ref", "refs/heads/main", commit));
	const back = () => git(root, "update-ref", "refs/heads/main", merged);
	for (const [why, set, undo] of [
		["a live holder", () => holder(process.ppid), () => assert.equal(readFileSync(join(own, "merge.lock"), "utf8"), `${process.ppid}\n`, "its lock kept")],
		["its checks passed: last-merge names it", () => (holder(dead), writeFileSync(join(own, "last-merge"), `${merged}\n`)), () => rmSync(join(own, "last-merge"))],
		["pushed: a remote branch holds it", () => (holder(dead), git(root, "update-ref", "refs/remotes/origin/main", merged)), () => git(root, "update-ref", "-d", "refs/remotes/origin/main")],
		["merging names no job", () => (holder(dead), writeFileSync(join(own, "merging"), "2026-01-01-worker-00000000\n")), () => {}],
		["a commit on top of the merge (the ticket's, or the coordinator's)", moved(git(root, "commit-tree", tree, "-p", merged, "-m", "spec: AC0001 merged")), back],
		["a merge of another branch", moved(git(root, "commit-tree", tree, "-p", before, "-p", side, "-m", "Merge side")), back],
		["a merge of three parents, the branch's tip second", moved(git(root, "commit-tree", tree, "-p", before, "-p", job.commit, "-p", side, "-m", "Merge three")), back],
	] as const) {
		set();
		const head = git(root, "rev-parse", "HEAD");
		await plugin.start?.();
		await plugin.stop?.();
		assert.deepEqual([git(root, "rev-parse", "HEAD"), merge.asked(), told(fake), existsSync(join(own, "merging"))], [head, [], [], why === "a live holder"], why);
		undo();
	}
	assert.notEqual(board, git(root, "show", "HEAD:spec/build.json"), "the board has moves main does not hold");
	// A local change to a file the merge brought: Git refuses to move the files, so main stays on the merge commit, and the coordinator is told.
	const file = join(root, `${job.id}.ts`);
	writeFileSync(file, "export const shop = 2;\n");
	holder(dead);
	await plugin.start?.();
	await plugin.stop?.();
	assert.deepEqual([git(root, "rev-parse", "HEAD"), merge.asked()], [merged, []], "refused: main and the change as they were");
	assert.equal(readFileSync(file, "utf8"), "export const shop = 2;\n");
	assert.match(told(fake)[0] ?? "", new RegExp(`^The merge of ${job.id} on acme died half done, its process gone: main still holds its merge commit ${merged.slice(0, 7)}, as git read-tree -m -u ${merged.slice(0, 7)} ${before.slice(0, 7)} refused: .+; reset main to ${before.slice(0, 7)} in ${root}, then arthur merge --auto ${job.id}$`));
	git(root, "checkout", "--", `${job.id}.ts`);
	holder(dead);
	// The merge's own run folder, as a reboot leaves it: no exit status, its process gone. Its end is the rerun, not a wake of its own.
	const killed = join(fake.host.folder, "merge-runs", `${job.id}-dead`);
	mkdirSync(killed, { recursive: true });
	writeFileSync(join(killed, "run.json"), JSON.stringify({ project: "acme", job: job.id, why: "Review x says PASS.", pid: dead }));
	writeFileSync(join(killed, "out"), `merged ${job.branch} into main: ${merged.slice(0, 7)}\n`);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	assert.deepEqual([git(root, "rev-parse", "HEAD"), readFileSync(join(root, "spec/build.json"), "utf8")], [before, board], "main at the merge's first parent, the board kept");
	assert.deepEqual([existsSync(join(own, "merge.lock")), existsSync(join(own, "merging")), existsSync(file)], [false, false, false], "the files the merge brought gone with it");
	await until("the coordinator woken", () => told(fake).length === 2);
	assert.deepEqual(merge.asked(), [["--auto", job.id]]);
	const why = `The merge of ${job.id} on acme died half done, its process gone: main went back from its merge commit ${merged.slice(0, 7)} to ${before.slice(0, 7)}, the board kept.`;
	assert.deepEqual(told(fake).slice(1), [`${why} acme merges on its own (autoMerge), so delivery ran arthur merge --auto ${job.id}: it went in; follow the procedure it printed last. What it printed:\n\nmerged again`], "one wake, the rerun's; none for the killed run");
	assert.equal(existsSync(killed), false);
});

test("a merge that died half done in a project whose autoMerge is off since is rolled back, not run again: the coordinator is told it waits for the owner's decision", async (t) => {
	const merge = fakeMerge(t);
	const { root, fake, git, worker, setAutoMerge, plugin } = await load(t);
	const job = await worker();
	const before = git(root, "rev-parse", "HEAD");
	git(root, "-c", "user.name=t", "-c", "user.email=t@example.com", "merge", "--quiet", "--no-ff", "-m", "Merge AC0001: shop", job.branch);
	const merged = git(root, "rev-parse", "HEAD");
	const own = join(fake.host.folder, "acme");
	mkdirSync(own, { recursive: true });
	writeFileSync(join(own, "merge.lock"), `${spawnSync("true").pid ?? 0}\n`);
	writeFileSync(join(own, "merging"), `${job.id}\n`);
	setAutoMerge(false);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	await until("the coordinator told", () => told(fake).length === 1);
	assert.equal(git(root, "rev-parse", "HEAD"), before);
	const why = `The merge of ${job.id} on acme died half done, its process gone: main went back from its merge commit ${merged.slice(0, 7)} to ${before.slice(0, 7)}, the board kept.`;
	assert.deepEqual(told(fake), [`${why} acme no longer merges on its own (autoMerge off): its merge waits for the owner: arthur merge ${job.id} --decision <the owner's decision id>`]);
	assert.deepEqual(merge.asked(), []);
});
