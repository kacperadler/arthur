import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/plugin").replace(/plugin\.ts$/, "cli.ts"));

// Two projects, `demo` (DM, the main one) and `shop` (SH), with the plugin set up on the fake host, and each command's reply
// reached through `route`, as a channel reaches it. `home` holds the job records, which the plugin reads with `host.jobs.list()`.
async function setup() {
	const fake = fakeHost({ name: "orchestration" });
	const [demo, shop] = [temporaryFolder(), temporaryFolder()];
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	await fake.setup(orchestration());
	const home = dirname(fake.host.folder);
	return { route: fake.host.commands.route, commands: fake.host.commands, demo, shop, home };
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

test("the board's three commands are phone commands, each in a channel's menu", async () => {
	assert.deepEqual(
		(await setup()).commands.phone().map((command) => command.name),
		["board", "findings", "task"],
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

test("/findings: the file as it is; a ticket without the file, or with an empty one, has no findings", async () => {
	const { route, demo } = await setup();
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

test("/findings: the newest unmerged branch of a job of the ticket whose findings.md is not main's, headed; otherwise main's", async () => {
	const { route, demo, home } = await setup();
	const git = (date: string, ...args: string[]) =>
		execFileSync("git", ["-C", demo, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
	const findings = (id: string) => join(demo, "spec", "features", `${id}-ticket`, "findings.md");
	// A branch from main whose commit at `date` writes `files`, each a ticket's findings.md.
	const branch = (name: string, date: string, files: Readonly<Record<string, string>>) => {
		git(date, "switch", "--quiet", "--create", name, "main");
		for (const [id, text] of Object.entries(files)) writeFileSync(findings(id), text);
		git(date, "add", "--all");
		git(date, "commit", "--quiet", "--message", name);
		git(date, "switch", "--quiet", "main");
	};
	const record = (id: string, keys: Readonly<Record<string, string>>) => {
		mkdirSync(join(home, "jobs", id), { recursive: true });
		for (const [key, value] of Object.entries({ kind: "worker", project: "demo", ...keys })) writeFileSync(join(home, "jobs", id, key), value);
	};
	tickets(demo, "DM", [["in-progress", 2]]);
	writeFileSync(findings("DM0001"), "main\n");
	git("2026-10-01T00:00:00Z", "init", "--quiet", "--initial-branch", "main");
	git("2026-10-01T00:00:00Z", "add", "--all");
	git("2026-10-01T00:00:00Z", "commit", "--quiet", "--message", "first");
	const one = "spec/features/DM0001-ticket/ticket.md";
	assert.equal(await route("/findings 1"), "main\n", "no job");

	branch("arthur/old", "2026-10-02T00:00:00Z", { DM0001: "old\n" });
	branch("arthur/new", "2026-10-03T00:00:00Z", { DM0001: "new\n" });
	branch("arthur/same", "2026-10-04T00:00:00Z", { DM0002: "two\n" });
	branch("arthur/other", "2026-10-05T00:00:00Z", { DM0001: "other ticket's job\n", DM0002: "two\n" });
	branch("arthur/shop", "2026-10-06T00:00:00Z", { DM0001: "another project's job\n" });
	branch("arthur/writing", "2026-10-07T00:00:00Z", { DM0001: "a record being written\n" });
	branch("arthur/blank", "2026-10-08T00:00:00Z", { DM0001: " \n" });
	assert.equal(await route("/findings 1"), "main\n", "branches, but no job record names them");
	record("2026-10-02-worker-0000000a", { task: `Ticket: ${one}.`, branch: "arthur/old" });
	assert.equal(await route("/findings 1"), "findings from branch arthur/old (not merged)\nold\n");
	record("2026-10-01-worker-0000000b", { task: `Do it.\nTicket: \`${one}\`\n`, branch: "arthur/new" });
	record("2026-10-03-worker-0000000c", { task: `Ticket: ${one}`, branch: "arthur/same" });
	record("2026-10-03-worker-0000000d", { task: "Ticket: spec/features/DM0002-ticket/ticket.md", branch: "arthur/other" });
	record("2026-10-03-worker-0000000e", { task: `Ticket: ${one}`, branch: "arthur/shop", project: "shop" });
	record(".2026-10-03-worker-0000000f", { task: `Ticket: ${one}`, branch: "arthur/writing" });
	record("2026-10-03-review-00000010", { task: `Ticket: ${one}`, branch: "", kind: "review" });
	record("2026-10-03-worker-00000011", { task: `Ticket: ${one}`, branch: "arthur/blank" });
	record("2026-10-03-worker-00000012", { task: `Ticket: ${one}` });
	assert.equal(await route("/findings DM1"), "findings from branch arthur/new (not merged)\nnew\n", "the newest commit wins, not the record's name");
	assert.equal(await route("/findings 2"), "findings from branch arthur/other (not merged)\ntwo\n", "main has no findings.md for DM0002");
	git("2026-10-09T00:00:00Z", "branch", "--quiet", "-D", "arthur/other");
	assert.equal(await route("/findings 2"), "DM0002: no findings (spec/features/DM0002-ticket/findings.md does not exist)", "the branch is gone");

	branch("arthur/echo", "2026-10-02T12:00:00Z", { DM0001: "new, F1 ticketed\n" });
	git("2026-10-09T00:00:00Z", "branch", "--quiet", "-D", "arthur/old");
	git("2026-10-09T00:00:00Z", "merge", "--quiet", "--ff-only", "arthur/new");
	writeFileSync(findings("DM0001"), "new, F1 ticketed\n");
	git("2026-10-09T00:00:00Z", "commit", "--quiet", "--all", "--message", "F1 ticketed");
	assert.equal(await route("/findings 1"), "new, F1 ticketed\n", "neither the merged branch nor arthur/same, which left main before its change, is shown");
	record("2026-10-03-worker-00000013", { task: `Ticket: ${one}`, branch: "arthur/echo" });
	assert.equal(await route("/findings 1"), "new, F1 ticketed\n", "a branch whose findings.md is main's");
});

test("in the shell: arthur board, task and findings, their usage, an unknown --project, and --help", () => {
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
	assert.equal(arthur("findings", "DM1").stdout, "DM0001: no findings (spec/features/DM0001-one/findings.md does not exist)\n");
	const wrong = arthur("task", "1", "2");
	assert.deepEqual([wrong.status, wrong.stderr], [2, "usage: arthur task <id>\n"]);
	const elsewhere = arthur("task", "1", "--project", "shop");
	assert.deepEqual([elsewhere.status, elsewhere.stderr], [1, "arthur task: unknown project shop; projects: demo\n"]);
	for (const name of ["board", "task", "findings"]) assert.match(arthur(name, "--help").stdout, new RegExp(`^# arthur ${name}\n`), name);
});
