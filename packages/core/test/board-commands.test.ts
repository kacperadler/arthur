import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { boardCommands } from "../src/board-commands.ts";
import { commandRegistry } from "../src/commands.ts";
import { fakeHost, temporaryFolder } from "../src/testing.ts";

// Two projects, `demo` (DM, the main one) and `shop` (SH), with the board's phone commands in a registry as the core registers
// them, and each command's reply reached through `route`, as a channel reaches it.
function setup() {
	const fake = fakeHost({ name: "telegram" });
	const [demo, shop] = [temporaryFolder(), temporaryFolder()];
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	const commands = commandRegistry();
	for (const command of boardCommands(() => fake.host.board)) commands.register("core", command);
	return { route: commands.route, commands, demo, shop };
}

// A board written by hand: for each spec, `count` tickets of `status`, numbered on from 1, each with a `ticket.md`.
function tickets(root: string, prefix: string, specs: readonly (readonly [status: string, count: number, title?: string])[]): void {
	const entries = specs.flatMap(([status, count, title]) => Array.from({ length: count }, () => ({ status, title })));
	const board = entries.map(({ status, title }, index) => {
		const id = `${prefix}${String(index + 1).padStart(4, "0")}`;
		const path = `spec/features/${id}-ticket/ticket.md`;
		mkdirSync(join(root, path, ".."), { recursive: true });
		writeFileSync(join(root, path), `# ${id} - the ticket\n`);
		return { id, title: title ?? `Ticket ${id}`, status, path, updated: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString() };
	});
	writeFileSync(join(root, "spec", "build.json"), JSON.stringify(board));
}

test("the board's three commands are phone commands, each in a channel's menu", () => {
	assert.deepEqual(
		setup().commands.phone().map((command) => command.name),
		["board", "findings", "task"],
	);
});

test("/board: the full board when it fits one message, else the digest; all: the full board whatever its length", async () => {
	const { route, demo } = setup();
	assert.equal(await route("/board"), "the board is empty");
	tickets(demo, "DM", [["merged", 12], ["dropped", 1], ["planning", 1]]);
	const small = await route("/board");
	assert.equal(small.split("\n").length, 14, "every ticket, the 2 older merged and the dropped one included");
	assert.match(small, /^DM0014 planning    Ticket DM0014\nDM0012 merged      Ticket DM0012\n/);
	assert.match(small, /\nDM0001 merged      Ticket DM0001\nDM0013 dropped     Ticket DM0013$/);
	tickets(demo, "DM", [["merged", 12], ["dropped", 1], ["planning", 40, `A long title ${"x".repeat(80)}`]]);
	const full = await route("/board all");
	assert.equal(full.split("\n").length, 53);
	assert.ok(full.length > 4096, `the full board is ${full.length} characters`);
	const digest = await route("/board");
	assert.equal(digest.split("\n").length, 40 + 10 + 1);
	assert.match(digest, /\n\+ 2 older merged, 1 dropped: the full board is \/board all, or arthur ticket all$/);
	assert.equal(await route("/board ALL"), full);
});

test("/board at the limit: a full board of 4096 characters is sent whole, one of 4097 as the digest", async () => {
	const { route, demo } = setup();
	// 11 lines of `DM0001 merged      <title>` (19 characters and the title) and 10 line breaks.
	tickets(demo, "DM", [["merged", 10, "x".repeat(350)], ["merged", 1, "y".repeat(377)]]);
	const fits = await route("/board");
	assert.deepEqual([fits.length, fits.split("\n").length], [4096, 11]);
	tickets(demo, "DM", [["merged", 10, "x".repeat(350)], ["merged", 1, "y".repeat(378)]]);
	const digest = await route("/board");
	assert.deepEqual(digest.split("\n").slice(-2), [`DM0002 merged      ${"x".repeat(350)}`, "+ 1 older merged: the full board is /board all, or arthur ticket all"]);
	assert.equal((await route("/board all")).length, 4097);
});

test("/board PREFIX picks the project; an unknown prefix and wrong usage are said", async () => {
	const { route, shop } = setup();
	tickets(shop, "SH", [["review", 1]]);
	assert.equal(await route("/board SH"), "SH0001 review      Ticket SH0001");
	assert.equal(await route("/board sh all"), "SH0001 review      Ticket SH0001");
	assert.equal(await route("/board XY"), "/board failed: unknown prefix XY; prefixes: DM, SH");
	for (const text of ["/board SH all x", "/board SH DM", "/board 12", "/board S-H"]) assert.equal(await route(text), "usage: /board [PREFIX] [all]", text);
});

test("/task: the id as 1, DM1, dm0001 or DM0001; another project's prefix answers from its board", async () => {
	const { route, demo, shop } = setup();
	tickets(demo, "DM", [["planned", 1]]);
	tickets(shop, "SH", [["done", 1]]);
	for (const id of ["1", "DM1", "dm0001", "DM0001", " DM0001 "]) assert.equal(await route(`/task ${id}`), "DM0001 planned\n# DM0001 - the ticket\n", id);
	assert.equal(await route("/task SH1"), "SH0001 done\n# SH0001 - the ticket\n");
	assert.equal(await route("/task XY1"), "/task failed: unknown prefix XY; prefixes: DM, SH");
	assert.equal(await route("/task 2"), "/task failed: DM0002: not on the board of project demo");
	for (const text of ["/task", "/task 1 2", "/task DM-1", "/task 1DM"]) assert.equal(await route(text), "usage: /task <id>", text);
});

test("/task of a ticket whose ticket.md is gone says it cannot read it", async () => {
	const { route, demo } = setup();
	mkdirSync(join(demo, "spec"));
	writeFileSync(join(demo, "spec", "build.json"), JSON.stringify([{ id: "DM0001", title: "Gone", status: "planned", path: "spec/features/DM0001-gone/ticket.md", updated: "2026-10-16T00:00:00Z" }]));
	assert.match(await route("/task 1"), /^\/task failed: DM0001: cannot read spec\/features\/DM0001-gone\/ticket\.md: ENOENT/);
});

test("/findings: the file as it is; a ticket without the file, or with an empty one, has no findings", async () => {
	const { route, demo } = setup();
	tickets(demo, "DM", [["in-progress", 3]]);
	const folder = (id: string) => join(demo, "spec", "features", `${id}-ticket`);
	writeFileSync(join(folder("DM0002"), "findings.md"), " \n");
	writeFileSync(join(folder("DM0003"), "findings.md"), "# Findings\n\n## F1\n\nStatus: open\n");
	assert.equal(await route("/findings 1"), "DM0001: no findings (spec/features/DM0001-ticket/findings.md does not exist)");
	assert.equal(await route("/findings DM2"), "DM0002: no findings (spec/features/DM0002-ticket/findings.md is empty)");
	assert.equal(await route("/findings dm3"), "# Findings\n\n## F1\n\nStatus: open\n");
	assert.equal(await route("/findings SH1"), "/findings failed: SH0001: not on the board of project shop");
	assert.equal(await route("/findings"), "usage: /findings <id>");
});
