import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/plugin").replace(/plugin\.ts$/, "cli.ts"));

// Two projects, `demo` (the main one) and `shop`, prefixes DM and SH unless `prefixes` names others, with the plugin set up
// on the fake host, and each command's reply reached through `route`, as a channel reaches it.
async function setup(prefixes: readonly [string, string] = ["DM", "SH"]) {
	const fake = fakeHost({ name: "orchestration" });
	const [demo, shop] = [temporaryFolder(), temporaryFolder()];
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: prefixes[0] },
		{ name: "shop", path: shop, prefix: prefixes[1] },
	]);
	await fake.setup(orchestration());
	return { route: fake.host.commands.route, commands: fake.host.commands, demo, shop };
}

// A board written by hand: for each spec, `count` tickets of `status`, numbered on from 1, each with a `ticket.md`, whose
// Goal has the line `- Kind: <kind>` when the spec names one.
function tickets(root: string, prefix: string, specs: readonly (readonly [status: string, count: number, title?: string, kind?: string])[]): void {
	const entries = specs.flatMap(([status, count, title, kind]) => Array.from({ length: count }, () => ({ status, title, kind })));
	const board = entries.map(({ status, title, kind }, index) => {
		const id = `${prefix}${String(index + 1).padStart(4, "0")}`;
		const path = `spec/features/${id}-ticket/ticket.md`;
		mkdirSync(join(root, path, ".."), { recursive: true });
		writeFileSync(join(root, path), `# ${id} - the ticket\n${kind === undefined ? "" : `\n## Goal\n\n- Kind: ${kind}\n`}`);
		return { id, title: title ?? `Ticket ${id}`, status, path, updated: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString() };
	});
	writeFileSync(join(root, "spec", "build.json"), JSON.stringify(board));
}

const KINDS = "feat, fix, security, perf, refactor, test, docs, build, ci, chore, ux";
const USAGE = "usage: /board [PREFIX] [all | KIND | --kind KIND]";

test("the board's three commands and /silent are phone commands, each in a channel's menu", async () => {
	assert.deepEqual(
		(await setup()).commands.phone().map((command) => command.name),
		["board", "plan", "silent", "task"],
	);
});

test("/board: the full board when it fits one message, else the digest; all: the full board whatever its length", async () => {
	const { route, demo } = await setup();
	assert.equal(await route("/board"), "the board is empty");
	tickets(demo, "DM", [["merged", 12], ["dropped", 1], ["planning", 1]]);
	const small = await route("/board");
	assert.equal(small.split("\n").length, 14, "every ticket, the 2 older merged and the dropped one included");
	assert.match(small, /^DM0014 planning    -        Ticket DM0014\nDM0012 merged      -        Ticket DM0012\n/);
	assert.match(small, /\nDM0001 merged      -        Ticket DM0001\nDM0013 dropped     -        Ticket DM0013$/);
	tickets(demo, "DM", [["merged", 12], ["dropped", 1], ["planning", 40, `A long title ${"x".repeat(80)}`]]);
	const full = await route("/board all");
	assert.equal(full.split("\n").length, 53);
	assert.ok(full.length > 4096, `the full board is ${full.length} characters`);
	const digest = await route("/board");
	assert.equal(digest.split("\n").length, 40 + 10 + 1);
	assert.match(digest, /\n\+ 2 older merged, 1 dropped: the full board is \/board all$/);
	assert.equal(await route("/board ALL"), full);
});

test("/board at the limit: a full board of 4096 characters is sent whole, one of 4097 as the digest", async () => {
	const { route, demo } = await setup();
	// 11 lines of `DM0001 merged      -        <title>` (28 characters and the title) and 10 line breaks.
	tickets(demo, "DM", [["merged", 10, "x".repeat(350)], ["merged", 1, "y".repeat(278)]]);
	const fits = await route("/board");
	assert.deepEqual([fits.length, fits.split("\n").length], [4096, 11]);
	tickets(demo, "DM", [["merged", 10, "x".repeat(350)], ["merged", 1, "y".repeat(279)]]);
	const digest = await route("/board");
	assert.deepEqual(digest.split("\n").slice(-2), [`DM0002 merged      -        ${"x".repeat(350)}`, "+ 1 older merged: the full board is /board all"]);
	assert.equal((await route("/board all")).length, 4097);
});

test("/board PREFIX picks the project; an unknown prefix or kind and wrong usage are said", async () => {
	const { route, shop } = await setup();
	tickets(shop, "SH", [["review", 1]]);
	assert.equal(await route("/board SH"), "SH0001 review      -        Ticket SH0001");
	assert.equal(await route("/board sh all"), "SH0001 review      -        Ticket SH0001");
	assert.equal(await route("/board XY"), `/board failed: unknown prefix or kind XY; prefixes: DM, SH; kinds: ${KINDS}`);
	assert.equal(await route("/board XY fix"), "/board failed: unknown prefix XY; prefixes: DM, SH");
	for (const text of ["/board SH all x", "/board SH fix x", "/board 12", "/board S-H", "/board 12 fix", "/board --kind", "/board SH fix --kind fix", "/board --kind fix --kind feat"]) assert.equal(await route(text), USAGE, text);
});

test("/board KIND, /board PREFIX KIND and --kind KIND: only that Kind's tickets, of every status, whatever the length; a word outside the list answers with it", async () => {
	const { route, demo, shop } = await setup();
	tickets(demo, "DM", [["merged", 12, `A long title ${"x".repeat(300)}`, "fix"], ["dropped", 1, undefined, "fix"], ["planning", 1, undefined, "feat"], ["review", 1, undefined, "bug"], ["done", 1]]);
	tickets(shop, "SH", [["planned", 1, undefined, "fix"]]);
	const fixes = await route("/board fix");
	assert.ok(fixes.length > 4096, `the board of fixes is ${fixes.length} characters, sent whole`);
	assert.deepEqual(fixes.split("\n").map((line) => line.slice(0, 28)), [
		...Array.from({ length: 12 }, (_, index) => `DM${String(12 - index).padStart(4, "0")} merged      fix      `),
		"DM0013 dropped     fix      ",
	]);
	for (const text of ["/board FIX", "/board DM fix", "/board dm Fix", "/board --kind fix", "/board DM --kind fix", "/board --kind fix DM"]) assert.equal(await route(text), fixes, text);
	assert.equal(await route("/board feat"), "DM0014 planning    feat     Ticket DM0014");
	assert.equal(await route("/board SH fix"), "SH0001 planned     fix      Ticket SH0001", "another project's tickets of that Kind");
	assert.equal(await route("/board perf"), "no ticket of kind perf");
	assert.equal(await route("/board bug"), `/board failed: unknown prefix or kind bug; prefixes: DM, SH; kinds: ${KINDS}`, "a Kind written on a ticket but outside the list");
	for (const text of ["/board DM bug", "/board --kind bug", "/board DM 14", "/board --kind all"]) {
		assert.equal(await route(text), `/board failed: unknown kind ${/(\S+)$/.exec(text)?.[1]?.toLowerCase()}; kinds: ${KINDS}`, text);
	}
});

test("one word that is both a project's prefix and a kind is the prefix; PREFIX KIND and --kind still name the kind", async () => {
	const { route, demo, shop } = await setup(["DM", "CI"]);
	tickets(demo, "DM", [["planning", 1, undefined, "ci"], ["planning", 1, undefined, "fix"]]);
	tickets(shop, "CI", [["planning", 1, undefined, "fix"], ["planning", 1, undefined, "ci"]]);
	assert.equal(await route("/board ci"), "CI0001 planning    fix      Ticket CI0001\nCI0002 planning    ci       Ticket CI0002");
	assert.equal(await route("/board CI ci"), "CI0002 planning    ci       Ticket CI0002");
	assert.equal(await route("/board --kind ci"), "DM0001 planning    ci       Ticket DM0001");
	assert.equal(await route("/board ux"), "no ticket of kind ux");
	const all = await setup(["DM", "ALL"]);
	tickets(all.demo, "DM", [["planning", 1]]);
	tickets(all.shop, "ALL", [["planning", 1]]);
	assert.equal(await all.route("/board all"), "DM0001 planning    -        Ticket DM0001", "all stays all, whatever a project's prefix");
	assert.equal(await all.route("/board ALL all"), "ALL0001 planning    -        Ticket ALL0001");
});

test("/task: the id as 1, DM1, dm0001 or DM0001; another project's prefix answers from its board", async () => {
	const { route, demo, shop } = await setup();
	tickets(demo, "DM", [["planned", 1]]);
	tickets(shop, "SH", [["done", 1]]);
	for (const id of ["1", "DM1", "dm0001", "DM0001", " DM0001 "]) assert.equal(await route(`/task ${id}`), "DM0001 planned\n# DM0001 - the ticket\n", id);
	assert.equal(await route("/task SH1"), "SH0001 done\n# SH0001 - the ticket\n");
	assert.equal(await route("/task XY1"), "/task failed: unknown prefix XY; prefixes: DM, SH");
	assert.equal(await route("/task 2"), "/task failed: DM0002: not on the board of project demo");
	for (const text of ["/task", "/task 1 2", "/task DM-1", "/task 1DM"]) assert.equal(await route(text), "usage: /task <id>", text);
});

test("/task of a ticket whose ticket.md is gone says it cannot read it", async () => {
	const { route, demo } = await setup();
	mkdirSync(join(demo, "spec"));
	writeFileSync(join(demo, "spec", "build.json"), JSON.stringify([{ id: "DM0001", title: "Gone", status: "planned", path: "spec/features/DM0001-gone/ticket.md", updated: "2026-10-16T00:00:00Z" }]));
	assert.match(await route("/task 1"), /^\/task failed: DM0001: cannot read spec\/features\/DM0001-gone\/ticket\.md: ENOENT/);
});

test("in the shell: arthur board and task, their usage, an unknown --project, and --help", () => {
	const folder = temporaryFolder();
	const plugin = fileURLToPath(new URL("../src/orchestration.ts", import.meta.url));
	writeFileSync(
		join(folder, "arthur.config.ts"),
		`import { orchestration } from ${JSON.stringify(plugin)};\nexport default { plugins: [orchestration(), { name: "projects", setup(host) {\n\thost.provide("projects", () => [{ name: "demo", path: import.meta.dirname, prefix: "DM" }]);\n} }] };\n`,
	);
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	for (const title of ["One", "Two"]) arthur("ticket", "new", title);
	const both = "DM0001 planning    -        One\nDM0002 planning    -        Two\n";
	assert.deepEqual([arthur("board").stdout, arthur("board", "all").stdout], [both, both], "the template's Kind guidance shows as -");
	const second = join(folder, "spec/features/DM0002-two/ticket.md");
	writeFileSync(second, readFileSync(second, "utf8").replace(/^- Kind: <!--.*-->$/m, "- Kind: security"));
	for (const args of [["--kind", "security"], ["--kind", "SECURITY", "DM"], ["security"]]) assert.equal(arthur("board", ...args).stdout, "DM0002 planning    security Two\n", args.join(" "));
	const unknown = arthur("board", "--kind", "risk");
	assert.deepEqual([unknown.status, unknown.stderr], [1, `arthur board: unknown kind risk; kinds: ${KINDS}\n`]);
	const bare = arthur("board", "--kind");
	assert.deepEqual([bare.status, bare.stderr], [2, "usage: arthur board [PREFIX] [all | KIND | --kind KIND]\n"]);
	assert.match(arthur("task", "2").stdout, /^DM0002 planning\n# DM0002 - Two\n/);
	const wrong = arthur("task", "1", "2");
	assert.deepEqual([wrong.status, wrong.stderr], [2, "usage: arthur task <id>\n"]);
	const elsewhere = arthur("task", "1", "--project", "shop");
	assert.deepEqual([elsewhere.status, elsewhere.stderr], [1, "arthur task: unknown project shop; projects: demo\n"]);
	for (const name of ["board", "task"]) assert.match(arthur(name, "--help").stdout, new RegExp(`^# arthur ${name}\n`), name);
});
