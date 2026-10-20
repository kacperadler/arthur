import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { manage } from "../src/manage.ts";
import { findingLines } from "../src/stats.ts";

// `arthur stats` against the fake host, over the project acme, whose board and ticket folders the test writes as the core,
// delivery's reviews and `arthur merge`'s outcome leave them.

type Ticket = { readonly id: string; readonly title: string; readonly status: string; readonly updated: string; readonly files: Readonly<Record<string, string>> };

const ticket = (id: string, date?: string, decisions = "") =>
	`# ${id}\n\n\`\`\`json\n${JSON.stringify({ id, title: id, ...(date === undefined ? {} : { date }) }, null, 2)}\n\`\`\`\n\n## Decisions\n\n${decisions}`;
const review = (id: string, n: number, verdict: string, message: string) =>
	`# ${id} - Review ${n}\n\n- Job: 2026-01-01-review-${n}\n- Branch: h/x\n- Commit reviewed: abc\n- Verdict: ${verdict}\n\n## Final message\n\n${message}\n\n${verdict}`;
const outcome = (id: string, cost: string) => `# ${id} - Outcome\n\n- Merged: 2026-01-03, \`abc\`\n- Branch: h/x\n- Reviews: none\n- Cost: ${cost}; review rounds 0\n`;

// The project acme with `tickets` on its board, each in its own folder with its files; stats as `arthur stats` prints it.
async function load(t: TestContext, tickets: readonly Ticket[]) {
	const root = join(temporaryFolder(), "acme");
	const board = tickets.map(({ id, title, status, updated }) => ({ id, title, status, path: `spec/features/${id}-x/ticket.md`, updated }));
	for (const { id, files } of tickets)
		for (const [name, text] of Object.entries(files)) {
			mkdirSync(dirname(join(root, `spec/features/${id}-x`, name)), { recursive: true });
			writeFileSync(join(root, `spec/features/${id}-x`, name), text);
		}
	mkdirSync(join(root, "spec"), { recursive: true });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify(board));
	const fake = fakeHost({ name: "manage", timeZone: "Europe/Warsaw", now: new Date("2026-01-05T12:00:00Z") });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }, { name: "other", path: join(root, "missing"), prefix: "OT" }]);
	const plugin = manage();
	await fake.setup(plugin);
	const command = fake.commands.find((each) => each.name === "stats");
	return async (args: readonly string[] = [], project?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
}

const FAIL_NUMBERED = "Clean.\n\n**Findings**\n\n1. `src/shop.ts:12` - the total ignores the discount.\n   It is 10%.\n2. `test/shop.test.ts:4` - no test of an empty cart.\n\n**Notes (non-blocking)**\n- a note\n\n**Checks run**\n- 3. npm test";
const FAIL_BOLD =
	"## Findings\n\n**`src/pay.ts:3` - a refund is paid twice.**\n\nIt is sent again on a retry:\n- seen in the log\n**not a finding, no blank line before**\n\n**`src/pay.ts:9` - no receipt.**\n\n## Notes\n\n**a bold note**";

test("no merged ticket says so in one line; any argument is wrong usage; an unknown project is the board's refusal", async (t) => {
	const run = await load(t, [{ id: "AC0001", title: "Shop", status: "in-progress", updated: "2026-01-02T10:00:00Z", files: { "ticket.md": ticket("AC0001", "2026-01-01"), "review-1.md": review("AC0001", 1, "FAIL", FAIL_NUMBERED) } }]);
	assert.deepEqual(await run(), { code: 0, out: "No merged ticket in acme yet.", err: "" });
	assert.deepEqual(await run(["now"]), { code: 2, out: "", err: "usage: arthur stats [--project <name>]" });
	await assert.rejects(run([], "nope"), /unknown project nope; projects: acme, other/);
});

test("per merged ticket its rounds, verdicts, cost and days; the means and shares; a missing cost is unknown, never zero", async (t) => {
	const run = await load(t, [
		{
			id: "AC0001",
			title: "Shop",
			status: "merged",
			// 23:30 UTC is the next day in Warsaw: the days count by core.timeZone.
			updated: "2026-01-03T23:30:00Z",
			files: { "ticket.md": ticket("AC0001", "2026-01-01"), "review-1.md": review("AC0001", 1, "FAIL", FAIL_NUMBERED), "review-2.md": review("AC0001", 2, "PASS", "### Findings\nNone."), "outcome.md": outcome("AC0001", "worker $3.00, reviews $0.50") },
		},
		// No review and no outcome.md: cost unknown.
		{ id: "AC0002", title: "Cart", status: "merged", updated: "2026-01-02T08:00:00Z", files: { "ticket.md": ticket("AC0002", "2026-01-02") } },
		{
			id: "AC0003",
			title: "Fix the total",
			status: "merged",
			updated: "2026-01-03T08:00:00Z",
			files: { "ticket.md": ticket("AC0003", "2026-01-02", "- 2026-01-02: Pre-approved by policy: bug from F1 of AC0001, 1 Scope file, budget $1 of the $3 cap\n"), "review-1.md": review("AC0003", 1, "PASS", "Fine."), "outcome.md": outcome("AC0003", "worker $0.40, reviews $0.00") },
		},
		// A review without a verdict, then a FAIL found in review-10 sorted after review-2; a cost n/a; no date in its ticket.
		{
			id: "AC0004",
			title: "Pay",
			status: "merged",
			updated: "2026-01-04T08:00:00Z",
			files: { "ticket.md": ticket("AC0004", undefined, "- 2026-01-02: Pre-approved by policy is not this line\n"), "review-2.md": review("AC0004", 2, "none", "Stopped."), "review-10.md": review("AC0004", 10, "FAIL", FAIL_BOLD), "outcome.md": outcome("AC0004", "worker n/a, reviews $1.00") },
		},
		{ id: "AC0005", title: "Big", status: "merged", updated: "2026-01-04T08:00:00Z", files: { "ticket.md": ticket("AC0005", "2026-01-01"), "review-1.md": review("AC0005", 1, "PASS", "Fine."), "outcome.md": outcome("AC0005", "worker $8.00, reviews $1.00") } },
		{ id: "AC0006", title: "Open", status: "in-progress", updated: "2026-01-04T08:00:00Z", files: { "ticket.md": ticket("AC0006", "2026-01-01"), "review-1.md": review("AC0006", 1, "FAIL", FAIL_NUMBERED), "outcome.md": outcome("AC0006", "worker $50.00, reviews $0.00") } },
		// Merged unreviewed: its reviews cost $0.00, which is known.
		{ id: "AC0007", title: "Docs", status: "merged", updated: "2026-01-04T08:00:00Z", files: { "ticket.md": ticket("AC0007", "2026-01-04"), "outcome.md": outcome("AC0007", "worker $1.25, reviews $0.00") } },
	]);
	assert.deepEqual(await run(), {
		code: 0,
		err: "",
		out: [
			"Stats of acme: 6 merged tickets",
			"AC0001 Shop: 2 rounds (FAIL, PASS), $3.50, 3 days",
			"AC0002 Cart: no review, cost unknown, 0 days",
			"AC0003 Fix the total: 1 round (PASS), $0.40, 1 day, autopilot",
			"AC0004 Pay: 2 rounds (none, FAIL), cost unknown, days unknown",
			"AC0005 Big: 1 round (PASS), $9.00, 3 days",
			"AC0007 Docs: no review, $1.25, 0 days",
			"",
			"Mean review rounds: 1.5 over 4 reviewed tickets",
			"First-round PASS: 2 of 4 (50%) reviewed",
			"Autopilot: 1 of 6 (17%) merged",
			"Most expensive: AC0005 $9.00, AC0001 $3.50, AC0007 $1.25; cost unknown for 2 tickets",
			"FAIL findings:",
			"- AC0001 review-1: 1. `src/shop.ts:12` - the total ignores the discount.",
			"- AC0001 review-1: 2. `test/shop.test.ts:4` - no test of an empty cart.",
			"- AC0004 review-10: **`src/pay.ts:3` - a refund is paid twice.**",
			"- AC0004 review-10: **`src/pay.ts:9` - no receipt.**",
		].join("\n"),
	});
});

test("--project reads that project's board; with no review, no cost known and no FAIL, each line says so", async (t) => {
	const run = await load(t, [{ id: "AC0001", title: "Shop", status: "merged", updated: "2026-01-02T10:00:00Z", files: { "ticket.md": ticket("AC0001", "2026-01-01") } }]);
	const expected = ["Stats of acme: 1 merged ticket", "AC0001 Shop: no review, cost unknown, 1 day", "", "Mean review rounds: no ticket reviewed", "First-round PASS: no ticket reviewed", "Autopilot: 0 of 1 (0%) merged", "Most expensive: no ticket with a known cost; cost unknown for 1 ticket", "FAIL findings: none"];
	assert.deepEqual(await run([], "acme"), { code: 0, err: "", out: expected.join("\n") });
	assert.deepEqual(await run([], "other"), { code: 0, err: "", out: "No merged ticket in other yet." }, "the other project's board, not acme's");
});

test("the first line of each finding: by the section's first line's kind, up to the next section; without a heading, the first line", () => {
	const message = (text: string) => review("AC0001", 1, "FAIL", text);
	assert.deepEqual(findingLines(message("## Review Findings\n\n- `a.ts:1` - one\n  more of it\n- `b.ts:2` - two\n\n### Checks\n- npm test")), ["- `a.ts:1` - one", "- `b.ts:2` - two"]);
	assert.deepEqual(findingLines(message("Findings:\nThe cache is never cleared.\n1. not a second finding")), ["The cache is never cleared."]);
	assert.deepEqual(findingLines(message("\nThe branch breaks the build.\n\nMore.")), ["The branch breaks the build."]);
	assert.deepEqual(findingLines(message("## Findings\n\n## Notes\n- a note")), []);
});
