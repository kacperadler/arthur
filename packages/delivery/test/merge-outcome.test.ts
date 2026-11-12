import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { FOLDER, load, OWNER, PACKAGE, TICKET } from "./merge-setup.ts";

// arthur merge (merge-setup.ts): what a merge writes after it went in: outcome.md, the review costs, CHANGELOG.md, the findings.

test("What went in: the worker's own lines, `- <path>: not described` for each file the merge changed that they leave out; the ticket's folder, the tickets findings.onMerge made, the board and CHANGELOG.md committed as spec: <id> merged before github.push", async (t) => {
	const { root, fake, git, worker, merge } = await load(t);
	const message = "Built.\n\n## What went in\n\n- `shop.ts`: sells the shop's items.\n- cart.ts: holds the cart.\nA line that names no file.\n- gone.ts: a file the branch never had.\n\n## Checks\n\n- test.js: 2/2 passed.\n";
	const job = await worker({ "shop.ts": "export const shop = 1;\n", "cart.ts": "export const cart = 1;\n", "docs/notes.md": "# Notes\n" }, `Ticket: ${TICKET}`, message);
	// A ticket the coordinator made before the merge, left uncommitted: no ticket of this merge's.
	const before = fake.host.board.create("Made before", "acme");
	let made = "";
	fake.provide("findings.onMerge", (asked: { readonly project: string }) => ((made = fake.host.board.create("Follow the notes", asked.project).path), "- Tickets from findings: AC0005"));
	const pushed: string[] = [];
	fake.provide("github.push", () => (pushed.push(git(root, "log", "-1", "--format=%s"), git(root, "status", "--porcelain", "--untracked-files=no")), Promise.resolve("github: pushed main to origin: a..b")));
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), /\n## What went in\n\n- `shop\.ts`: sells the shop's items\.\n- cart\.ts: holds the cart\.\n- gone\.ts: a file the branch never had\.\n- docs\/notes\.md: not described\n\n## Checks on main\n/);
	assert.match(merged.out, new RegExp(`\nwrote CHANGELOG\\.md: 1 merged ticket\ncommitted spec: AC0001 merged: ${git(root, "rev-parse", "--short", "HEAD")}\ngithub: pushed main to origin: a\\.\\.b\n`));
	assert.deepEqual(pushed, ["spec: AC0001 merged", ""], "committed, nothing of it left, before the push");
	assert.equal(git(root, "show", "--name-only", "--format=%P", "HEAD"), `${git(root, "rev-parse", "HEAD^")}\n\nCHANGELOG.md\nspec/build.json\n${FOLDER}/outcome.md\n${made}`);
	assert.equal(git(root, "status", "--porcelain", "--", dirname(before.path)), `?? ${dirname(before.path)}/`);
});

test("a review filed and pruned before the merge, as its wake tells the coordinator, still has its cost in outcome.md", async (t) => {
	const { root, fake, home, worker, review, merge } = await load(t);
	const job = await worker();
	const passed = await review(job.id, "Clean.\n\nPASS", 0.37);
	assert.equal(fake.host.jobs.file("AC0001", passed), `${FOLDER}/review-1.md`);
	rmSync(join(home, "jobs", passed), { recursive: true });
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), /\n- Reviews: review-1\.md PASS\n- Cost: worker \$0\.00, reviews \$0\.37; review rounds 1\n/);
});

test("a review record kept before AR0474, with no cost, takes the cost from the core's record while it exists, and is n/a once that is pruned", async (t) => {
	const { root, fake, home, worker, review, merge } = await load(t);
	// The record as an Arthur before AR0474 kept it: the verdict without the cost.
	const costless = (id: string) => {
		const path = join(fake.host.folder, "reviews", `${id}.json`);
		const { cost, ...kept } = JSON.parse(readFileSync(path, "utf8"));
		assert.equal(cost, "0.3700", "settle kept the cost before it is taken away");
		writeFileSync(path, `${JSON.stringify(kept)}\n`);
	};
	const first = await worker();
	costless(await review(first.id, "Clean.\n\nPASS", 0.37));
	assert.equal((await merge(first.id, "--decision", OWNER)).err, "");
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), /\n- Cost: worker \$0\.00, reviews \$0\.37; review rounds 1\n/);
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	const passed = await review(second.id, "Clean.\n\nPASS", 0.37);
	costless(passed);
	assert.equal(fake.host.jobs.file("AC0002", passed), "spec/features/AC0002-cart/review-1.md");
	rmSync(join(home, "jobs", passed), { recursive: true });
	assert.equal((await merge(second.id, "--decision", OWNER)).err, "");
	assert.match(readFileSync(join(root, "spec/features/AC0002-cart/outcome.md"), "utf8"), /\n- Cost: worker \$0\.00, reviews n\/a; review rounds 1\n/);
});

test("each merge that went in rebuilds CHANGELOG.md and commits it; one edited by hand and left uncommitted is no dirt for the next merge", async (t) => {
	const { root, git, worker, merge } = await load(t);
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\nEdited by hand.\n");
	const cart = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.match((await merge(cart.id, "--unreviewed", "--decision", OWNER)).out, /\nwrote CHANGELOG\.md: 2 merged tickets\n/);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "", "rebuilt and committed");
	const pay = await worker({ "pay.ts": "export const pay = 1;\n" }, "Ticket: spec/features/AC0003-pay/ticket.md");
	const merged = await merge(pay.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.err, "");
	assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), /\n- AC0001 Shop \([0-9a-f]+\)\n- AC0002 Cart \([0-9a-f]+\)\n- AC0003 Pay \([0-9a-f]+\)\n$/);
});

test("a release ticket's own merge writes its release's section, its ticket and those before it in it, and commits it; the next merge's ticket is Unreleased", async (t) => {
	const { root, git, commit, take, worker, merge } = await load(t);
	const version = (to: string) => ({ "package.json": JSON.stringify({ ...JSON.parse(PACKAGE), version: to }) });
	commit(root, version("0.1.0"));
	await take();
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), /\n\n## \d{4}-\d{2}-\d{2}\n\n### Other\n\n- AC0001 Shop \([0-9a-f]+\)\n$/, "a version that appears is no release");
	const release = await worker(version("0.2.0"), "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.equal((await merge(release.id, "--unreviewed", "--decision", OWNER)).err, "");
	const day = "\\d{4}-\\d{2}-\\d{2}";
	const released = new RegExp(`\\.\n\n## 0\\.2\\.0 \\(${day}\\)\n\n### ${day}\n\n#### Other\n\n- AC0001 Shop \\([0-9a-f]+\\)\n- AC0002 Cart \\([0-9a-f]+\\)$`);
	assert.match(git(root, "show", "HEAD:CHANGELOG.md"), released, "committed in spec: AC0002 merged, no Unreleased heading");
	const pay = await worker({ "pay.ts": "export const pay = 1;\n" }, "Ticket: spec/features/AC0003-pay/ticket.md");
	assert.equal((await merge(pay.id, "--unreviewed", "--decision", OWNER)).err, "");
	assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), new RegExp(`\\.\n\n## Unreleased\n\n### ${day}\n\n#### Other\n\n- AC0003 Pay \\([0-9a-f]+\\)\n\n## 0\\.2\\.0 \\(${day}\\)\n`));
});

test("findings go to findings.onMerge: none open makes no ticket, an open one's ticket gets the next id; without a provider they stay open, said once", async (t) => {
	const { root, fake, worker, review, merge, status } = await load(t);
	const findings = (folder: string, text: string) => writeFileSync(join(root, folder, "findings.md"), `# Findings\n\n${text}`);
	const entry = (n: number, state: string) => `## F${n}. Finding ${n}\n\n- What: something.\n- Status: ${state}\n\n`;
	const job = await worker({ [`${FOLDER}/findings.md`]: `# Findings\n\n${entry(1, "open")}` });
	await review(job.id, "PASS");
	const left = `- Findings: ${FOLDER}/findings.md left as it is, every open entry still open: no plugin provides findings.onMerge`;
	const merged = await merge(job.id, "--decision", OWNER);
	assert.equal(merged.out.split("\n").filter((line) => line.startsWith("- Findings:")).join("\n"), left, "said once");
	assert.ok(readFileSync(join(root, FOLDER, "outcome.md"), "utf8").endsWith(`\n## Left open\n\n${left}\n`));
	assert.match(readFileSync(join(root, FOLDER, "findings.md"), "utf8"), /- Status: open\n/);
	// The test as the findings plugin with its default: each open entry a planning ticket.
	const asked: unknown[] = [];
	fake.provide("findings.onMerge", (request: { readonly project: string; readonly ticket: string; readonly path: string; readonly root: string }) => {
		asked.push(request);
		const text = readFileSync(join(request.root, request.path), "utf8");
		const made = [...text.matchAll(/^## (F\d+)\. (.+)\n\n(?:- .+\n)*?- Status: open$/gm)].map(([, n, title]) => `${fake.host.board.create(title ?? "", request.project).id} (${n})`);
		return made.length === 0 ? "- Findings: none open; no ticket made." : `- Tickets from findings: ${made.join(", ")}.`;
	});
	fake.provide("findings.onMerge", () => {
		throw new Error("a second plugin broke");
	});
	const cart = "spec/features/AC0002-cart";
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, `Ticket: ${cart}/ticket.md`);
	findings(cart, entry(1, "fixed in abc1234") + entry(2, "dropped (not needed)"));
	const passed = await review(second.id, "PASS");
	const none = await merge(second.id, "--decision", OWNER);
	assert.equal(none.code, undefined, none.err);
	assert.match(none.out, /\n- Findings: none open; no ticket made\.\n- Findings: findings\.onMerge of test failed: a second plugin broke; spec\/features\/AC0002-cart\/findings\.md left as it is\n/);
	assert.deepEqual(asked, [{ project: "acme", ticket: "AC0002", path: `${cart}/findings.md`, root, review: passed, notes: [] }]);
	assert.deepEqual(fake.host.board.list().map((ticket) => ticket.id), ["AC0001", "AC0002", "AC0003"], "no ticket made");
	const pay = "spec/features/AC0003-pay";
	const third = await worker({ "pay.ts": "export const pay = 1;\n" }, `Ticket: ${pay}/ticket.md`);
	findings(pay, entry(1, "fixed in abc1234") + entry(2, "open"));
	await review(third.id, "PASS");
	const made = await merge(third.id, "--decision", OWNER);
	assert.match(made.out, /\n- Tickets from findings: AC0004 \(F2\)\.\n/);
	assert.deepEqual([status("AC0003"), status("AC0004")], ["merged", "planning"], "the finding's ticket gets the next id after the board's");
	assert.match(readFileSync(join(root, pay, "outcome.md"), "utf8"), /\n## Left open\n\n- Tickets from findings: AC0004 \(F2\)\.\n- Findings: findings\.onMerge of test failed: /);
});

test("findings.onMerge gets the `## Notes` lines of the branch's last PASS review, its job with them; an earlier PASS's, a later FAIL's, another branch's or another heading's lines stay out; without a PASS review, none", async (t) => {
	const { root, fake, worker, review, merge } = await load(t);
	const asked: unknown[] = [];
	fake.provide("findings.onMerge", (request: unknown) => (asked.push(request), "- Tickets from findings: none open."));
	const job = await worker();
	const notes = ["- (security) `shop.ts:1`: The key is logged. An error prints it.", "- (minor) shop.ts:2: A long line. Wrap it."];
	const earlier = await review(job.id, "## Notes\n\n- (bug) shop.ts:5: An earlier PASS's note. Not filed.\n\nPASS");
	const passed = await review(job.id, `Clean.\n\n## Findings\n\n- (bug) shop.ts:9: Not a note. Under Findings.\n\n## Notes\n\n${notes.join("\n")}\nNo dash, no note.\n- a plain line\n\n## Checks run\n\n- (bug) test.js:1: Not a note either. Under Checks.\n\nPASS`);
	const failed = await review(job.id, "## Notes\n\n- (bug) shop.ts:3: A FAIL's note. Not filed.\n\nFAIL");
	const other = await worker({ "draft.ts": "export const draft = 1;\n" });
	const theirs = await review(other.id, "## Notes\n\n- (bug) draft.ts:1: Another branch's note. Not filed.\n\nPASS");
	for (const id of [earlier, passed, failed, theirs]) fake.host.jobs.file("AC0001", id);
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.deepEqual(asked, [{ project: "acme", ticket: "AC0001", path: `${FOLDER}/findings.md`, root, review: passed, notes }]);
	const cart = "spec/features/AC0002-cart";
	const unreviewed = await worker({ "cart.ts": "export const cart = 1;\n" }, `Ticket: ${cart}/ticket.md`);
	assert.equal((await merge(unreviewed.id, "--unreviewed", "--decision", OWNER)).code, undefined);
	assert.deepEqual(asked.at(-1), { project: "acme", ticket: "AC0002", path: `${cart}/findings.md`, root, review: "", notes: [] });
});
