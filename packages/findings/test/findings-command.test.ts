import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { findings } from "../src/findings.ts";

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/plugin").replace(/plugin\.ts$/, "cli.ts"));

// Two projects, `demo` (DM, the main one) and `shop` (SH), with the plugin set up on the fake host, and `/findings` reached
// through `route`, as a channel reaches it. `home` holds the job records, which the plugin reads with `host.jobs.list()`.
async function setup() {
	const fake = fakeHost({ name: "findings" });
	const [demo, shop] = [temporaryFolder(), temporaryFolder()];
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	await fake.setup(findings());
	return { route: fake.host.commands.route, commands: fake.host.commands, demo, home: dirname(fake.host.folder) };
}

// A board written by hand: `count` tickets of `status`, numbered from 1, each with a `ticket.md`.
function tickets(root: string, prefix: string, status: string, count: number): void {
	const board = Array.from({ length: count }, (_, index) => {
		const id = `${prefix}${String(index + 1).padStart(4, "0")}`;
		const path = `spec/features/${id}-ticket/ticket.md`;
		mkdirSync(join(root, path, ".."), { recursive: true });
		writeFileSync(join(root, path), `# ${id} - the ticket\n`);
		return { id, title: `Ticket ${id}`, status, path, updated: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString() };
	});
	writeFileSync(join(root, "spec", "build.json"), JSON.stringify(board));
}

test("/findings is a phone command, in a channel's menu", async () => {
	assert.deepEqual((await setup()).commands.phone(), [{ name: "findings", about: "a ticket's findings.md: /findings 14, /findings AR14" }]);
});

test("/findings: the file as it is; a ticket without the file, or with an empty one, has no findings; refusals and usage", async () => {
	const { route, demo } = await setup();
	tickets(demo, "DM", "in-progress", 3);
	const folder = (id: string) => join(demo, "spec", "features", `${id}-ticket`);
	writeFileSync(join(folder("DM0002"), "findings.md"), " \n");
	writeFileSync(join(folder("DM0003"), "findings.md"), "# Findings\n\n## F1\n\nStatus: open\n");
	assert.equal(await route("/findings 1"), "DM0001: no findings (spec/features/DM0001-ticket/findings.md does not exist)");
	assert.equal(await route("/findings DM2"), "DM0002: no findings (spec/features/DM0002-ticket/findings.md is empty)");
	assert.equal(await route("/findings dm3"), "# Findings\n\n## F1\n\nStatus: open\n");
	assert.equal(await route("/findings SH1"), "/findings failed: SH0001: not on the board of project shop");
	assert.equal(await route("/findings XY1"), "/findings failed: unknown prefix XY; prefixes: DM, SH");
	mkdirSync(join(folder("DM0001"), "findings.md"));
	assert.match(await route("/findings 1"), /^\/findings failed: DM0001: cannot read spec\/features\/DM0001-ticket\/findings\.md: EISDIR/);
	for (const text of ["/findings", "/findings 1 2", "/findings DM-1", "/findings 1DM"]) assert.equal(await route(text), "usage: /findings <id>", text);
});

test("/findings: the newest unmerged branch of a job of the ticket whose findings.md is not main's, headed; otherwise main's", async () => {
	const { route, demo, home } = await setup();
	const git = (date: string, ...args: string[]) =>
		execFileSync("git", ["-C", demo, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
	const file = (id: string) => join(demo, "spec", "features", `${id}-ticket`, "findings.md");
	// A branch from main whose commit at `date` writes `files`, each a ticket's findings.md.
	const branch = (name: string, date: string, files: Readonly<Record<string, string>>) => {
		git(date, "switch", "--quiet", "--create", name, "main");
		for (const [id, text] of Object.entries(files)) writeFileSync(file(id), text);
		git(date, "add", "--all");
		git(date, "commit", "--quiet", "--message", name);
		git(date, "switch", "--quiet", "main");
	};
	const record = (id: string, keys: Readonly<Record<string, string>>) => {
		mkdirSync(join(home, "jobs", id), { recursive: true });
		for (const [key, value] of Object.entries({ kind: "worker", project: "demo", ...keys })) writeFileSync(join(home, "jobs", id, key), value);
	};
	tickets(demo, "DM", "in-progress", 2);
	writeFileSync(file("DM0001"), "main\n");
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
	writeFileSync(file("DM0001"), "new, F1 ticketed\n");
	git("2026-10-09T00:00:00Z", "commit", "--quiet", "--all", "--message", "F1 ticketed");
	assert.equal(await route("/findings 1"), "new, F1 ticketed\n", "neither the merged branch nor arthur/same, which left main before its change, is shown");
	record("2026-10-03-worker-00000013", { task: `Ticket: ${one}`, branch: "arthur/echo" });
	assert.equal(await route("/findings 1"), "new, F1 ticketed\n", "a branch whose findings.md is main's");
});

test("in the shell: arthur findings, its usage, an unknown --project, and --help; without the plugin there is no such command", () => {
	const folder = temporaryFolder();
	const plugin = fileURLToPath(new URL("../src/findings.ts", import.meta.url));
	const config = (plugins: string) =>
		writeFileSync(
			join(folder, "arthur.config.ts"),
			`import { findings } from ${JSON.stringify(plugin)};\nexport default { plugins: [${plugins}{ name: "projects", setup(host) {\n\thost.provide("projects", () => [{ name: "demo", path: import.meta.dirname, prefix: "DM" }]);\n} }, { name: "orchestration", setup() {} }] };\n`,
		);
	config("findings(), ");
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
	arthur("ticket", "new", "One");
	assert.equal(arthur("findings", "DM1").stdout, "DM0001: no findings (spec/features/DM0001-one/findings.md does not exist)\n");
	const wrong = arthur("findings", "1", "2");
	assert.deepEqual([wrong.status, wrong.stderr], [2, "usage: arthur findings <id>\n"]);
	const elsewhere = arthur("findings", "1", "--project", "shop");
	assert.deepEqual([elsewhere.status, elsewhere.stderr], [1, "arthur findings: unknown project shop; projects: demo\n"]);
	assert.match(arthur("findings", "--help").stdout, /^# arthur findings\n/);
	config("");
	const gone = arthur("findings", "DM1");
	assert.equal(gone.status, 2, gone.stderr);
	assert.match(gone.stderr, /^arthur: unknown command findings/);
});
