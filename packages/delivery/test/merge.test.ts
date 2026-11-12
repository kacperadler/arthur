import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { fakeAgent, temporaryFolder } from "@arthur/core/testing";
import { ciRun, type CiRun, DONE, FOLDER, load, noIdentityAnywhere, OWNER, PACKAGE, PROCEDURE, running, TICKET } from "./merge-setup.ts";

// arthur merge (merge-setup.ts): a branch that goes in, the refusals before it does, and what it asks github and the owner.

test("a branch with a PASS on its tip goes in: checks pass, its review filed, outcome.md written, the ticket merged, the tickets it unblocks named, the ticket's jobs pruned; the install's cache is the merge's own, gone after it", async (t) => {
	const { root, fake, home, git, worker, aside, review, merge, head, status, bun, caches, installs } = await load(t);
	const job = await worker({ "shop.ts": "export const shop = 1;\n", "bun.lock": '{ "shop": 1 }\n' });
	// Another worker of the ticket, its commit never merged: a merge never forces its branch away.
	const other = await worker({ "draft.ts": "export const draft = 1;\n" });
	// Jobs of another ticket, and of an id that only begins like AC0001: none of them is this merge's.
	const strangers = [await aside("spec/features/AC0002-cart/ticket.md"), await aside("spec/features/AC00010-shops/ticket.md")];
	const passed = await review(job.id, "Clean.\n\nPASS");
	const checkout = readFileSync(join(home, "jobs", passed, "worktree"), "utf8");
	// What delivery keeps of the job in its folder: the CI wait an earlier `--auto` left.
	mkdirSync(join(fake.host.folder, job.id), { recursive: true });
	writeFileSync(join(fake.host.folder, job.id, "ci-told"), "{}\n");
	const before = head();
	const merged = await merge(job.id.slice(-8), "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	const hash = git(root, "rev-parse", "--short", "HEAD^");
	assert.deepEqual(git(root, "log", "-2", "--format=%s%n%P"), `spec: AC0001 merged\n${git(root, "rev-parse", "HEAD^")}\nMerge AC0001: Shop\n${before} ${job.tip}`);
	assert.equal(
		merged.out.replace(/not fully merged\.$/m, "not fully merged"), // Git's own words, which end in a full stop in some versions.
		[
			`merged ${job.branch} into main: ${hash}`,
			"bun install --frozen-lockfile: passed.",
			"npm run check: passed.",
			"npm test: 2/2 passed.",
			`filed ${FOLDER}/review-1.md`,
			"- Findings: none; no findings.md on this ticket.",
			`wrote ${FOLDER}/outcome.md`,
			"AC0001 merged",
			"unblocked: AC0002",
			"wrote CHANGELOG.md: 1 merged ticket",
			`committed spec: AC0001 merged: ${git(root, "rev-parse", "--short", "HEAD")}`,
			"nothing pushed: no plugin provides github.push",
			`${job.id}: worktree ${job.worktree} removed; branch ${job.branch} deleted; record deleted`,
			`${passed}: worktree ${checkout} removed; record deleted`,
			`${other.id}: worktree ${other.worktree} removed; kept branch ${other.branch} and the record: git branch: error: the branch '${other.branch}' is not fully merged`,
			DONE,
		].join("\n"),
	);
	assert.equal(bun(), "install --frozen-lockfile\n", "the project's install ran once");
	assert.deepEqual(caches().map((each) => [dirname(dirname(each)), basename(each), existsSync(dirname(each))]), [[fake.host.folder, "bun", false]], "a cache folder in the plugin's own, removed after the merge");
	assert.deepEqual(installs, [{ project: "acme", commit: "HEAD", head: git(root, "rev-parse", "HEAD^") }], "asked of projects.install for the merge commit");
	assert.match(readFileSync(join(root, FOLDER, "review-1.md"), "utf8"), new RegExp(`^- Job: ${passed}\n- Branch: ${job.branch}\n`, "m"));
	const outcome = readFileSync(join(root, FOLDER, "outcome.md"), "utf8");
	assert.match(outcome, new RegExp(`^# AC0001 - Outcome\n\n- Merged: \\d{4}-\\d{2}-\\d{2}, \`${hash}\`\n- Branch: ${job.branch}\n- Reviews: review-1.md PASS\n- Cost: worker \\$\\d+\\.\\d{2}, reviews \\$\\d+\\.\\d{2}; review rounds 1\n`));
	assert.ok(
		outcome.endsWith(
			"\n## What went in\n\n- change shop.ts bun.lock\n\n## Checks on main\n\n- `bun install --frozen-lockfile`: passed.\n- `npm run check`: passed.\n- `npm test`: 2/2 passed.\n\n## Left open\n\n- Findings: none; no findings.md on this ticket.\n",
		),
		outcome,
	);
	assert.deepEqual([status("AC0001"), status("AC0002"), status("AC0003")], ["merged", "planned", "planned"]);
	assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), new RegExp(`\n## \\d{4}-\\d{2}-\\d{2}\n\n### Other\n\n- AC0001 Shop \\(${hash}\\)\n$`), "rebuilt from outcome.md");
	assert.deepEqual(fake.emitted.filter((event) => event.name === "ticket-moved").at(-1)?.data, { id: "AC0001", project: "acme", from: "done", to: "merged" });
	assert.deepEqual([job.id, passed, other.id].map((id) => existsSync(join(home, "jobs", id))), [false, false, true], "the ticket's ended jobs pruned, the one whose branch main lacks kept");
	assert.equal(git(root, "branch", "--list", other.branch), other.branch);
	assert.deepEqual(strangers.map((each) => [existsSync(join(home, "jobs", each.id)), existsSync(each.worktree), git(root, "branch", "--list", "--format=%(refname:short)", each.branch)]), strangers.map((each) => [true, true, each.branch]), "another ticket's jobs untouched");
	assert.deepEqual([existsSync(job.worktree), existsSync(checkout), git(root, "branch", "--list", job.branch)], [false, false, ""]);
	assert.deepEqual([existsSync(join(fake.host.folder, job.id)), existsSync(join(fake.host.folder, "reviews", `${passed}.json`))], [false, true], "delivery's folder of the job goes, its record of the review stays");
	fake.collect("jobs.keep", { id: "reviews" });
	assert.equal(existsSync(join(fake.host.folder, "reviews", `${passed}.json`)), true, "a name that is no job's id removes nothing");
	assert.equal((await merge(other.id, "--decision", OWNER)).err, `arthur merge: AC0001 is merged; a merge is of a ticket in-progress, review or done`);
});

test("a key that may name a program, set in the repository's config while the checks ran, keeps the spec: commit from running it: the merge is in, the commit left to the coordinator", async (t) => {
	const { root, git, worker, merge, head } = await load(t);
	const [ran, program] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "program")];
	writeFileSync(program, `#!/bin/sh\necho program >> '${ran}'\ncat\n`, { mode: 0o755 });
	// The branch gives every file a filter; its test, run on main after the merge, names the filter's program and passes.
	const plants = `require("node:child_process").execFileSync("git", ["config", "filter.x.clean", ${JSON.stringify(program)}]);\nconsole.log("ℹ tests 2\\nℹ pass 2");\n`;
	const job = await worker({ ".gitattributes": "* filter=x\n", "test.js": plants });
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	const said = `${join(root, ".git", "config")} sets filter.x.clean, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	assert.match(merged.out, new RegExp(`\nwrote CHANGELOG\\.md: 1 merged ticket\nspec: AC0001 merged not committed: ${said.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}; commit ${FOLDER}, spec/build\\.json, CHANGELOG\\.md\n`));
	assert.deepEqual([git(root, "log", "-1", "--format=%s", head()), existsSync(ran)], ["Merge AC0001: Shop", false]);
});

test("the commit-msg script main's package.json declares checks the spec: commit, its paths staged, first: a refusal or a path changed while it ran leaves them uncommitted and unpushed, the merge in; a clean outcome is committed and pushed", async (t) => {
	// The project's own check, as a commit-msg hook: on nvm's PATH (the PATH as it is when nvm answers none, the `touch` case), the message in the file it is handed, then each staged file naming web-shop refused.
	const nvm = temporaryFolder();
	const vet = `const { spawnSync } = require("node:child_process");\nconst fs = require("node:fs");\nif (!fs.existsSync("touch") && !process.env.PATH.split(${JSON.stringify(delimiter)}).includes(${JSON.stringify(nvm)})) { console.error("not nvm's PATH"); process.exit(1); }\nif (fs.readFileSync(process.argv[2], "utf8") !== "spec: AC0001 merged\\n") { console.error("not the message"); process.exit(1); }\nif (fs.existsSync("touch")) fs.appendFileSync("CHANGELOG.md", "\\n");\nconst named = spawnSync("git", ["grep", "--cached", "-l", "-F", "-e", ["web", "shop"].join("-")], { encoding: "utf8" }).stdout.trim().split("\\n").filter(Boolean);\nfor (const file of named) console.error(\`commit refused: \${file}: names the project\`);\nprocess.exit(named.length > 0 ? 1 : 0);\n`;
	const merging = async (line: string, touch = false) => {
		const { root, fake, git, worker, merge } = await load(t);
		const pushed: string[] = [];
		fake.provide("github.push", () => (pushed.push(git(root, "log", "-1", "--format=%s")), Promise.resolve("github: pushed main to origin: a..b")));
		fake.provide("nvm.path", () => (touch ? "" : [nvm, process.env.PATH].join(delimiter)));
		const scripts = { ...JSON.parse(PACKAGE).scripts, "commit-msg": "node vet.js" };
		const job = await worker({ "package.json": JSON.stringify({ scripts }), "vet.js": vet, ...(touch && { touch: "" }) }, `Ticket: ${TICKET}`, `Built.\n\n## What went in\n\n- ${line}\n`);
		const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
		assert.equal(merged.code, undefined, merged.err);
		return { ...merged, pushed, staged: git(root, "diff", "--cached", "--name-only"), shown: git(root, "show", "--name-only", "--format=%s", "HEAD") };
	};
	const named = await merging("vet.js: sells for web-shop.");
	const left = `; commit ${FOLDER}, spec/build\\.json, CHANGELOG\\.md\ngithub: pushed main to origin`;
	assert.match(named.out, new RegExp(`\nspec: AC0001 merged not committed: npm run commit-msg refused: commit refused: ${FOLDER}/outcome\\.md: names the project${left}`));
	assert.deepEqual([named.pushed, named.shown, named.staged], [["Merge AC0001: Shop"], "Merge AC0001: Shop", `CHANGELOG.md\nspec/build.json\n${FOLDER}/outcome.md`], "the merge pushed, its spec files staged, never committed");
	const touched = await merging("vet.js: checks the commit.", true);
	assert.match(touched.out, new RegExp(`\nspec: AC0001 merged not committed: CHANGELOG\\.md changed while npm run commit-msg ran${left}`));
	assert.deepEqual(touched.pushed, ["Merge AC0001: Shop"]);
	const clean = await merging("vet.js: checks the commit.");
	assert.match(clean.out, /\ncommitted spec: AC0001 merged: \w+\ngithub: pushed main to origin/);
	assert.deepEqual([clean.pushed, clean.staged], [["spec: AC0001 merged"], ""]);
	assert.equal(clean.shown, `spec: AC0001 merged\n\nCHANGELOG.md\nspec/build.json\n${FOLDER}/outcome.md`);
	// A project with no package.json names no check: its spec: commit is made as before.
	const { git, worker, merge } = await load(t);
	const bare = await worker();
	git(bare.worktree, "rm", "--quiet", "package.json");
	git(bare.worktree, "commit", "--quiet", "-m", "no package.json");
	const plain = await merge(bare.id, "--unreviewed", "--decision", OWNER);
	assert.match(plain.out, /\nwrote CHANGELOG\.md: 1 merged ticket\ncommitted spec: AC0001 merged: \w+\n/, plain.err);
});

test("refused, main unchanged: no PASS on the tip, a FAIL on it, a PASS on an older commit; --unreviewed lets it in with the owner's decision, and outcome.md says so", async (t) => {
	const { root, commit, worker, review, merge, head, status, owner } = await load(t);
	const job = await worker();
	const start = head();
	const unreviewed = (tip: string, why: string) =>
		`arthur merge: no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: ${why}; review it with arthur review ${job.id}, or merge it with --unreviewed --decision <the owner's decision id>; main is unchanged`;
	assert.deepEqual(await merge(job.id, "--decision", OWNER), { code: 1, out: "", err: unreviewed(job.tip, "no review of it has a verdict (last PASS: none)") });
	const failed = await review(job.id, "Missing a test.\n\nFAIL");
	assert.equal((await merge(job.id, "--decision", OWNER)).err, unreviewed(job.tip, `its newest review, ${failed}, says FAIL (last PASS: none)`));
	await review(job.id, "PASS");
	const tip = commit(job.worktree, { "late.ts": "export const late = 1;\n" });
	assert.equal((await merge(job.id, "--decision", OWNER)).err, unreviewed(tip, `no review of it has a verdict (last PASS: ${job.tip.slice(0, 7)})`));
	assert.equal(head(), start);
	// `decision.owner` holds --unreviewed: its refusal refuses the merge, main unchanged.
	assert.deepEqual(await merge(job.id, "--unreviewed"), { code: 1, out: "", err: "arthur merge: --unreviewed needs the owner's decision: arthur decision ask --kind merge --what --unreviewed --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then --unreviewed --decision <its id>; main is unchanged" });
	assert.deepEqual(await merge(job.id, "--decision", "AC-D9", "--unreviewed"), { code: 1, out: "", err: "arthur merge: AC-D9 is not in the decision log of project acme; main is unchanged" });
	assert.equal(head(), start);
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(status("AC0001"), "merged");
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), new RegExp(`\n- Reviews: review-1.md FAIL, review-2.md PASS; merged unreviewed \\(--unreviewed\\): no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: `));
	const asked = { what: "--unreviewed", kind: "merge", ticket: "AC0001", job: job.id, use: `merge ${job.id}` };
	assert.deepEqual(owner, [{ ...asked, id: "" }, { ...asked, id: "AC-D9" }, { ...asked, id: OWNER }], "asked only with --unreviewed, of the job's ticket, for this merge");
});

test("arthur review-needed's no review for the tip is a PASS; for an older tip, or written in the job's own folder, it is none; the merge's prune removes it", async (t) => {
	const { fake, commit, worker, run, merge } = await load(t);
	const job = await worker({ "docs.md": "# Docs\n" });
	assert.equal((await run("review-needed", [job.id])).out, "no review: 1 file, all docs (*.md)\nAC0001 moves to done.");
	const kept = join(fake.host.folder, "review-needed", `${job.id}.json`);
	const tip = commit(job.worktree, { "more.md": "# More\n" });
	const refused = new RegExp(`no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: no review of it has a verdict`);
	assert.match((await merge(job.id, "--decision", OWNER)).err, refused);
	// The job's own folder is its sandbox's to write (AR0499): the answer any program of the job could write there, for its very tip, is no PASS.
	mkdirSync(join(fake.host.folder, job.id), { recursive: true });
	writeFileSync(join(fake.host.folder, job.id, "review-needed"), `${JSON.stringify({ answer: "no review: 1 file, all docs (*.md)", ticket: "AC0001", branch: job.branch, commit: tip, at: 1 })}\n`);
	assert.match((await merge(job.id, "--decision", OWNER)).err, refused, "an answer in the job's own folder is no `no review`");
	await run("review-needed", [job.id]);
	writeFileSync(kept, "{ broken");
	assert.match((await merge(job.id, "--decision", OWNER)).err, refused, "a broken answer is no `no review`");
	await run("review-needed", [job.id]);
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(existsSync(kept), false, "the merge's prune removes the job's answer");
});

test("refused before anything: wrong usage, no job, a read-only or running job, a gone branch, a detached or dirty main, nothing new, a ticket not mergeable", async (t) => {
	const { root, fake, git, worker, review, merge, head, status } = await load(t);
	const usage = "usage: arthur merge <job> (--auto | [--unreviewed] [--no-ci] --decision <id>)";
	assert.deepEqual(await merge(), { code: 2, out: "", err: `arthur merge: no job\n${usage}` });
	assert.equal((await merge("a", "b")).err, `arthur merge: one job; got 2\n${usage}`);
	assert.equal((await merge("a", "--force")).err, `arthur merge: unknown flag --force\n${usage}`);
	assert.deepEqual(await merge("a", "--no-ci"), { code: 1, out: "", err: "arthur merge: no job a; arthur jobs lists them" }, "--no-ci goes with a plain merge too");
	assert.deepEqual(await merge("a", "--auto", "--unreviewed"), { code: 2, out: "", err: `arthur merge: --auto merges only with a PASS, --unreviewed without one: one or the other\n${usage}` });
	assert.deepEqual(await merge("a", "--auto", "--no-ci"), { code: 2, out: "", err: `arthur merge: --auto merges only with CI passed, --no-ci without it on the owner's decision: one or the other\n${usage}` });
	assert.equal((await merge("a", "--auto", "--no-ci", "--decision", OWNER)).code, 2, "no decision lets --auto merge without CI");
	assert.equal((await merge("a", "--auto", "--decision", OWNER)).err, `arthur merge: --auto merges by policy, --decision on the owner's word: one or the other\n${usage}`);
	assert.deepEqual(await merge("a", "--decision", OWNER), { code: 1, out: "", err: "arthur merge: no job a; arthur jobs lists them" }, "--decision goes with a plain merge too");
	for (const args of [["--unreviewed", "--decision"], ["--unreviewed", "--decision", "--no-ci"], ["--decision", "", "--unreviewed"], ["--no-ci", "--decision"]]) assert.equal((await merge("a", ...args)).err, `arthur merge: --decision needs a value\n${usage}`, args.join(" "));
	assert.equal((await merge("nope")).err, "arthur merge: no job nope; arthur jobs lists them");
	const job = await worker();
	const passed = await review(job.id, "PASS");
	assert.equal((await merge(passed)).err, `arthur merge: ${passed} is a review job, read-only: it has no branch to merge`);
	const start = head();
	writeFileSync(join(root, "README.md"), "# acme, edited\n");
	assert.equal((await merge(job.id, "--decision", OWNER)).err, "arthur merge: main has uncommitted changes in README.md; commit or stash them first; main is unchanged");
	git(root, "checkout", "--quiet", "README.md");
	git(root, "checkout", "--quiet", "--detach");
	assert.equal((await merge(job.id, "--decision", OWNER)).err, `arthur merge: ${root} has no branch checked out (a detached HEAD); check out its main branch first`);
	git(root, "checkout", "--quiet", "main");
	writeFileSync(join(root, FOLDER, "outcome.md"), "# by hand\n");
	assert.equal((await merge(job.id, "--decision", OWNER)).err, `arthur merge: ${FOLDER}/outcome.md already exists: AC0001 was merged before`);
	git(root, "clean", "--quiet", "--force", FOLDER);
	const two = await worker({ "two.ts": "export const two = 2;\n" }, `Ticket: ${TICKET}\nTicket: spec/features/AC0002-cart/ticket.md`);
	assert.equal((await merge(two.id, "--decision", OWNER)).err, `arthur merge: ${two.id}'s task names 2 tickets (${FOLDER}, spec/features/AC0002-cart); a merge is of one ticket's branch`);
	git(root, "update-ref", "-d", `refs/heads/${two.branch}`);
	assert.equal((await merge(two.id, "--decision", OWNER)).err, `arthur merge: ${two.branch} is not in ${root}: pruned, or not brought back from its machine`);
	fake.host.board.move("AC0001", "in-progress");
	fake.host.board.move("AC0001", "planning");
	assert.equal((await merge(job.id, "--decision", OWNER)).err, "arthur merge: AC0001 is planning; a merge is of a ticket in-progress, review or done");
	const none = await worker({}, "No ticket here.");
	assert.equal((await merge(none.id, "--unreviewed", "--decision", OWNER)).err, `arthur merge: ${none.branch} at ${start.slice(0, 7)} adds nothing to main (${start.slice(0, 7)}): nothing to merge`);
	assert.equal(head(), start);
	assert.equal(status("AC0001"), "planning");
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "done" }] }))}${delimiter}${process.env.PATH}`;
	const running = await fake.host.jobs.spawn({ task: "Still at it." });
	t.after(() => writeFileSync(gate, ""));
	assert.match((await merge(running.id, "--decision", OWNER)).err, new RegExp(`^arthur merge: ${running.id} is in a run \\((working|idle)\\); merge its branch once the run has ended$`));
});

test("merge.check: any text answer refuses with every answer, main unchanged and not pushed; none lets the branch in, a job naming no ticket included, and github.push pushes main", async (t) => {
	const { fake, git, root, worker, merge, head } = await load(t);
	const asked: unknown[] = [];
	const answers: (string | undefined)[] = ["the branch changes .nvmrc", undefined, "the owner holds this path"];
	for (const [at] of answers.entries()) fake.provide("merge.check", (job: unknown) => (asked.push(job), answers[at]));
	const pushes: unknown[] = [];
	fake.provide("github.push", (branch: unknown) => (pushes.push(branch), Promise.resolve("github: main not pushed to origin: [rejected] (non-fast-forward)")));
	const job = await worker({ "loose.ts": "export const loose = 1;\n" }, "No ticket here.");
	const start = head();
	assert.deepEqual(await merge(job.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: "arthur merge: refused by merge.check: the branch changes .nvmrc; the owner holds this path; main is unchanged" });
	assert.equal(head(), start);
	const record = fake.host.jobs.list().find((each) => each.id === job.id);
	assert.deepEqual(asked, [record, record, record], "asked with the job as arthur jobs holds it");
	assert.deepEqual(pushes, [], "a refused merge pushes nothing");
	answers.fill(undefined);
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.match(merged.out, new RegExp(`^merged ${job.branch} into main: [0-9a-f]+\nbun install --frozen-lockfile: passed\\.\nnpm run check: passed\\.\nnpm test: 2/2 passed\\.\nno ticket: no outcome\\.md, nothing moved\nwrote CHANGELOG\\.md: 0 merged tickets\n`));
	const pruned = `${job.id}: worktree ${job.worktree} removed; branch ${job.branch} deleted; record deleted`;
	assert.ok(merged.out.endsWith(`wrote CHANGELOG.md: 0 merged tickets\ngithub: main not pushed to origin: [rejected] (non-fast-forward)\n${pruned}\n\n${PROCEDURE}`), merged.out);
	assert.deepEqual(pushes, [{ project: "acme", branch: "main" }]);
	assert.equal(git(root, "log", "-1", "--format=%s"), `Merge ${job.branch}`);
});

test("a plain merge asks github.ci: a run on the branch's own commits that ended other than success refuses, lifted by --no-ci with the owner's decision; a pending run, none, one on main, or github failing to tell merges", async (t) => {
	const { fake, worker, review, merge, head, owner } = await load(t);
	const asked: unknown[] = [];
	let answer: CiRun | undefined | Error;
	fake.provide("github.ci", async (request: unknown) => {
		asked.push(request);
		if (answer instanceof Error) throw answer;
		return answer;
	});
	const job = await worker();
	await review(job.id, "PASS");
	const start = head();
	answer = ciRun(job.tip, job.branch, { conclusion: "failure" });
	const why = `run 7, attempt 1, on ${job.tip.slice(0, 7)}, the tip, ended failure: https://github.com/acme/shop/actions/runs/7; why: arthur ci ${job.branch} --project acme`;
	assert.deepEqual(await merge(job.id, "--decision", OWNER), { code: 1, out: "", err: `arthur merge: arthur merge merges only with CI passed on the branch: ${why}; or merge it with --no-ci --decision <the owner's decision id>; main is unchanged` });
	assert.deepEqual(asked, [{ project: "acme", branch: job.branch }]);
	assert.equal(head(), start);
	answer = ciRun(job.tip, job.branch, { conclusion: "cancelled" });
	assert.match((await merge(job.id, "--decision", OWNER)).err, /, the tip, ended cancelled: /, "any end other than success refuses");
	// `decision.owner` holds --no-ci as it holds --unreviewed: its refusal refuses the merge before CI is asked, main unchanged.
	assert.deepEqual(await merge(job.id, "--no-ci"), { code: 1, out: "", err: "arthur merge: --no-ci needs the owner's decision: arthur decision ask --kind merge --what --no-ci --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then --no-ci --decision <its id>; main is unchanged" });
	assert.deepEqual(await merge(job.id, "--decision", "AC-D9", "--no-ci"), { code: 1, out: "", err: "arthur merge: AC-D9 is not in the decision log of project acme; main is unchanged" });
	assert.equal(head(), start);
	const lifted = await merge(job.id, "--no-ci", "--decision", OWNER);
	assert.equal(lifted.code, undefined, lifted.err);
	assert.equal(asked.length, 2, "--no-ci asks no CI");
	const noCi = { what: "--no-ci", kind: "merge", ticket: "AC0001", job: job.id, use: `merge ${job.id}` };
	const plain = { ...noCi, what: `arthur merge ${job.id}`, id: OWNER };
	assert.deepEqual(owner, [plain, plain, { ...noCi, id: "" }, { ...noCi, id: "AC-D9" }, { ...noCi, id: OWNER }], "a plain merge asks for itself; with --no-ci, for --no-ci alone; of the job's ticket, for this merge");
	const runs: [string, (tip: string, branch: string) => CiRun | undefined | Error][] = [
		["queued", (tip, branch) => ciRun(tip, branch, { status: "queued", conclusion: null })],
		["in progress", (tip, branch) => ciRun(tip, branch, { status: "in_progress", conclusion: null })],
		["none", () => undefined],
		["failed on main", () => ciRun(start, "main", { conclusion: "failure", below: 1 })],
		["github could not tell", () => new Error("instance (unnamed): 401: the token in ARTHUR_GITHUB_TOKEN was refused: Bad credentials")],
	];
	for (const [at, [name, run]] of runs.entries()) {
		const each = await worker({ [`loose${at}.ts`]: `export const loose = ${at};\n` }, "No ticket here.");
		answer = run(each.tip, each.branch);
		const merged = await merge(each.id, "--unreviewed", "--decision", OWNER);
		assert.equal(merged.code, undefined, `${name}: ${merged.err}`);
		assert.deepEqual(asked.at(-1), { project: "acme", branch: each.branch }, name);
	}
	// Without a PASS and with CI failed, --unreviewed lifts only the PASS and --no-ci only CI; both flags ask the owner's decision,
	// one id for this merge (orchestration lets it through only when asked with both: --what --unreviewed --what --no-ci).
	const both = await worker({ "both.ts": "export const both = 1;\n" }, "No ticket here.");
	answer = ciRun(both.tip, both.branch, { conclusion: "failure" });
	const before = head();
	owner.length = 0;
	assert.deepEqual(await merge(both.id, "--no-ci", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: no PASS on ${both.branch}'s tip ${both.tip.slice(0, 7)}: no review of it has a verdict (last PASS: none); review it with arthur review ${both.id}, or merge it with --unreviewed --decision <the owner's decision id>; main is unchanged` });
	assert.deepEqual([owner, head()], [[], before], "--no-ci with the owner's decision never lifts the PASS");
	assert.match((await merge(both.id, "--unreviewed", "--decision", OWNER)).err, /merges only with CI passed on the branch: .*, ended failure: /);
	owner.length = 0;
	const merged = await merge(both.id, "--unreviewed", "--no-ci", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	const asks = { kind: "merge", ticket: undefined, job: both.id, use: `merge ${both.id}`, id: OWNER };
	assert.deepEqual(owner, [{ ...asks, what: "--unreviewed" }, { ...asks, what: "--no-ci" }]);
});

test("no git identity: arthur doctor's line per project says so and names the fix; arthur merge refuses before any check, main unchanged; Arthur sets none of its own", async (t) => {
	const { root, fake, git, worker, review, merge, head, status, installs } = await load(t);
	const doctor = async () => {
		const lists = fake.collect<readonly { readonly name: string; check(): Promise<string>; readonly costs: string; readonly fix: string }[]>("doctor");
		return Promise.all(lists.flat().map(async (each) => ({ name: each.name, said: await each.check(), costs: each.costs, fix: each.fix })));
	};
	const fix = `git config --global user.name "<your name>" and git config --global user.email "<your email>", or both with git -C ${root} config for this project alone`;
	assert.deepEqual(await doctor(), [{ name: "acme identity", said: "ok", costs: "arthur merge refuses every branch of acme: git has no author for the merge commit", fix }], "the repository's own identity is one");
	const job = await worker();
	await review(job.id, "PASS");
	noIdentityAnywhere(t);
	git(root, "config", "--unset", "user.name");
	git(root, "config", "--unset", "user.email");
	const author = new RegExp(`^missing: git var GIT_AUTHOR_IDENT in ${root}: fatal: .+$`);
	assert.match((await doctor())[0]?.said ?? "", author);
	const before = head();
	const refused = await merge(job.id, "--decision", OWNER);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`^arthur merge: git has no identity for the merge commit: git var GIT_AUTHOR_IDENT in ${root}: fatal: .+; set one: ${fix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}; main is unchanged$`));
	assert.deepEqual([head(), status("AC0001"), installs], [before, "done", []], "refused before the merge and its checks");
	Object.assign(process.env, { GIT_AUTHOR_NAME: "a", GIT_AUTHOR_EMAIL: "a@example.com" });
	assert.match((await doctor())[0]?.said ?? "", new RegExp(`^missing: git var GIT_COMMITTER_IDENT in ${root}: fatal: `), "an author without a committer is no identity");
	delete process.env.GIT_AUTHOR_NAME;
	delete process.env.GIT_AUTHOR_EMAIL;
	execFileSync("git", ["-C", root, "config", "user.name", "Owner"]);
	execFileSync("git", ["-C", root, "config", "user.email", "owner@example.com"]);
	assert.equal((await doctor())[0]?.said, "ok", "a repository-local identity is one");
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "log", "-2", "--format=%s: %an <%ae> %cn <%ce>"), "spec: AC0001 merged: Owner <owner@example.com> Owner <owner@example.com>\nMerge AC0001: Shop: Owner <owner@example.com> Owner <owner@example.com>", "the merge commit and the spec: one are the owner's, none Arthur made");
});
