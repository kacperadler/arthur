import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { load, OWNER, plantAfterCheck } from "./merge-setup.ts";

// arthur merge (merge-setup.ts): main's protection: its config's programs, code that reached it by another route, conflicts, the lock.

test("the review's checkout and the merge run no hook and no fsmonitor that the repository's shared config names", async (t) => {
	const { root, git, worker, review, merge } = await load(t);
	const job = await worker();
	// Each hook these steps could run, and an fsmonitor, noting its name in `ran`, as a job's program may have set them.
	const [hooks, ran] = [temporaryFolder(), join(temporaryFolder(), "ran")];
	for (const name of ["post-checkout", "reference-transaction", "pre-merge-commit", "prepare-commit-msg", "commit-msg", "post-merge", "post-commit", "pre-push", "fsmonitor"])
		writeFileSync(join(hooks, name), `#!/bin/sh\necho ${name} >> '${ran}'\n`, { mode: 0o755 });
	git(root, "config", "core.hooksPath", hooks);
	git(root, "config", "core.fsmonitor", join(hooks, "fsmonitor"));
	await review(job.id, "PASS");
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(existsSync(ran) ? readFileSync(ran, "utf8") : "", "");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "control");
	assert.match(readFileSync(ran, "utf8"), /^fsmonitor$[^]*^commit-msg$/m, "a plain git call runs them");
});

test("replacements under refs/replace, as a job's git replace would write, change nothing the review, review-needed and the merge read", async (t) => {
	const { root, home, git, worker, review, merge, run } = await load(t);
	const job = await worker({ "docs.md": "# Docs\n" });
	const [before, files, empty] = [git(root, "rev-parse", "main"), git(root, "rev-parse", "main^{tree}"), git(root, "hash-object", "-w", "-t", "tree", "/dev/null")];
	const tree = git(root, "rev-parse", `${job.tip}^{tree}`);
	// Main's tip read as a child of the branch's tip with no file, the branch's tip as a commit of main's files alone: read
	// through them, the branch adds nothing to main, main's ticket is gone, and the review's checkout has no docs.md.
	git(root, "replace", before, git(root, "commit-tree", "-p", job.tip, "-m", "fake main", empty));
	git(root, "replace", job.tip, git(root, "commit-tree", "-m", "fake tip", files));
	const passed = await review(job.id, "PASS");
	const checkout = readFileSync(join(home, "jobs", passed, "worktree"), "utf8").trim();
	assert.equal(readFileSync(join(checkout, "docs.md"), "utf8"), "# Docs\n", "the review's checkout is the branch's own tip");
	assert.equal((await run("review-needed", [job.id])).out, "no review: 1 file, all docs (*.md)\nAC0001 moves to done.");
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "log", "-1", "--format=%s%n%P%n%T", "HEAD^"), `Merge AC0001: Shop\n${before} ${job.tip}\n${tree}`);
	assert.deepEqual(git(root, "replace", "-l").split("\n").sort(), [before, job.tip].sort(), "the replacements are still there: each step read past them");
});

test("refused, main unchanged: the repository's own config sets a key that may name a program; one a failing check sets keeps main from its reset", async (t) => {
	const { root, git, worker, review, merge, head } = await load(t);
	const [ran, program] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "program")];
	writeFileSync(program, `#!/bin/sh\necho program >> '${ran}'\ncat\n`, { mode: 0o755 });
	// The branch gives every file a filter and a merge driver; its test, run on main after the merge, sets a credential helper.
	const plants = `require("node:child_process").execFileSync("git", ["config", "credential.helper", ${JSON.stringify(program)}]);\nprocess.exit(1);\n`;
	const job = await worker({ ".gitattributes": "* filter=x merge=x\n", "README.md": "# acme, merged\n", "test.js": plants });
	await review(job.id, "PASS");
	const before = head();
	const said = (key: string) => `${join(root, ".git", "config")} sets ${key}, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	git(root, "config", "filter.x.smudge", program);
	assert.deepEqual(await merge(job.id, "--decision", OWNER), { code: 1, out: "", err: `arthur merge: ${said("filter.x.smudge")}; main is unchanged` });
	git(root, "config", "--unset", "filter.x.smudge");
	git(root, "config", "merge.x.driver", program);
	assert.equal((await merge(job.id, "--decision", OWNER)).err, `arthur merge: ${said("merge.x.driver")}; main is unchanged`);
	assert.deepEqual([head(), existsSync(ran)], [before, false]);
	git(root, "config", "--unset", "merge.x.driver");
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.err, `arthur merge: check failed on main (npm test), and main could not be reset to ${before.slice(0, 7)}: ${said("credential.helper")}`);
	assert.deepEqual([git(root, "rev-parse", "HEAD^2"), existsSync(ran)], [job.tip, false], "main keeps the merge");
});

test("a signing program a job writes into main's config after the check runs not in the merge commit: Git signs as the owner's config says", async (t) => {
	const { root, git, worker, review, merge } = await load(t);
	const [ran, program] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "program")];
	writeFileSync(program, `#!/bin/sh\necho program >> '${ran}'\nexit 1\n`, { mode: 0o755 });
	const job = await worker({ "README.md": "# acme, signed\n" });
	await review(job.id, "PASS");
	// No commit.gpgSign from the env (a job's sandbox sets one), which Git would read after the repository's config.
	const count = process.env.GIT_CONFIG_COUNT;
	process.env.GIT_CONFIG_COUNT = "0";
	t.after(() => void (count === undefined ? delete process.env.GIT_CONFIG_COUNT : (process.env.GIT_CONFIG_COUNT = count)));
	plantAfterCheck(t, [["commit.gpgSign", "true"], ["gpg.program", program]]);
	await merge(job.id, "--decision", OWNER);
	assert.deepEqual([git(root, "rev-parse", "HEAD^2"), git(root, "config", "gpg.program"), existsSync(ran)], [job.tip, program, false], "merged unsigned, the key planted");
});

test("a merge conflict leaves main as it was: no merge in progress, the ticket where it was", async (t) => {
	const { root, git, worker, review, merge, head, status } = await load(t);
	const job = await worker({ "README.md": "# acme, the branch's\n" });
	await review(job.id, "PASS");
	writeFileSync(join(root, "README.md"), "# acme, main's\n");
	git(root, "commit", "--quiet", "-am", "main moves on");
	const before = head();
	assert.deepEqual(await merge(job.id, "--decision", OWNER), { code: 1, out: "", err: `arthur merge: ${job.branch} conflicts with main in README.md; merge aborted, main is unchanged` });
	assert.equal(head(), before);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "", "no merge left half done");
	assert.equal(existsSync(join(root, ".git", "MERGE_HEAD")), false);
	assert.equal(status("AC0001"), "done");
});

test("only a merge puts code on main: a code commit since the last merge refuses the next, with --unreviewed, --auto or neither, naming it; spec/, CHANGELOG.md and *.md do not; with no record and no merge, from the root", async (t) => {
	const { root, fake, git, commit, take, worker, merge, head } = await load(t);
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	assert.equal(git(root, "show", "--name-only", "--format=%s", "HEAD"), "spec: AC0001 merged\n\nCHANGELOG.md\nspec/build.json\nspec/features/AC0001-shop/outcome.md");
	commit(root, { "README.md": "# acme, a shop\n", "docs/guide.md": "# Guide\n" });
	const cart = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.equal((await merge(cart.id, "--unreviewed", "--decision", OWNER)).err, "", "the commits after a merge, of spec/, CHANGELOG.md and *.md, are no code");
	const hand = git(root, "rev-parse", "--short", commit(root, { "hand.ts": "export const hand = 1;\n" }));
	commit(root, { "spec/notes.md": "# Notes\n" });
	const again = git(root, "rev-parse", "--short", commit(root, { "hand.ts": "export const hand = 2;\n" }));
	const pay = await worker({ "pay.ts": "export const pay = 1;\n" }, "Ticket: spec/features/AC0003-pay/ticket.md");
	const before = head();
	const refused = `arthur merge: main has 2 commits since its last merge that change code (${again}, ${hand}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	assert.deepEqual(await merge(pay.id, "--decision", OWNER), { code: 1, out: "", err: refused });
	assert.deepEqual(await merge(pay.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused });
	assert.deepEqual(await merge(pay.id, "--auto"), { code: 1, out: "", err: refused });
	assert.deepEqual(await merge(pay.id, "--no-ci", "--decision", OWNER), { code: 1, out: "", err: refused });
	assert.equal(head(), before);
	assert.deepEqual(await take(), { code: undefined, out: `took main of acme as it is at ${before.slice(0, 7)}: the next arthur merge lists code commits from there`, err: "" });
	assert.equal((await merge(pay.id, "--unreviewed", "--decision", OWNER)).err, "");
	const loose = await worker({ "loose.ts": "export const loose = 1;\n" }, "No ticket here.");
	const start = git(root, "rev-list", "--max-parents=0", "HEAD");
	git(root, "reset", "--quiet", "--hard", start);
	rmSync(join(fake.host.folder, "acme", "last-merge"));
	assert.equal((await merge(loose.id, "--unreviewed", "--decision", OWNER)).err, `arthur merge: main has 1 commits since its last merge that change code (${git(root, "rev-parse", "--short", start)}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`);
});

test("a history of plain code commits, as squash or rebase merges leave it, refuses naming the newest 10 and how many more; arthur take-main lifts it", async (t) => {
	const { root, git, commit, take, worker, merge, head } = await load(t);
	const plain = Array.from({ length: 12 }, (_, n) => git(root, "rev-parse", "--short", commit(root, { [`plain${n}.ts`]: `export const plain = ${n};\n` }))).reverse();
	const job = await worker();
	const before = head();
	const refused = (named: string, n = 12) => `arthur merge: main has ${n} commits since its last merge that change code (${named}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	assert.deepEqual(await merge(job.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused(`${plain.slice(0, 10).join(", ")} and 2 more`) });
	assert.equal(head(), before);
	git(root, "reset", "--quiet", "--keep", "HEAD~1");
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, refused(`${plain.slice(1, 11).join(", ")} and 1 more`, 11), "11 name 10 and 1 more");
	git(root, "reset", "--quiet", "--keep", "HEAD~1");
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, refused(plain.slice(2).join(", "), 10), "10 are named whole");
	assert.equal((await take()).code, undefined);
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, "");
});

test("a merge commit made on main outside arthur merge hides nothing: code before it or in it refuses the next merge; each merge that went in is recorded; a record HEAD no longer holds, or reaches only off its first-parent line, refuses until arthur take-main", async (t) => {
	const { root, fake, git, take, worker, merge, head } = await load(t);
	const record = join(fake.host.folder, "acme", "last-merge");
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	const merged = git(root, "rev-parse", "HEAD^");
	assert.equal(readFileSync(record, "utf8"), `${merged}\n`, "the merge commit, written whole");
	assert.deepEqual(readdirSync(dirname(record)), ["last-merge"], "no temporary file left");
	// Main reset to `to`, the board's uncommitted moves kept as they are.
	const reset = (to: string) => {
		const board = readFileSync(join(root, "spec", "build.json"), "utf8");
		git(root, "reset", "--quiet", "--hard", to);
		writeFileSync(join(root, "spec", "build.json"), board);
	};
	// The spec: commit undone, its board kept: the branch below starts at the merge commit, so a reset below it leaves the branch's own changes alone.
	reset(merged);
	const cart = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	const refused = (commits: string) => `arthur merge: main has 1 commits since its last merge that change code (${commits}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	// One code file committed alone; a reset keeps the board's uncommitted moves (AC0002 in progress).
	const code = (path: string) => {
		writeFileSync(join(root, path), "export const code = 1;\n");
		git(root, "add", path);
		git(root, "commit", "--quiet", "-m", `add ${path}`);
		return git(root, "rev-parse", "--short", "HEAD");
	};
	// A job on main ends its code commit with a merge of its own, as the empty merge the owner was told to make.
	const hand = code("hand.ts");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a job's own merge", git(root, "commit-tree", "-p", "HEAD", "-m", "empty", "HEAD^{tree}"));
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused(hand) });
	// A job's `git merge --no-ff` of a branch of its own: the merge itself brings the code.
	reset(merged);
	git(root, "checkout", "--quiet", "-b", "side");
	code("side.ts");
	git(root, "checkout", "--quiet", "main");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a job's merge of its branch", "side");
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused(git(root, "rev-parse", "--short", "HEAD")) });
	// The recorded merge made a second parent: main's first-parent line runs through the job's code instead.
	reset(`${merged}^1`);
	code("off.ts");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a merge that takes the recorded one as its second parent", merged);
	const before = head();
	const lift = "only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged";
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: main's first-parent line no longer passes ${merged.slice(0, 7)}, the last merge arthur merge made; ${lift}` });
	assert.equal(head(), before);
	assert.equal(readFileSync(record, "utf8"), `${merged}\n`, "a refused merge records nothing");
	// Main reset below the recorded merge, its code ended with a job's own merge: the record is no ancestor of HEAD any more.
	reset(`${merged}^1`);
	code("below.ts");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a job's own merge", git(root, "commit-tree", "-p", "HEAD", "-m", "empty", "HEAD^{tree}"));
	const below = head();
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: main no longer holds ${merged.slice(0, 7)}, the last merge arthur merge made; ${lift}` });
	assert.equal(head(), below);
	assert.equal(readFileSync(record, "utf8"), `${merged}\n`, "a refused merge records nothing");
	writeFileSync(record, `${"a".repeat(40)}\n`);
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: main no longer holds aaaaaaa, the last merge arthur merge made; ${lift}` }, "a full hash naming no commit here");
	// The owner keeps main as it is: arthur take-main records HEAD, and the branch goes in.
	assert.equal((await take()).code, undefined);
	assert.equal(readFileSync(record, "utf8"), `${below}\n`);
	assert.equal((await merge(cart.id, "--unreviewed", "--decision", OWNER)).err, "");
	assert.equal(readFileSync(record, "utf8"), `${git(root, "rev-parse", "HEAD^")}\n`, "the merge that went in recorded");
});

test("arthur take-main records main's HEAD only on the owner's merge decision of no ticket and no job; refused, it writes nothing; then the next merge goes in", async (t) => {
	const { root, fake, git, commit, take, worker, merge, run, head, owner } = await load(t);
	const record = join(fake.host.folder, "acme", "last-merge");
	// A version changed by hand on main, as only a release ticket's merge may: a package.json counts as code.
	const hand = git(root, "rev-parse", "--short", commit(root, { "package.json": `${JSON.stringify({ name: "acme", version: "0.2.0" })}\n` }));
	const job = await worker();
	const refused = `arthur merge: main has 1 commits since its last merge that change code (${hand}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	assert.deepEqual(await merge(job.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused });
	owner.length = 0;
	const none = await run("take-main", []);
	assert.equal(none.code, 1);
	assert.match(none.err, /^arthur take-main: arthur take-main needs the owner's decision: arthur decision ask --kind merge .*; nothing taken$/);
	assert.deepEqual(owner, [{ id: "", what: "arthur take-main", kind: "merge", use: `take-main acme ${head()}` }], "no ticket and no job");
	assert.deepEqual(await run("take-main", ["--decision", "AC-D9"]), { code: 1, out: "", err: "arthur take-main: AC-D9 is not in the decision log of project acme; nothing taken" });
	const usage = "usage: arthur take-main [--decision <id>] [--project <name>]";
	assert.deepEqual(await run("take-main", ["--decision"]), { code: 2, out: "", err: `arthur take-main: --decision needs a value\n${usage}` });
	assert.deepEqual(await run("take-main", ["--decision", "--now"]), { code: 2, out: "", err: `arthur take-main: --decision needs a value\n${usage}` });
	assert.deepEqual(await run("take-main", ["--now"]), { code: 2, out: "", err: `arthur take-main: unknown argument --now\n${usage}` });
	assert.deepEqual(await run("take-main", ["--decision", OWNER, "main"]), { code: 2, out: "", err: `arthur take-main: unknown argument main\n${usage}` });
	const command = fake.commands.find((each) => each.name === "take-main");
	assert.throws(() => command?.run({ args: ["--decision", OWNER], project: "nope" }), /^Error: no project nope in the project list$/);
	git(root, "config", "filter.x.smudge", "cat");
	assert.deepEqual(await take(), { code: 1, out: "", err: `arthur take-main: ${join(root, ".git", "config")} sets filter.x.smudge, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig; nothing taken` });
	git(root, "config", "--unset", "filter.x.smudge");
	assert.equal(existsSync(record), false, "a refused take writes nothing");
	mkdirSync(dirname(record), { recursive: true });
	writeFileSync(record, "HEAD\n");
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, refused, "a hand-edited record naming no full hash counts as none");
	assert.equal((await take()).code, undefined);
	assert.equal(readFileSync(record, "utf8"), `${head()}\n`);
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, "");
});

test("a second merge of the project while the first runs its checks is refused naming the first, main unchanged; the lock goes with any end of the first, a dead holder's too", async (t) => {
	const { root, fake, git, worker, review, merge, head } = await load(t);
	const first = await worker({ broken: "" });
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.match((await merge(second.id, "--decision", OWNER)).err, /^arthur merge: no PASS on /, "a refused merge ends too");
	await review(first.id, "PASS");
	await review(second.id, "PASS");
	// `nvm.path` is asked as the checks on main begin, the first's merge commit HEAD: the second merge starts then.
	let during: Promise<unknown> | undefined;
	let armed = false;
	fake.provide("nvm.path", () => {
		if (armed && during === undefined) during = Promise.try(() => fake.commands.find((each) => each.name === "merge")?.run({ args: [second.id], project: undefined })).catch((error: Error) => error.message);
		return "";
	});
	const before = head();
	armed = true;
	const failed = await merge(first.id, "--decision", OWNER);
	assert.match(failed.err, /^arthur merge: check failed on main \(npm test\); main reset to /);
	assert.equal(await during, `a merge of ${first.id} is in progress on acme`);
	assert.equal(head(), before);
	assert.notEqual(spawnSync("git", ["-C", root, "merge-base", "--is-ancestor", second.tip, "HEAD"]).status, 0, "the second branch is not on main");
	// A merge of another process (this test's parent stands for it) that has not named its job yet: named by its pid.
	const lock = join(fake.host.folder, "acme", "merge.lock");
	writeFileSync(lock, `${process.ppid}`);
	assert.equal((await merge(second.id, "--decision", OWNER)).err, `arthur merge: a merge of pid ${process.ppid} is in progress on acme`);
	assert.equal(head(), before);
	// A merge killed while it held the lock left it: its pid is dead, so the next merge takes it over.
	writeFileSync(lock, `${spawnSync(process.execPath, ["-e", ""]).pid}`);
	const merged = await merge(second.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "rev-parse", "HEAD^^2"), second.tip);
	assert.deepEqual(readdirSync(join(fake.host.folder, "acme")), ["last-merge"], "no lock and no job named after the merge");
});
