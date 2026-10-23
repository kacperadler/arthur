import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

// `arthur changelog` against the fake host, over the projects acme and beta, whose boards and ticket folders the test writes
// as the core and `arthur merge`'s outcome leave them.

type Ticket = { readonly id: string; readonly status: string; readonly updated?: string; readonly kind?: string; readonly merged?: string; readonly gone?: boolean };

const HEAD = "# Changelog\n\nGenerated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.\n";

// A project's folder with `tickets` on its board, each `ticket.md` with its `- Kind:` under `## Goal` (none without `kind`),
// and with `merged` an `outcome.md` whose Merged line is `<day>, <hash>`; `gone` leaves its ticket.md out.
function project(tickets: readonly Ticket[]): string {
	const root = temporaryFolder();
	const write = (path: string, text: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	};
	for (const { id, kind, merged, gone } of tickets) {
		const goal = kind === undefined ? "We are after a shop." : `We are after a shop.\n\n- Kind: ${kind}`;
		if (gone !== true) write(`spec/features/${id}-x/ticket.md`, `# ${id} - Title of ${id}\n\n## Description\n\n- Kind: bug\n\n## Goal\n\n${goal}\n\n## Done means\n\n- Kind: bug\n`);
		if (merged !== undefined) write(`spec/features/${id}-x/outcome.md`, `# ${id} - Outcome\n\n- Merged: ${merged}\`\n- Branch: arthur/x\n`);
	}
	const board = tickets.map(({ id, status, updated }) => ({ id, title: `Title of ${id}`, status, path: `spec/features/${id}-x/ticket.md`, updated: updated ?? "2026-01-01T00:00:00Z" }));
	write("spec/build.json", JSON.stringify(board));
	return root;
}

// `arthur changelog` as the CLI runs it, a throw rejecting; `acme` the main project, Pacific/Auckland the clock's time zone.
async function load(t: TestContext, acme: string, beta = project([])) {
	const fake = fakeHost({ name: "delivery", timeZone: "Pacific/Auckland" });
	fake.provide("projects", () => [{ name: "acme", path: acme, prefix: "AC" }, { name: "beta", path: beta, prefix: "BE" }]);
	await fake.setup(delivery());
	const command = fake.commands.find((each) => each.name === "changelog");
	return async (args: readonly string[] = [], name?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project: name })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
}

test("no merged ticket: the head and one line; wrong usage and an unknown project write nothing", async (t) => {
	const acme = project([{ id: "AC0001", status: "in-progress" }, { id: "AC0002", status: "dropped" }]);
	const run = await load(t, acme);
	assert.deepEqual(await run(["now"]), { code: 2, out: "", err: "usage: arthur changelog [--project <name>]" });
	await assert.rejects(run([], "nope"), /unknown project nope; projects: acme, beta/);
	assert.equal(existsSync(join(acme, "CHANGELOG.md")), false);
	assert.deepEqual(await run(), { code: 0, out: "wrote CHANGELOG.md: 0 merged tickets", err: "" });
	assert.equal(readFileSync(join(acme, "CHANGELOG.md"), "utf8"), `${HEAD}\nNo merged ticket yet.\n`);
});

test("by day, newest first, then by kind; a ticket without a kind, with an old one or any other, or without its ticket.md is Other; two runs write the same bytes", async (t) => {
	// The board in no order: the changelog's comes from the ids and the days only.
	const acme = project([
		{ id: "AC10000", status: "merged", kind: "fix", merged: "2026-01-03, `aaa1111" },
		{ id: "AC0005", status: "merged", kind: "refactor", merged: "2026-01-02, `bbb2222" },
		{ id: "AC0002", status: "merged", merged: "2026-01-03, `ccc3333" },
		{ id: "AC0009", status: "merged", kind: "feat", merged: "2026-01-03, `ddd4444" },
		{ id: "AC9999", status: "merged", kind: "security", merged: "2026-01-03, `eee5555" },
		{ id: "AC0001", status: "merged", kind: "docs", merged: "2026-01-02, `fff6666" },
		// No outcome.md: the day of its last move on the board, 20:00 UTC being the next day in Auckland.
		{ id: "AC0003", status: "merged", kind: "bug", updated: "2026-01-01T20:00:00Z" },
		{ id: "AC0004", status: "merged", kind: "toString", merged: "2026-01-02, `abc0004" },
		{ id: "AC0006", status: "merged", kind: "fix", merged: "2026-01-02, `abc0006", gone: true },
		{ id: "AC0007", status: "done", kind: "feat" },
		{ id: "AC0008", status: "dropped", kind: "feat" },
	]);
	const run = await load(t, acme);
	writeFileSync(join(acme, "CHANGELOG.md"), "# Changelog\n\nEdited by hand.\n");
	assert.deepEqual(await run(), { code: 0, out: "wrote CHANGELOG.md: 9 merged tickets", err: "" });
	const first = readFileSync(join(acme, "CHANGELOG.md"), "utf8");
	assert.equal(
		first,
		[
			HEAD,
			"## 2026-01-03\n\n### Added\n\n- AC0009 Title of AC0009 (ddd4444)\n\n### Fixed\n\n- AC9999 Title of AC9999 (eee5555)\n- AC10000 Title of AC10000 (aaa1111)\n\n### Other\n\n- AC0002 Title of AC0002 (ccc3333)\n",
			"## 2026-01-02\n\n### Changed\n\n- AC0001 Title of AC0001 (fff6666)\n- AC0005 Title of AC0005 (bbb2222)\n\n### Other\n\n- AC0003 Title of AC0003\n- AC0004 Title of AC0004 (abc0004)\n- AC0006 Title of AC0006 (abc0006)\n",
		].join("\n"),
	);
	await run();
	assert.equal(readFileSync(join(acme, "CHANGELOG.md"), "utf8"), first, "the same bytes again");
});

test("--project writes that project's CHANGELOG.md from its own board, the main one's left alone", async (t) => {
	const acme = project([{ id: "AC0001", status: "merged", kind: "feat", merged: "2026-01-02, `aaa1111" }]);
	const beta = project([{ id: "BE0001", status: "merged", kind: "fix", merged: "2026-01-04, `bbb2222" }]);
	const run = await load(t, acme, beta);
	assert.deepEqual(await run([], "beta"), { code: 0, out: "wrote CHANGELOG.md: 1 merged ticket", err: "" });
	assert.equal(readFileSync(join(beta, "CHANGELOG.md"), "utf8"), `${HEAD}\n## 2026-01-04\n\n### Fixed\n\n- BE0001 Title of BE0001 (bbb2222)\n`);
	assert.equal(existsSync(join(acme, "CHANGELOG.md")), false);
});
