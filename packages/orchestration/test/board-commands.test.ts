import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/plugin").replace(/plugin\.ts$/, "cli.ts"));

// Two projects, `demo` (DM, the main one) and `shop` (SH), with the plugin set up on the fake host, and each command's reply
// reached through `route`, as a channel reaches it.
async function setup() {
	const fake = fakeHost({ name: "orchestration" });
	const [demo, shop] = [temporaryFolder(), temporaryFolder()];
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	await fake.setup(orchestration());
	return { route: fake.host.commands.route, commands: fake.host.commands, demo, shop };
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
	assert.match(small, /^DM0014 planning    Ticket DM0014\nDM0012 merged      Ticket DM0012\n/);
	assert.match(small, /\nDM0001 merged      Ticket DM0001\nDM0013 dropped     Ticket DM0013$/);
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
	// 11 lines of `DM0001 merged      <title>` (19 characters and the title) and 10 line breaks.
	tickets(demo, "DM", [["merged", 10, "x".repeat(350)], ["merged", 1, "y".repeat(377)]]);
	const fits = await route("/board");
	assert.deepEqual([fits.length, fits.split("\n").length], [4096, 11]);
	tickets(demo, "DM", [["merged", 10, "x".repeat(350)], ["merged", 1, "y".repeat(378)]]);
	const digest = await route("/board");
	assert.deepEqual(digest.split("\n").slice(-2), [`DM0002 merged      ${"x".repeat(350)}`, "+ 1 older merged: the full board is /board all"]);
	assert.equal((await route("/board all")).length, 4097);
});

test("/board PREFIX picks the project; an unknown prefix and wrong usage are said", async () => {
	const { route, shop } = await setup();
	tickets(shop, "SH", [["review", 1]]);
	assert.equal(await route("/board SH"), "SH0001 review      Ticket SH0001");
	assert.equal(await route("/board sh all"), "SH0001 review      Ticket SH0001");
	assert.equal(await route("/board XY"), "/board failed: unknown prefix XY; prefixes: DM, SH");
	for (const text of ["/board SH all x", "/board SH DM", "/board 12", "/board S-H"]) assert.equal(await route(text), "usage: /board [PREFIX] [all]", text);
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
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
	for (const title of ["One", "Two"]) arthur("ticket", "new", title);
	assert.deepEqual([arthur("board").stdout, arthur("board", "all").stdout], ["DM0001 planning    One\nDM0002 planning    Two\n", "DM0001 planning    One\nDM0002 planning    Two\n"]);
	assert.match(arthur("task", "2").stdout, /^DM0002 planning\n# DM0002 - Two\n/);
	const wrong = arthur("task", "1", "2");
	assert.deepEqual([wrong.status, wrong.stderr], [2, "usage: arthur task <id>\n"]);
	const elsewhere = arthur("task", "1", "--project", "shop");
	assert.deepEqual([elsewhere.status, elsewhere.stderr], [1, "arthur task: unknown project shop; projects: demo\n"]);
	for (const name of ["board", "task"]) assert.match(arthur(name, "--help").stdout, new RegExp(`^# arthur ${name}\n`), name);
});
