import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import type { Plugin } from "@arthur/core/plugin";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "@arthur/delivery";
import { findings } from "@arthur/findings";
import { projects } from "@arthur/projects";

// Roadmap entry 83 with the merge (54) that asks it: `arthur merge` of a worker's branch whose findings.md has an open entry,
// with the findings plugin loaded and without it. A plugin's own tests never load another plugin; this one, outside every
// package, loads them together.

const FOLDER = "spec/features/SH0001-shop";
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" }).trim();

// The repository `shop` (SH) with SH0001 planned; projects, delivery and, with `withFindings`, findings set up on one fake host
// with `settings`; `merged()` runs a worker on SH0001 whose branch commits a findings.md with F1 open and F2 fixed, then
// `arthur merge --unreviewed`.
async function load(t: TestContext, withFindings: boolean, settings: Readonly<Record<string, unknown>> = {}) {
	const shop = temporaryFolder();
	const board = [{ id: "SH0001", title: "Shop", status: "planned", path: `${FOLDER}/ticket.md`, updated: "2026-10-21T08:00:00Z" }];
	for (const [path, text] of Object.entries({ "README.md": "# Shop\n", [`${FOLDER}/ticket.md`]: "# SH0001 - Shop\n", "spec/build.json": JSON.stringify(board) })) {
		mkdirSync(dirname(join(shop, path)), { recursive: true });
		writeFileSync(join(shop, path), text);
	}
	git(shop, "init", "--quiet", "--initial-branch=main");
	git(shop, "add", "--all");
	git(shop, "commit", "--quiet", "-m", "first");
	git(shop, "config", "user.name", "t");
	git(shop, "config", "user.email", "t@example.com");
	const list = [{ name: "shop", prefix: "SH", path: shop }];
	const fake = fakeHost({ name: "projects", now: new Date("2026-10-21T10:00:00Z") });
	const plugins: [Plugin, Readonly<Record<string, unknown>>][] = [[projects({ list }), { list }], [delivery(), {}], ...(withFindings ? [[findings(), settings] as [Plugin, {}]] : [])];
	for (const [plugin, options] of plugins) await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	// orchestration's check of the owner's decision is its own tests' (AR0355): here every id is the owner's.
	fake.provide("decision.owner", () => "");
	const saved = process.env.PATH;
	t.after(() => {
		process.env.PATH = saved;
	});
	const merged = async () => {
		process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "Done." }] }))}${delimiter}${saved}`;
		const job = await fake.host.jobs.spawn({ task: `Ticket: ${FOLDER}/ticket.md` });
		const state = join(dirname(fake.host.folder), "jobs", job.id, "state");
		for (const deadline = Date.now() + 15_000; !existsSync(state) || readFileSync(state, "utf8") !== "ended"; await sleep(50))
			if (Date.now() > deadline) throw new Error(`timed out waiting for ${job.id} to end`);
		const text = "# SH0001 - Findings\n\n## F1. Prices round down\n\n- Kind: bug\n- What: 1.005 shows as 1.00.\n- Status: open\n\n## F2. Typo\n\n- Kind: cleanup\n- Status: fixed in abc1234\n";
		writeFileSync(join(job.worktree, FOLDER, "findings.md"), text);
		git(job.worktree, "add", "--all");
		git(job.worktree, "commit", "--quiet", "-m", "fix(SH0001): the shop, and its findings");
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (line: string) => out.push(line));
		t.mock.method(console, "error", (line: string) => err.push(line));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === "merge")?.run({ args: [job.id, "--unreviewed", "--decision", "SH-D1"], project: undefined }));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n"), text, outcome: readFileSync(join(shop, FOLDER, "outcome.md"), "utf8"), findings: readFileSync(join(shop, FOLDER, "findings.md"), "utf8") };
	};
	return { shop, fake, merged };
}

test("with the findings plugin, the merge makes the open finding a planning ticket and writes its status; the fixed one is left alone", async (t) => {
	const { fake, merged } = await load(t, true);
	const { code, out, err, text, outcome, findings: after } = await merged();
	assert.equal(code, undefined, err);
	assert.match(out, /\n- Tickets from findings: SH0002 \(F1\)\.\n/);
	assert.ok(outcome.endsWith("\n## Left open\n\n- Tickets from findings: SH0002 (F1).\n"), outcome);
	assert.equal(after, text.replace("- Status: open", "- Status: ticket SH0002"));
	assert.deepEqual(
		fake.host.board.list("shop").map((ticket) => [ticket.id, ticket.title, ticket.status]),
		[
			["SH0001", "Shop", "merged"],
			["SH0002", "Prices round down", "planning"],
		],
	);
	assert.match(readFileSync(join(fake.host.board.projects()[0]?.path ?? "", fake.host.board.get("SH0002")?.path ?? ""), "utf8"), /## Decisions\n\n- 2026-10-21: Source: F1 of SH0001\n$/);
});

test("without the findings plugin, the merge leaves every finding open and says so once", async (t) => {
	const { fake, merged } = await load(t, false);
	const { code, out, err, text, outcome, findings: after } = await merged();
	assert.equal(code, undefined, err);
	const left = `- Findings: ${FOLDER}/findings.md left as it is, every open entry still open: no plugin provides findings.onMerge`;
	assert.deepEqual(out.split("\n").filter((line) => line.startsWith("- Findings") || line.startsWith("- Tickets")), [left]);
	assert.ok(outcome.endsWith(`\n## Left open\n\n${left}\n`), outcome);
	assert.equal(after, text);
	assert.deepEqual(fake.host.board.list("shop").map((ticket) => ticket.id), ["SH0001"]);
	assert.equal(fake.commands.some((command) => command.name === "findings"), false, "no /findings without the plugin");
});

// The procedure the merge prints after it tells the coordinator to settle the reviews' notes as the merge settled the open
// entries, so it must name what the findings plugin settles them with in each mode: the outcome's line, the status, the title.
test("the procedure after the merge names what each findings mode settles the open entries with", async (t) => {
	for (const mode of ["ticket", "grouped", "summary"]) {
		const { fake, merged } = await load(t, true, { mode: { shop: mode } });
		const { code, out, err, outcome, findings: after } = await merged();
		assert.equal(code, undefined, err);
		const procedure = out.slice(out.indexOf("# After a merge that went in"));
		const line = outcome.split("\n").at(-2) ?? "";
		assert.ok(procedure.includes(`\`${line.slice(0, line.indexOf(":") + 1)}\``), `${mode}: the procedure names ${line}`);
		const status = /^- Status: (.+)$/m.exec(after)?.[1] ?? "";
		const made = fake.host.board.get("SH0002")?.title;
		const named = { ticket: `\`${status.replace("SH0002", "<id>")}\``, grouped: `\`${made?.replace("SH0001", "<ticket>").replace("Shop", "<its title>")}\``, summary: `\`${status}\`` }[mode] ?? "";
		assert.ok(procedure.includes(named), `${mode}: the procedure names ${named}, as ${status} and ${made} show`);
		assert.ok(procedure.includes(`(\`${mode}\`)`), `${mode}: the procedure names the mode`);
	}
});
