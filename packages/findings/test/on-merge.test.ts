import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { findings } from "../src/findings.ts";

const FOLDER = "spec/features/AC0001-shop";
const PATH = `${FOLDER}/findings.md`;
const TEMPLATE = readFileSync(new URL("../templates/findings.md", import.meta.url), "utf8");
const HEAD = "# AC0001 - Findings\n\nWhat was discovered.\n\n";

// Two projects, `acme` (AC), whose ticket AC0001 "Shop" was just merged, and `shop` (SH), each with a real board; the plugin
// set up with `mode`; `merge(text)` writes AC0001's findings.md (none when left out) and asks `findings.onMerge` as
// `arthur merge` does; `ticket(id)` reads a ticket's ticket.md.
async function load(mode?: Readonly<Record<string, string>>) {
	const [root, shop] = [join(temporaryFolder(), "acme"), join(temporaryFolder(), "shop")];
	mkdirSync(join(root, FOLDER), { recursive: true });
	mkdirSync(join(shop, "spec"), { recursive: true });
	writeFileSync(join(root, FOLDER, "ticket.md"), "# AC0001 - Shop\n");
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "Shop", status: "merged", path: `${FOLDER}/ticket.md`, updated: "2026-10-21T08:00:00Z" }]));
	writeFileSync(join(shop, "spec/build.json"), "[]");
	const options = mode === undefined ? {} : { mode };
	const fake = fakeHost({ name: "findings", options, now: new Date("2026-10-21T10:00:00Z") });
	fake.provide("projects", () => [
		{ name: "acme", path: root, prefix: "AC" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	await fake.setup(findings(options as Parameters<typeof findings>[0]));
	const merge = (text?: string) => {
		if (text !== undefined) writeFileSync(join(root, PATH), text);
		return fake.call<string>("findings.onMerge", { project: "acme", ticket: "AC0001", path: PATH, root });
	};
	const ticket = (id: string) => {
		const found = fake.host.board.get(id);
		return found === undefined ? undefined : { ...found, text: readFileSync(join(root, found.path), "utf8") };
	};
	return { root, fake, merge, ticket, read: () => readFileSync(join(root, PATH), "utf8"), ids: () => fake.host.board.list("acme").map((each) => each.id) };
}

const entry = (n: number, title: string, status: string, lines = "- Kind: bug\n") => `## F${n}. ${title}\n\n${lines}- What: something at F${n}.\n- Status: ${status}\n\n`;

test("no findings.md, or no open entry in it, makes nothing; an entry already ticket, fixed, dropped or deferred is left alone; its first Status counts, up to the next heading", async () => {
	for (const mode of ["ticket", "grouped", "summary"]) {
		const { merge, read, ids, root } = await load({ acme: mode });
		assert.equal(merge(), "- Findings: none; no findings.md on this ticket.", mode);
		assert.equal(existsSync(join(root, PATH)), false, mode);
		assert.equal(merge(""), "- Tickets from findings: none open.", `${mode}: an empty file`);
		const settled = [
			HEAD,
			entry(1, "Fixed", "fixed in abc1234"),
			entry(2, "Ticketed", "ticket AC0001"),
			entry(3, "Dropped", "dropped (not needed)"),
			entry(4, "Deferred", "deferred (client summary)"),
			entry(5, "Open in words", "Open"),
			"## F6. No status\n\n- What: it says none.\n\n## Notes, not an entry\n\n- Status: open\n\n",
			"## F8. Two statuses\n\n- Status: dropped (twice)\n- Status: open\n\n",
			TEMPLATE.replace("{{id}}", "AC0001").replace("## F1.", "## F7."),
		].join("");
		assert.equal(merge(settled), "- Tickets from findings: none open.", mode);
		assert.equal(read(), settled, `${mode}: the file as it was`);
		assert.deepEqual(ids(), ["AC0001"], `${mode}: no ticket made`);
	}
});

test("ticket, the default: each open entry its own planning ticket, its Description the finding, its kind, budget and source; its status the ticket", async () => {
	const { merge, read, ids, ticket } = await load({ shop: "summary" });
	const text = [
		HEAD,
		entry(1, "Fixed", "fixed in abc1234"),
		entry(2, "The cart loses an item", "open", "- Kind: bug\n- Where: `cart.ts:12`\n- Budget: 1.5\n"),
		entry(3, "Dropped", "dropped (not needed)"),
		entry(4, "Name the total", "open", "- Kind: improvement\n- Budget: about 2\n"),
		entry(5, "Odd kind", "open", "- Kind: chore\n"),
	].join("");
	assert.equal(merge(text), "- Tickets from findings: AC0002 (F2), AC0003 (F4), AC0004 (F5).");
	assert.equal(read(), text.replace("- Status: open", "- Status: ticket AC0002").replace("- Status: open", "- Status: ticket AC0003").replace("- Status: open", "- Status: ticket AC0004"));
	assert.deepEqual(ids(), ["AC0001", "AC0002", "AC0003", "AC0004"]);
	const two = ticket("AC0002");
	assert.deepEqual([two?.title, two?.status], ["The cart loses an item", "planning"]);
	assert.match(two?.text ?? "", /^# AC0002 - The cart loses an item\n\n```json\n\{\n {2}"id": "AC0002",\n {2}"title": "The cart loses an item",\n {2}"date": "2026-10-21",\n {2}"budget": 1\.5\n\}\n```\n/);
	assert.ok(two?.text.includes(`## Description\n\nF2 of AC0001 (${PATH}).\n\n- Kind: bug\n- Where: \`cart.ts:12\`\n- Budget: 1.5\n- What: something at F2.\n\n## Goal\n`), two?.text);
	assert.ok(two?.text.includes("\n- Kind: bug\n\n## Done means\n\n<!-- "), "its kind; the rest of the template's guidance is the coordinator's");
	assert.ok(two?.text.endsWith("## Decisions\n\n- 2026-10-21: Source: F2 of AC0001\n"), two?.text);
	const four = ticket("AC0003")?.text ?? "";
	assert.doesNotMatch(four, /"budget"/, "a Budget that is no amount gives the ticket none");
	assert.ok(four.includes("\n- Kind: improvement\n"));
	assert.ok((ticket("AC0004")?.text ?? "").includes("\n- Kind: <!-- feature | bug | risk | cleanup | improvement -->\n"), "a kind the ticket template does not know is left to the coordinator");
});

test("grouped: one planning ticket for every open entry; with one open entry, one ticket", async () => {
	const { merge, read, ids, ticket } = await load({ acme: "grouped", shop: "summary" });
	const one = HEAD + entry(1, "Fixed", "fixed in abc1234") + entry(2, "The only one", "open", "- Kind: cleanup\n- Budget: 0.5\n");
	assert.equal(merge(one), "- Tickets from findings: AC0002 (F2).");
	assert.equal(read(), one.replace("- Status: open", "- Status: ticket AC0002"));
	const single = ticket("AC0002");
	assert.equal(single?.title, "Findings of AC0001: Shop");
	assert.ok(single?.text.includes(`## Description\n\nThe open findings of AC0001 (${PATH}), made one ticket at its merge.\n\n### F2. The only one\n\n- Kind: cleanup\n- Budget: 0.5\n- What: something at F2.\n\n## Goal`), single?.text);
	assert.ok(single?.text.includes('"budget": 0.5') && single.text.includes("\n- Kind: cleanup\n") && single.text.endsWith("- 2026-10-21: Source: F2 of AC0001\n"));
	const three = HEAD + entry(1, "First", "open", "- Kind: cleanup\n- Budget: 1.1\n") + entry(2, "Second", "dropped (no)") + entry(3, "Third", "open", "- Kind: cleanup\n- Budget: 0.2\n") + entry(4, "Fourth", "open", "- Kind: bug\n");
	assert.equal(merge(three), "- Tickets from findings: AC0003 (F1, F3, F4).");
	assert.equal(read(), three.replaceAll("- Status: open", "- Status: ticket AC0003"));
	assert.deepEqual(ids(), ["AC0001", "AC0002", "AC0003"], "one ticket for the three");
	const all = ticket("AC0003")?.text ?? "";
	assert.ok(all.endsWith("## Decisions\n\n- 2026-10-21: Source: F1 of AC0001\n- 2026-10-21: Source: F3 of AC0001\n- 2026-10-21: Source: F4 of AC0001\n"), all);
	assert.ok(all.includes("### F1. First\n") && all.includes("### F3. Third\n") && all.includes("### F4. Fourth\n") && !all.includes("Second"));
	assert.ok(all.includes("\n- Kind: <!-- ") && !all.includes('"budget"'), "kinds that differ and a finding without a budget leave both to the coordinator");
	const both = HEAD + entry(1, "First", "open", "- Kind: cleanup\n- Budget: 1.1\n") + entry(2, "Second", "open", "- Kind: cleanup\n- Budget: 0.2\n");
	assert.equal(merge(both), "- Tickets from findings: AC0004 (F1, F2).");
	assert.ok((ticket("AC0004")?.text ?? "").includes('"budget": 1.3'), "the budgets added up");
});

test("summary: no ticket; each open entry deferred (client summary) and listed for the client", async () => {
	const { merge, read, ids } = await load({ acme: "summary", shop: "grouped" });
	const text = HEAD + entry(1, "Fixed", "fixed in abc1234") + entry(2, "Slow search", "open") + entry(3, "Old logo", "open");
	assert.equal(merge(text), "- Deferred (client summary): F2. Slow search\n- Deferred (client summary): F3. Old logo");
	assert.equal(read(), text.replaceAll("- Status: open", "- Status: deferred (client summary)"));
	assert.deepEqual(ids(), ["AC0001"]);
	assert.equal(merge(read()), "- Tickets from findings: none open.", "asked again, nothing is open");
});

test("an entry whose title the board refuses stays open and is said; the others get their tickets", async () => {
	const { merge, read, ids } = await load();
	const text = HEAD + entry(1, "???", "open") + entry(2, "A real one", "open");
	assert.equal(merge(text), '- Tickets from findings: AC0002 (F2).\n- Findings: F1 left open, no ticket made: a title needs a letter a-z or a digit, for its folder name: "???"');
	assert.equal(read(), HEAD + entry(1, "???", "open") + entry(2, "A real one", "ticket AC0002"));
	assert.deepEqual(ids(), ["AC0001", "AC0002"]);
	const none = HEAD + entry(1, "!!!", "open");
	assert.equal(merge(none), '- Findings: F1 left open, no ticket made: a title needs a letter a-z or a digit, for its folder name: "!!!"');
	assert.equal(read(), none, "nothing made, the file untouched");
});

test("a worker's prompt carries the findings.md template; other roles get nothing", async () => {
	const { fake } = await load();
	const job = { project: "acme", root: "/x", base: "abc" };
	const [worker] = fake.collect<string | undefined>("prompt", "worker", job);
	assert.equal(worker, `## The findings.md format\n\nA ticket's findings.md that does not exist yet starts from this template, {{id}} the ticket's id:\n\n\`\`\`markdown\n${TEMPLATE.trim()}\n\`\`\``);
	assert.ok(TEMPLATE.includes("- Status: open | fixed in <commit> | ticket <id> | deferred (client summary) | dropped (<reason>)\n"));
	for (const role of ["reviewer", "planner", "coordinator"]) assert.deepEqual(fake.collect("prompt", role, job), [undefined], role);
});
