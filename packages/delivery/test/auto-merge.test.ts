import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { ciWaits } from "../src/ci-wait.ts";
import { delivery } from "../src/delivery.ts";

const PATH = process.env.PATH ?? "";
const TEST_JS = 'console.log("ℹ tests 1\\nℹ pass 1");\n';
const PACKAGE = JSON.stringify({ scripts: { check: 'node -e ""', test: "node test.js" } });
const T0 = "2026-01-01T00:00:00Z";
const TICKETS = 9;

// The run that built a branch as `github.ci` answers it (the github plugin's Run of GitHub's "List workflow runs for a
// workflow", every field, with `below`).
type CiRun = { id: number; attempt: number; sha: string; branch: string; status: string; conclusion: string | null; url: string; startedAt: string | null; below: number };
const ciRun = (sha: string, branch: string, more: Partial<CiRun> = {}): CiRun => ({ id: 7, attempt: 1, sha, branch, status: "completed", conclusion: "success", url: "https://github.com/acme/shop/actions/runs/7", startedAt: T0, below: 0, ...more });

// The repository `acme` (prefix AC), tickets AC0001 to AC0009 planned, its vision, a CI workflow and package.json with its
// checks, and `project` as more keys of its entry in the list (`autoMerge` on by default), which `set` replaces. With `github`,
// the test provides `github.ci`, answering `ci` (an Error rejects), and `github.cancel`, answering `cancelled`; each request
// noted. `worker(n, files)` runs a worker on AC000n that commits `files`; `review(job, message)` a review ending on `message`;
// `merge(...args)` runs `arthur merge` as the CLI does.
async function load(t: TestContext, github = true) {
	const root = join(temporaryFolder(), "acme");
	const files: Record<string, string> = { "package.json": PACKAGE, "test.js": TEST_JS, "README.md": "# acme\n", "spec/vision.md": "# Acme\n", ".github/workflows/ci.yml": "on: push\n" };
	const ids = Array.from({ length: TICKETS }, (_, at) => `AC000${at + 1}`);
	for (const id of ids) files[`spec/features/${id}-t/ticket.md`] = `# ${id} - T\n\n\`\`\`json\n{ "id": "${id}" }\n\`\`\`\n`;
	files["spec/build.json"] = JSON.stringify(ids.map((id) => ({ id, title: `T ${id}`, status: "planned", path: `spec/features/${id}-t/ticket.md`, updated: T0 })));
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-C", at, ...args], { encoding: "utf8" }).trim();
	const write = (at: string, changes: Readonly<Record<string, string>>) => {
		for (const [path, text] of Object.entries(changes)) {
			mkdirSync(dirname(join(at, path)), { recursive: true });
			writeFileSync(join(at, path), text);
		}
	};
	write(root, files);
	git(root, "init", "--quiet", "--initial-branch=main");
	// Repo-local, so `arthur merge`'s own `git merge` has an identity on a runner with no global one.
	git(root, "config", "user.name", "t");
	git(root, "config", "user.email", "t@example.com");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "delivery", root });
	let project: Record<string, unknown> = { autoMerge: true };
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC", ...project }]);
	fake.provide("projects.install", () => "");
	const asked: unknown[] = [];
	const cancels: unknown[] = [];
	const answers: { ci: CiRun | undefined | Error; cancelled: string | Error } = { ci: undefined, cancelled: "github: cancel of run 7 of acme/shop asked" };
	if (github) {
		fake.provide("github.ci", async (request: unknown) => {
			asked.push(request);
			if (answers.ci instanceof Error) throw answers.ci;
			return answers.ci;
		});
		fake.provide("github.cancel", async (request: unknown) => {
			cancels.push(request);
			if (answers.cancelled instanceof Error) throw answers.cancelled;
			return answers.cancelled;
		});
	}
	const plugin = delivery();
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	const home = dirname(fake.host.folder);
	const ended = async (id: string) => {
		const state = join(home, "jobs", id, "state");
		for (const deadline = Date.now() + 15_000; !existsSync(state) || readFileSync(state, "utf8") !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
		fake.emit("job-ended", { id, state: "ended" });
	};
	const agent = (run: AgentRun) => {
		process.env.PATH = [dirname(fakeAgent(run)), PATH].join(delimiter);
	};
	const commit = (worktree: string, changes: Readonly<Record<string, string>>, ...rename: string[]) => {
		write(worktree, changes);
		if (rename.length > 0) git(worktree, "mv", ...rename);
		git(worktree, "add", "--all");
		git(worktree, "commit", "--quiet", "-m", `change ${[...Object.keys(changes), ...rename].join(" ")}`);
		return git(worktree, "rev-parse", "HEAD");
	};
	const worker = async (ticket: number, changes: Readonly<Record<string, string>> = { [`shop${ticket}.ts`]: "export const shop = 1;\n" }, ...rename: string[]) => {
		agent({ steps: [{ message: "Done." }] });
		const job = await fake.host.jobs.spawn({ task: `Ticket: spec/features/AC000${ticket}-t/ticket.md` });
		await ended(job.id);
		return { id: job.id, branch: job.branch ?? "", worktree: job.worktree, tip: commit(job.worktree, changes, ...rename) };
	};
	const run = async (name: string, args: readonly string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })).catch((error: Error) => (err.push(`arthur ${name}: ${error.message}`), 1));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n") };
	};
	const review = async (job: string, message: string) => {
		agent({ steps: [{ message }] });
		const { out } = await run("review", [job]);
		await ended(out);
		return out;
	};
	const messages = () => fake.emitted.filter((event) => event.name === "coordinator-message").map((event) => (event.data as { readonly text: string }).text);
	const waiting = (id: string) => existsSync(join(fake.host.folder, id, "ci-wait"));
	return {
		...{ root, fake, plugin, git, commit, worker, review, run, merge: (...args: string[]) => run("merge", args), messages, waiting, asked, cancels, answers },
		head: () => git(root, "rev-parse", "HEAD"),
		set: (next: Record<string, unknown>) => void (project = next),
	};
}

test("--auto merges with autoMerge on, a PASS on the tip and CI passed; refused, each naming its rule: autoMerge off or unset, no PASS, a FAIL, a PASS on an older commit", async (t) => {
	const { fake, commit, worker, review, merge, head, set, asked, answers } = await load(t);
	const job = await worker(1);
	const passed = await review(job.id, "PASS");
	const start = head();
	const off = (value: string) => `arthur merge: --auto merges only in a project with autoMerge on; acme has autoMerge ${value}, so its merges wait for the owner: arthur merge ${job.id} on his word; main is unchanged`;
	set({ autoMerge: false });
	assert.deepEqual(await merge(job.id, "--auto"), { code: 1, out: "", err: off("false") });
	assert.doesNotMatch(fake.call<string>("coordinator.wake", { id: passed, kind: "review" }), /--auto/, "no autoMerge, no --auto in the PASS wake");
	set({});
	assert.equal((await merge(job.id, "--auto")).err, off("unset"));
	set({ autoMerge: true });
	assert.ok(fake.call<string>("coordinator.wake", { id: passed, kind: "review" }).endsWith(` acme merges on its own (autoMerge): after that commit, arthur merge --auto ${job.id}.`));
	const pass = (tip: string, why: string) => `arthur merge: --auto merges only with a PASS on the tip: ${job.branch}'s tip ${tip.slice(0, 7)}: ${why}; review the tip: arthur review ${job.id}; main is unchanged`;
	const tip = commit(job.worktree, { "late.ts": "export const late = 1;\n" });
	assert.equal((await merge(job.id, "--auto")).err, pass(tip, `the last PASS, ${passed}, is on an older commit, ${job.tip.slice(0, 7)}`));
	const failed = await review(job.id, "FAIL");
	assert.equal((await merge(job.id, "--auto")).err, pass(tip, `its newest review, ${failed}, says FAIL`));
	const other = await worker(2);
	assert.equal((await merge(other.id, "--auto")).err, `arthur merge: --auto merges only with a PASS on the tip: ${other.branch}'s tip ${other.tip.slice(0, 7)}: no review of it says PASS; review the tip: arthur review ${other.id}; main is unchanged`);
	assert.deepEqual([head(), asked], [start, []], "nothing merged, CI never asked before the other rules");
	await review(job.id, "PASS");
	answers.ci = ciRun(tip, job.branch);
	const merged = await merge(job.id, "--auto");
	assert.equal(merged.code, undefined, merged.err);
	assert.match(merged.out, new RegExp(`^merged ${job.branch} into main: [0-9a-f]+\n`));
	assert.equal(fake.host.board.get("AC0001")?.status, "merged");
});

test("--auto refuses a held path: a role, the vision, CI, package.json, the always-review list, a held file renamed away; another path goes in", async (t) => {
	const { worker, review, merge, set, answers, git, root } = await load(t);
	set({ autoMerge: true, prompts: { rolesDir: "agents/roles" } });
	const cases: readonly [Readonly<Record<string, string>>, readonly string[], string, string][] = [
		[{ "agents/roles/worker.md": "Use tabs.\n" }, [], "agents/roles/worker.md", "a role"],
		[{ "packages/shop/roles/coordinator.md": "# Coordinator\n" }, [], "packages/shop/roles/coordinator.md", "a role"],
		[{ "spec/vision.md": "# Acme, again\n" }, [], "spec/vision.md", "the vision"],
		[{ ".github/workflows/ci.yml": "on: pull_request\n" }, [], ".github/workflows/ci.yml", "CI"],
		[{ "packages/shop/package.json": "{}\n" }, [], "packages/shop/package.json", "package.json"],
		[{ "src/env.ts": "export const env = 1;\n" }, [], "src/env.ts", "the always-review list"],
		[{}, [".github/workflows/ci.yml", "ci-old.yml"], ".github/workflows/ci.yml", "CI"],
	];
	for (const [at, [changes, rename, path, rule]] of cases.entries()) {
		const job = await worker(at + 1, changes, ...rename);
		await review(job.id, "PASS");
		answers.ci = ciRun(job.tip, job.branch);
		assert.equal((await merge(job.id, "--auto")).err, `arthur merge: --auto merges no held path: ${job.branch} changes ${path} (${rule}); its merge waits for the owner: arthur merge ${job.id} on his word; main is unchanged`, path);
	}
	const plain = await worker(8, { "docs/roles.md": "# Roles\n", "spec/vision.md.bak": "x\n" });
	await review(plain.id, "PASS");
	answers.ci = ciRun(plain.tip, plain.branch);
	const merged = await merge(plain.id, "--auto");
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "log", "-1", "--format=%s"), "Merge AC0008: T AC0008");
});

test("--auto CI: failed refused, pending or no run of the branch's own waits, GitHub's refusal named; github not loaded refused without --no-ci, merged with it", async (t) => {
	const { worker, review, merge, head, answers, waiting } = await load(t);
	const job = await worker(1);
	await review(job.id, "PASS");
	const start = head();
	const rule = (why: string) => `arthur merge: --auto merges only with CI passed on the branch: ${why}; main is unchanged`;
	const waits = "; it waits: when that run ends, the coordinator is woken with its verdict";
	answers.ci = ciRun(job.tip, job.branch, { conclusion: "failure" });
	assert.equal((await merge(job.id, "--auto")).err, rule(`run 7, attempt 1, on ${job.tip.slice(0, 7)}, the tip, ended failure: https://github.com/acme/shop/actions/runs/7; why: arthur ci ${job.branch} --project acme`));
	assert.equal(waiting(job.id), false, "a failed run leaves no wait");
	answers.ci = new Error("instance (unnamed): 401: the token in ARTHUR_GITHUB_TOKEN was refused: Bad credentials");
	assert.equal((await merge(job.id, "--auto")).err, rule("github could not tell: instance (unnamed): 401: the token in ARTHUR_GITHUB_TOKEN was refused: Bad credentials"));
	answers.ci = ciRun(start, "main", { below: 1 });
	assert.equal((await merge(job.id, "--auto")).err, rule(`no run built a commit of it yet (the nearest, 7, ran on ${start.slice(0, 7)}, on main)${waits}`));
	assert.equal(waiting(job.id), true);
	answers.ci = undefined;
	assert.equal((await merge(job.id, "--auto")).err, rule(`no run built a commit of it yet${waits}`));
	answers.ci = ciRun(job.tip, job.branch, { status: "queued", conclusion: null });
	assert.equal((await merge(job.id, "--auto")).err, rule(`run 7, attempt 1, on ${job.tip.slice(0, 7)}, the tip, is queued${waits}`));
	assert.equal(head(), start);

	const bare = await load(t, false);
	const other = await bare.worker(1);
	await bare.review(other.id, "PASS");
	const refused = await bare.merge(other.id, "--auto");
	assert.deepEqual([refused.code, refused.err], [1, `arthur merge: --auto asks CI of github, which is not loaded (plugin delivery: call("github.ci"): no plugin provides it); without it, only the owner's word merges: arthur merge ${other.id} --auto --no-ci; main is unchanged`]);
	const merged = await bare.merge(other.id, "--auto", "--no-ci");
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(bare.fake.host.board.get("AC0001")?.status, "merged");
});

test("CI passed on the tip after a new commit: the run of the old tip no longer counts; a commit with no run counts the run below it on the branch", async (t) => {
	const { commit, worker, review, merge, answers, waiting } = await load(t);
	const job = await worker(1);
	await review(job.id, "PASS");
	const tip = commit(job.worktree, { "late.ts": "export const late = 1;\n" });
	await review(job.id, "PASS");
	answers.ci = ciRun(tip, job.branch, { id: 8, status: "in_progress", conclusion: null });
	assert.match((await merge(job.id, "--auto")).err, /: run 8, attempt 1, on [0-9a-f]{7}, the tip, is in_progress; it waits: /);
	assert.equal(waiting(job.id), true);
	answers.ci = ciRun(tip, job.branch, { id: 8 });
	const merged = await merge(job.id, "--auto");
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(waiting(job.id), false, "the merge ends the wait");

	const docs = await worker(2);
	const late = commit(docs.worktree, { "notes.md": "# Notes\n" });
	await review(docs.id, "PASS");
	answers.ci = ciRun(docs.tip, docs.branch, { below: 1 });
	assert.notEqual(late, docs.tip);
	const below = await merge(docs.id, "--auto");
	assert.equal(below.code, undefined, below.err);
});

test("a waiting branch's CI end, as github's poll asks delivery.ciEnded, wakes the coordinator with its verdict once per run end, a rerun's end again, and answers true; the poll never wakes on an end; a run on main, another branch or project, or no wait answers false", async (t) => {
	const { fake, worker, review, merge, answers, asked, messages, waiting } = await load(t);
	const job = await worker(1);
	await review(job.id, "PASS");
	answers.ci = ciRun(job.tip, job.branch, { status: "in_progress", conclusion: null });
	assert.equal((await merge(job.id, "--auto")).code, 1);
	const url = "https://github.com/acme/shop/actions/runs/7";
	// What github's poll passes: the project, the branch, how far below its tip the run is, and the run as GitHub listed it.
	const end = (more: Record<string, unknown> = {}, run: Partial<CiRun> = {}) => fake.collect<boolean>("delivery.ciEnded", { project: "acme", branch: job.branch, below: 0, run: ciRun(job.tip, job.branch, { conclusion: "failure", ...run }), ...more });
	assert.deepEqual([end({ below: 1 }), end({ branch: "arthur/other" }), end({ project: "other" })], [[false], [false], [false]], "a run on main, another branch, another project");
	assert.deepEqual(messages(), []);
	answers.ci = ciRun(job.tip, job.branch, { conclusion: "failure" });
	await ciWaits(fake.host).round();
	assert.deepEqual(messages(), [], "the poll leaves a run's end to github's");
	assert.deepEqual(end(), [true]);
	const ci = `arthur ci ${job.branch} --project acme`;
	const where = `${job.branch} (run 7, attempt 1, on ${job.tip.slice(0, 7)}): ${url}`;
	assert.deepEqual(messages(), [`[delivery] CI ended failure on ${where}. Not merged; it waits on: the next end of a run on it wakes you again. Why: ${ci}; rerun it once: ${ci} --rerun`]);
	assert.deepEqual(end(), [true], "asked again, it still owns that end");
	assert.equal(messages().length, 1, "told once");
	assert.deepEqual(end({}, { attempt: 2, conclusion: "success" }), [true]);
	assert.deepEqual(messages().slice(1), [`[delivery] CI passed on ${where.replace("attempt 1", "attempt 2")}. It waited for that: arthur merge --auto ${job.id}`]);
	answers.ci = ciRun(job.tip, job.branch, { attempt: 2 });
	const merged = await merge(job.id, "--auto");
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(waiting(job.id), false);
	assert.deepEqual(end({}, { attempt: 3 }), [false], "no wait: github's wake tells it");
	const before = asked.length;
	await ciWaits(fake.host).round();
	assert.equal(asked.length, before, "no wait, nothing asked");
});

test("a run that hangs is cancelled 30 minutes after its start, once, across a restart; a refused cancel wakes the coordinator; a new commit or a pruned job ends the wait; a broken wait is said once", async (t) => {
	const { fake, commit, worker, review, merge, answers, cancels, messages, waiting } = await load(t);
	const job = await worker(1);
	await review(job.id, "PASS");
	answers.ci = ciRun(job.tip, job.branch, { status: "in_progress", conclusion: null, startedAt: T0 });
	assert.equal((await merge(job.id, "--auto")).code, 1);
	const waits = ciWaits(fake.host);
	fake.setNow(new Date(Date.parse(T0) + 30 * 60_000 - 1));
	await waits.round();
	assert.deepEqual(cancels, [], "not before 30 minutes");
	fake.setNow(new Date(Date.parse(T0) + 30 * 60_000));
	await waits.round();
	await waits.round();
	await ciWaits(fake.host).round();
	assert.deepEqual(cancels, [{ project: "acme", run: 7 }], "once, a restart included");
	const end = (run: CiRun) => fake.collect<boolean>("delivery.ciEnded", { project: "acme", branch: job.branch, below: 0, run });
	assert.deepEqual(end(ciRun(job.tip, job.branch, { conclusion: "cancelled" })), [true]);
	assert.match(messages()[0] ?? "", /^\[delivery\] CI ended cancelled, cancelled by delivery after it ran 30 minutes on /);

	answers.ci = ciRun(job.tip, job.branch, { id: 9, status: "queued", conclusion: null, startedAt: "2025-12-31T23:00:00Z", url: "https://github.com/acme/shop/actions/runs/9" });
	answers.cancelled = new Error("instance (unnamed): 403 for run 9 of acme/shop: Resource not accessible by personal access token");
	await waits.round();
	assert.equal(messages()[1], `[delivery] CI run 9, attempt 1, on ${job.branch} has run 30 minutes and was not cancelled: instance (unnamed): 403 for run 9 of acme/shop: Resource not accessible by personal access token. Cancel it on GitHub: https://github.com/acme/shop/actions/runs/9`);
	await waits.round();
	assert.equal(cancels.length, 2, "a refused cancel is not asked again");

	commit(job.worktree, { "late.ts": "export const late = 1;\n" });
	assert.deepEqual(end(ciRun(job.tip, job.branch, { id: 10 })), [false], "its tip moved: no longer delivery's to tell, even before a round ends the wait");
	mkdirSync(join(fake.host.folder, "2026-01-01-worker-0000dead"));
	const gone = { job: "2026-01-01-worker-0000dead", project: "acme", branch: job.branch, tip: job.tip, own: 1 };
	writeFileSync(join(fake.host.folder, gone.job, "ci-wait"), JSON.stringify(gone));
	const logged: string[] = [];
	t.mock.method(console, "log", (text: string) => logged.push(text));
	await waits.round();
	t.mock.restoreAll();
	assert.deepEqual([waiting(job.id), waiting(gone.job)], [false, false]);
	assert.deepEqual(logged.sort(), [`delivery: ${job.branch} waits for CI no more: its job was pruned`, `delivery: ${job.branch} waits for CI no more: its tip is no longer ${job.tip.slice(0, 7)}`]);

	mkdirSync(join(fake.host.folder, "broken"));
	writeFileSync(join(fake.host.folder, "broken", "ci-wait"), "{ broken");
	const said: string[] = [];
	t.mock.method(console, "error", (text: string) => said.push(text));
	await waits.round();
	await waits.round();
	t.mock.restoreAll();
	assert.equal(said.length, 1, said.join("\n"));
	assert.match(said[0] ?? "", /^delivery: .*broken\/ci-wait is no CI wait \(.+\); remove it, and arthur merge --auto broken again$/);
});
