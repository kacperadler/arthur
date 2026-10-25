import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration, type OrchestrationOptions } from "../src/orchestration.ts";

const SOURCE = "spec/features/AC0001-source";
const FOLDER = "spec/features/AC0002-fix";
const TICKET = `${FOLDER}/ticket.md`;

type Parts = { readonly kind?: string; readonly scope?: string; readonly decisions?: string };
type Loaded = { preApprove(budgetUsd?: number): Promise<string>; status(): string | undefined; text(): string };

const ticketText = ({ kind = "fix", scope = "In:\n- `src/a.ts`: the fix.\n- `test/a.test.ts` (`fixIt`)\n\nOut:\n- `src/b.ts`, `src/c.ts`: another ticket.", decisions = "- 2026-01-01: Source: F1 of AC0001" }: Parts = {}) =>
	`# AC0002 - Fix\n\n\`\`\`json\n{ "id": "AC0002" }\n\`\`\`\n\n## Goal\n\nA fix.\n\n- Kind: ${kind}\n\n## Scope\n\n${scope}\n\n## Decisions\n\n${decisions}\n`;

// Prompt files later jobs and the coordinator read, which delivery's default list holds (AR0351).
const HELD = [".agents/arthur/roles/worker.md", ".agents/arthur/criteria/styleguide.md", "spec/vision.md", "packages/orchestration/roles/coordinator.md"];
// The project `acme` (prefix AC): AC0001, whose findings.md has F1, and AC0002 in planning, made from `parts`; the plugin set up on
// the fake host with `options`, and delivery's always-review list (`package.json` and the prompt files `HELD`) provided unless `delivery` is false.
async function load(parts: Parts = {}, options: OrchestrationOptions = {}, delivery = true) {
	const root = join(temporaryFolder(), "acme");
	for (const folder of [SOURCE, FOLDER, "src/lib", "spec/quality"]) mkdirSync(join(root, folder), { recursive: true });
	writeFileSync(join(root, SOURCE, "findings.md"), "# AC0001 - Findings\n\n## F1. The bug\n\n- Status: open\n");
	writeFileSync(join(root, TICKET), ticketText(parts));
	writeFileSync(join(root, "spec/quality/2026-01-01.md"), "# Audit\n");
	const entry = (id: string, path: string, status: string) => ({ id, title: id, status, path, updated: "2026-01-01T00:00:00Z" });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([entry("AC0001", `${SOURCE}/ticket.md`, "merged"), entry("AC0002", TICKET, "planning")]));
	const fake = fakeHost({ name: "orchestration", options, now: new Date("2026-03-04T05:00:00Z") });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const asked: unknown[] = [];
	if (delivery)
		fake.provide("delivery.alwaysReview", (request: { readonly paths: readonly string[] }) => {
			asked.push(request);
			return request.paths.filter((path) => path === "package.json" || HELD.includes(path));
		});
	await fake.setup(orchestration(options));
	const preApprove = (budgetUsd?: number) => fake.call<Promise<string>>("ticket.autopilot", { id: "AC0002", ...(budgetUsd === undefined ? {} : { budgetUsd }) });
	const status = () => fake.host.board.get("AC0002")?.status;
	const text = () => readFileSync(join(root, TICKET), "utf8");
	return { root, fake, asked, preApprove, status, text };
}

// Refused with exactly `problems`, and the ticket left as it was: still in planning, its ticket.md unchanged.
async function refused(loaded: Loaded, problems: readonly string[], budgetUsd?: number) {
	const before = loaded.text();
	await assert.rejects(loaded.preApprove(budgetUsd), { message: `AC0002: not pre-approved: ${problems.join("; ")}` });
	assert.equal(loaded.status(), "planning");
	assert.equal(loaded.text(), before);
}

test("a fix from a finding, 2 Scope files, none held, is set planned with the budget default and its record under Decisions", async () => {
	const loaded = await load();
	const record = "Pre-approved by policy: fix from F1 of AC0001, 2 Scope files, budget $1 of the $3 cap";
	assert.equal(await loaded.preApprove(), `AC0002 planned: ${record}; spawn its worker with --budget 1`);
	assert.equal(loaded.status(), "planned");
	assert.equal(loaded.text(), ticketText().replace("- 2026-01-01: Source: F1 of AC0001\n", `- 2026-01-01: Source: F1 of AC0001\n- 2026-03-04: ${record}\n`));
	assert.deepEqual(loaded.asked, [{ project: "acme", paths: ["src/a.ts", "test/a.test.ts"] }], "the files after Out: are not the ticket's");
	assert.deepEqual(
		loaded.fake.emitted.map((event) => [event.name, event.data]),
		[["ticket-moved", { id: "AC0002", project: "acme", from: "planning", to: "planned" }]],
	);
	// Once planned, a second pre-approval is refused and adds no second record.
	const approved = loaded.text();
	await assert.rejects(loaded.preApprove(), { message: "AC0002: not pre-approved: it is planned; autopilot pre-approves a ticket in planning" });
	assert.equal(loaded.text(), approved);
});

test("two pre-approvals of one ticket at once record it once: the second waits, then sees it planned", async () => {
	const loaded = await load();
	const results = await Promise.allSettled([loaded.preApprove(), loaded.preApprove()]);
	assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
	assert.match(String(results.find((result) => result.status === "rejected")?.reason), /it is planned; autopilot pre-approves a ticket in planning/);
	assert.equal(loaded.text().split("Pre-approved by policy").length, 2, "one record");
	assert.equal(loaded.fake.emitted.filter((event) => event.name === "ticket-moved").length, 1);
});

test("exactly 3 Scope files pass, a path with a line number or named twice counted once; a refactor from an audit at the cap passes", async () => {
	const scope = "In:\n- `src/a.ts:12`, `src/a.ts:40-52`, `src/b.ts`\n- `README.md`: a line. `arthur ticket status` and `fixIt` are no files.";
	const loaded = await load({ kind: "refactor", scope, decisions: "- 2026-01-01: Source: audit spec/quality/2026-01-01.md" });
	assert.match(await loaded.preApprove(3), /^AC0002 planned: Pre-approved by policy: refactor from audit spec\/quality\/2026-01-01\.md, 3 Scope files, budget \$3 of the \$3 cap;/);
	assert.deepEqual(loaded.asked, [{ project: "acme", paths: ["src/a.ts", "src/b.ts", "README.md"] }]);
});

test("autopilot takes a fix, refactor, chore, docs or test ticket and refuses every other kind, the old ones included", async () => {
	for (const kind of ["fix", "refactor", "chore", "docs", "test"]) assert.match(await (await load({ kind })).preApprove(), new RegExp(`^AC0002 planned: Pre-approved by policy: ${kind} from F1`), kind);
	for (const kind of ["feat", "security", "perf", "build", "ci", "ux", "bug", "cleanup"]) {
		await refused(await load({ kind }), [`its kind is ${kind}; autopilot pre-approves only fix or refactor or chore or docs or test`]);
	}
});

test("refused, each naming the rule broken: a feat, 4 Scope files, a file on the always-review list, budget 0, a budget over the cap", async () => {
	await refused(await load({ kind: "feat" }), ["its kind is feat; autopilot pre-approves only fix or refactor or chore or docs or test"]);
	const four = "In:\n- `src/a.ts`, `src/b.ts`, `src/c.ts`, `src/d.ts`";
	await refused(await load({ scope: four }), ["its Scope names 4 files, at most 3: src/a.ts, src/b.ts, src/c.ts, src/d.ts"]);
	await refused(await load({ scope: "In:\n- `src/a.ts`, `package.json`" }), ["on delivery's always-review list: package.json"]);
	for (const path of HELD) await refused(await load({ scope: `In:\n- \`${path}\`: a line.` }), [`on delivery's always-review list: ${path}`]);
	await refused(await load(), ["budget $0; a pre-approved ticket needs a budget above 0 (--budget, the budget of its JSON block, or autopilot.budgetUsd)"], 0);
	await refused(await load({}, { autopilot: { budgetUsd: 0 } }), ["budget $0; a pre-approved ticket needs a budget above 0 (--budget, the budget of its JSON block, or autopilot.budgetUsd)"]);
	await refused(await load(), ["budget $3.5 is over the cap of $3 (autopilot.budgetMaxUsd)"], 3.5);
	await refused(await load({}, { autopilot: { budgetMaxUsd: 5 } }), ["budget $6 is over the cap of $5 (autopilot.budgetMaxUsd)"], 6);
	// Every rule broken at once is named at once.
	await refused(await load({ kind: "feat", scope: four.replace("src/d.ts", "package.json") }), [
		"its kind is feat; autopilot pre-approves only fix or refactor or chore or docs or test",
		"its Scope names 4 files, at most 3: src/a.ts, src/b.ts, src/c.ts, package.json",
		"on delivery's always-review list: package.json",
		"budget $0; a pre-approved ticket needs a budget above 0 (--budget, the budget of its JSON block, or autopilot.budgetUsd)",
	], 0);
});

test("the budget of the ticket's JSON block is taken when --budget is left out, still capped; a block that is not JSON is refused", async () => {
	const withBudget = async (json: string) => {
		const loaded = await load();
		writeFileSync(join(loaded.root, TICKET), loaded.text().replace('{ "id": "AC0002" }', json));
		return loaded;
	};
	const own = await withBudget('{ "id": "AC0002", "budget": 2.5 }');
	assert.match(await own.preApprove(), /, budget \$2\.5 of the \$3 cap; spawn its worker with --budget 2\.5$/);
	assert.match(await (await withBudget('{ "id": "AC0002", "budget": 2.5 }')).preApprove(1), /; spawn its worker with --budget 1$/, "--budget wins");
	await refused(await withBudget('{ "id": "AC0002", "budget": 4 }'), ["budget $4 is over the cap of $3 (autopilot.budgetMaxUsd)"]);
	await refused(await withBudget('{ "id": "AC0002", "budget": 0 }'), ["budget $0; a pre-approved ticket needs a budget above 0 (--budget, the budget of its JSON block, or autopilot.budgetUsd)"]);
	await refused(await withBudget('{ "id": "AC0002", "budget": "2" }'), ['budget "2"; a pre-approved ticket needs a budget above 0 (--budget, the budget of its JSON block, or autopilot.budgetUsd)']);
	const broken = await withBudget('{ "id": "AC0002", }');
	await assert.rejects(broken.preApprove(), { message: /^AC0002: not pre-approved: its JSON block is not JSON \(.+\); fix it by hand$/ });
	assert.equal(broken.status(), "planning");
});

test("the always-review list not provided (delivery off), or answered in another shape, refuses rather than passes", async () => {
	await refused(await load({}, {}, false), ['the always-review list was not asked (plugin orchestration: call("delivery.alwaysReview"): no plugin provides it); autopilot refuses rather than passes']);
	for (const answer of [undefined, "package.json", [1]]) {
		const loaded = await load({}, {}, false);
		loaded.fake.provide("delivery.alwaysReview", () => answer);
		await refused(loaded, ["delivery.alwaysReview answered no list of paths; autopilot refuses rather than passes"]);
	}
});

test("a ticket from no finding or audit that exists, of no kind, or whose Scope names no file, a folder or a pattern is refused", async () => {
	const nowhere = 'it is not from a finding or an audit: no "- YYYY-MM-DD: Source: F<n> of <id>" or "Source: audit spec/quality/<file>.md" under its Decisions names one that exists';
	for (const decisions of ["- 2026-01-01: The owner: fix it.", "- 2026-01-01: Source: F2 of AC0001", "- 2026-01-01: Source: F1 of AC0009", "- 2026-01-01: Source: audit spec/quality/2026-02-02.md"])
		await refused(await load({ decisions }), [nowhere]);
	await refused(await load({ kind: "" }), ["its kind is missing (- Kind: under its Goal); autopilot pre-approves only fix or refactor or chore or docs or test"]);
	const loaded = await load();
	writeFileSync(join(loaded.root, TICKET), loaded.text().replace("- Kind: fix\n", ""));
	await refused(loaded, ["its kind is missing (- Kind: under its Goal); autopilot pre-approves only fix or refactor or chore or docs or test"]);
	await refused(await load({ scope: "In:\n- the parser.\n\nOut:\n- `src/b.ts`" }), ["its Scope names no file (a backticked path before Out:)"]);
	await refused(await load({ scope: "In:\n<!-- - `path/to/file.ts`: what changes there. -->\n- the parser." }), ["its Scope names no file (a backticked path before Out:)"]);
	await refused(await load({ scope: "In:\n- `src/lib`, `test/`, `src/*.ts`" }), ["its Scope names a folder or a pattern, not one file: src/lib, test/, src/*.ts"]);
});

test("a move the board refuses leaves no record: the ticket.md is as it was", async () => {
	const loaded = await load({ decisions: "- 2026-01-01: Source: F1 of AC0001\n<!-- - YYYY-MM-DD: one decision the human made, in one line. -->" });
	const before = loaded.text();
	await assert.rejects(loaded.preApprove(), /^Error: AC0002: not planned: .* still holds the template's guidance/);
	assert.equal(loaded.text(), before);
	assert.equal(loaded.status(), "planning");
});

test("a ticket not on the board is refused", async () => {
	const { fake } = await load();
	await assert.rejects(fake.call<Promise<string>>("ticket.autopilot", { id: "AC0009" }), { message: "AC0009 is not on the board" });
});
