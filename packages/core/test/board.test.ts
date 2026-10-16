import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { type FakeHost, fakeHost, temporaryFolder } from "../src/testing.ts";

// 22:30 UTC is already the next day in Warsaw: the ticket's date is the core's time zone's.
const NOW = new Date("2026-10-16T22:30:00Z");

function setup(projects: readonly unknown[] = [{ name: "demo", path: temporaryFolder(), prefix: "DM" }]) {
	const fake = fakeHost({ name: "delivery", timeZone: "Europe/Warsaw", now: NOW });
	fake.provide("projects", () => projects);
	const root = (projects[0] as { path: string } | undefined)?.path ?? "";
	return { fake, board: fake.host.board, root, file: join(root, "spec", "build.json") };
}

const events = (fake: FakeHost) => fake.emitted.map(({ plugin, name, data }) => ({ plugin, name, data }));

test("an empty board: no file lists nothing, and the first ticket is DM0001 in planning, from the template", () => {
	const { fake, board, root, file } = setup();
	assert.deepEqual(board.list(), []);
	const ticket = board.create("Two writers, one board!");
	const path = "spec/features/DM0001-two-writers-one-board/ticket.md";
	const entry = { id: "DM0001", title: "Two writers, one board!", status: "planning", path, updated: NOW.toISOString() };
	assert.deepEqual(ticket, { ...entry, project: "demo" });
	assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), [entry]);
	assert.deepEqual(board.list(), [{ ...entry, project: "demo" }]);
	assert.deepEqual(board.get("DM0001"), { ...entry, project: "demo" });
	const text = readFileSync(join(root, path), "utf8");
	assert.match(text, /^# DM0001 - Two writers, one board!\n/);
	const json = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(text)?.[1] ?? "");
	assert.deepEqual(json, { id: "DM0001", title: "Two writers, one board!", date: "2026-10-17" });
	assert.deepEqual(events(fake), [
		{ plugin: "delivery", name: "ticket-created", data: { id: "DM0001", project: "demo", title: "Two writers, one board!", status: "planning", path } },
	]);
});

test("a board file holding [] is an empty board too", () => {
	const { board, file } = setup();
	mkdirSync(join(file, ".."), { recursive: true });
	writeFileSync(file, "[]\n");
	assert.deepEqual(board.list(), []);
	assert.equal(board.create("First").id, "DM0001");
});

test("ids continue after a dropped ticket and after a ticket folder the board does not hold", () => {
	const { board, root } = setup();
	for (const title of ["One", "Two", "Three"]) board.create(title);
	board.move("DM0003", "dropped");
	assert.equal(board.create("Four").id, "DM0004");
	mkdirSync(join(root, "spec", "features", "DM0009-made-by-hand"));
	mkdirSync(join(root, "spec", "features", "XY0050-another-prefix"));
	assert.equal(board.create("Five").id, "DM0010");
	assert.deepEqual(
		board.list().map((ticket) => `${ticket.id} ${ticket.status}`),
		["DM0001 planning", "DM0002 planning", "DM0003 dropped", "DM0004 planning", "DM0010 planning"],
	);
});

test("planned is refused while template guidance is left in ticket.md, and allowed once it is replaced", () => {
	const { fake, board, root, file } = setup();
	const { path } = board.create("Guided");
	const before = readFileSync(file, "utf8");
	const ticket = join(root, path);
	const filled = readFileSync(ticket, "utf8").replace(/<!--[\s\S]*?-->/g, "Written by the human.");
	writeFileSync(ticket, filled.replace("Written by the human.", "<!-- Two or three sentences: what changes, and for whom. -->"));
	assert.throws(() => board.move("DM0001", "planned"), {
		message: `DM0001: not planned: ${path} still holds the template's guidance, replace it first:\n<!-- Two or three sentences: what changes, and for whom. -->`,
	});
	assert.equal(readFileSync(file, "utf8"), before);
	writeFileSync(ticket, `${filled}\n<!-- the human's own note -->\n`);
	assert.equal(board.move("DM0001", "planned").status, "planned");
	assert.deepEqual(events(fake).at(-1), { plugin: "delivery", name: "ticket-moved", data: { id: "DM0001", project: "demo", from: "planning", to: "planned" } });
});

test("planned is refused for a ticket whose ticket.md is gone; other statuses are not checked", () => {
	const { board, root } = setup();
	const { path } = board.create("Gone");
	rmSync(join(root, path));
	assert.throws(() => board.move("DM0001", "planned"), {
		message: /^DM0001: cannot read spec\/features\/DM0001-gone\/ticket\.md to check it for template guidance: ENOENT/,
	});
	assert.equal(board.move("DM0001", "in-progress").status, "in-progress");
});

test("a move to the status a ticket has changes nothing: no write, no event", () => {
	const { fake, board, file } = setup();
	board.create("Same");
	const compact = JSON.stringify(JSON.parse(readFileSync(file, "utf8")));
	writeFileSync(file, compact);
	const emitted = fake.emitted.length;
	assert.equal(board.move("DM0001", "planning").status, "planning");
	assert.equal(readFileSync(file, "utf8"), compact);
	assert.equal(fake.emitted.length, emitted);
});

test("refused: an unknown status, an id not on the board, an id whose prefix no project has", () => {
	const { board } = setup();
	board.create("Known");
	assert.throws(() => board.move("DM0001", "doing"), {
		message: 'DM0001: unknown status "doing"; statuses: planning, planned, in-progress, review, done, merged, dropped',
	});
	assert.throws(() => board.move("DM0002", "done"), { message: "DM0002: not on the board of project demo" });
	assert.throws(() => board.move("XY0001", "done"), { message: "XY0001: no project has its prefix; prefixes: DM" });
	assert.equal(board.get("DM0002"), undefined);
	assert.equal(board.get("XY0001"), undefined);
	assert.equal(board.get("dm0001"), undefined);
});

test("keys the board does not read are kept when a ticket moves", () => {
	const { board, file } = setup();
	board.create("Waits");
	writeFileSync(file, JSON.stringify([{ ...JSON.parse(readFileSync(file, "utf8"))[0], after: ["DM0000"] }]));
	board.move("DM0001", "review");
	assert.deepEqual(JSON.parse(readFileSync(file, "utf8"))[0].after, ["DM0000"]);
});

test("a title that is empty, padded, on two lines or without a letter or digit is refused; a long one is cut at a dash", () => {
	const { board, root } = setup();
	for (const title of ["", " padded", "two\nlines", "!!! ???"]) assert.throws(() => board.create(title), /^Error: a title/, JSON.stringify(title));
	assert.equal(existsSync(join(root, "spec", "build.json")), false);
	const long = `${"word ".repeat(20)}end`;
	const { path } = board.create(long);
	assert.equal(path, `spec/features/DM0001-${"word-".repeat(15)}word/ticket.md`);
});

test("the main project is the first; --project picks another by name; each project has its own board", () => {
	const [first, second] = [temporaryFolder(), temporaryFolder()];
	const { board } = setup([
		{ name: "arthur", path: first, prefix: "AR" },
		{ name: "shop", path: second, prefix: "SH" },
	]);
	assert.equal(board.create("Core").id, "AR0001");
	assert.equal(board.create("Cart", "shop").id, "SH0001");
	assert.deepEqual(board.get("SH0001")?.project, "shop");
	assert.deepEqual(board.move("SH0001", "done").project, "shop");
	assert.deepEqual(board.list("shop").map((ticket) => ticket.id), ["SH0001"]);
	assert.throws(() => board.list("blog"), { message: "unknown project blog; projects: arthur, shop" });
});

test("the project list is checked: none, twice, empty, a bad entry, a name or prefix twice", () => {
	const path = temporaryFolder();
	const cases: readonly [readonly unknown[] | undefined, string][] = [
		[undefined, "no project list: the board needs each project's folder and ticket prefix, which the projects plugin provides"],
		[[], "the project list is empty or not a list"],
		[[{ name: "", path, prefix: "AR" }], "project list [0].name: expected a non-empty string"],
		[[{ name: "a", prefix: "AR" }], "project list [0].path: expected the project's folder as an absolute path, got undefined"],
		[[{ name: "a", path: ".", prefix: "AR" }], 'project list [0].path: expected the project\'s folder as an absolute path, got "."'],
		[[{ name: "a", path, prefix: "ar" }], 'project list [0].prefix: expected capital letters A-Z, got "ar"'],
		[[null], "project list [0].name: expected a non-empty string"],
		[[{ name: "a", path, prefix: "AR" }, { name: "a", path, prefix: "SH" }], "project list [1]: a second project with the name a"],
		[[{ name: "a", path, prefix: "AR" }, { name: "b", path, prefix: "AR" }], "project list [1]: a second project with the prefix AR"],
	];
	for (const [list, message] of cases) {
		const fake = fakeHost({ name: "delivery" });
		if (list !== undefined) fake.provide("projects", () => list);
		assert.throws(() => fake.host.board.list(), { message }, JSON.stringify(list));
	}
	const twice = fakeHost({ name: "delivery" });
	twice.provide("projects", () => [{ name: "a", path, prefix: "AR" }]);
	twice.provide("projects", () => [{ name: "a", path, prefix: "AR" }]);
	assert.throws(() => twice.host.board.create("Twice"), { message: "the project list is provided 2 times; one plugin provides it" });
});

test("a board file broken by hand is refused, naming the file, and never written over", () => {
	const valid = { id: "DM0001", title: "One", status: "planning", path: "spec/features/DM0001-one/ticket.md", updated: NOW.toISOString() };
	const cases: readonly [string, string][] = [
		["{ not json", "not JSON ("],
		['{"id":"DM0001"}', "expected an array of tickets"],
		["[1]", "[0]: expected a ticket object"],
		[JSON.stringify([{ ...valid, id: "DM1" }]), '[0].id: expected a prefix in capitals and a number of 4 digits or more, got "DM1"'],
		[JSON.stringify([{ ...valid, title: "" }]), "[0].title: expected a non-empty string"],
		[JSON.stringify([{ ...valid, status: "doing" }]), '[0].status: expected one of planning, planned, in-progress, review, done, merged, dropped, got "doing"'],
		[JSON.stringify([{ ...valid, path: undefined }]), "[0].path: expected the path of its ticket.md"],
		[JSON.stringify([{ ...valid, updated: "yesterday" }]), "[0].updated: expected an ISO 8601 time"],
		[JSON.stringify([valid, valid]), "[1].id: DM0001 is on the board twice"],
	];
	for (const [text, problem] of cases) {
		const { board, root, file } = setup();
		mkdirSync(join(root, "spec"));
		writeFileSync(file, text);
		for (const run of [() => board.list(), () => board.create("New"), () => board.move("DM0001", "done"), () => board.get("DM0001")]) {
			assert.throws(run, (error: Error) => error.message.startsWith(`${file}: ${problem}`) && error.message.endsWith("fix the file by hand, or restore it from Git"), text);
		}
		assert.equal(readFileSync(file, "utf8"), text);
		assert.deepEqual(readdirSync(join(root, "spec")), ["build.json"], "no ticket folder, no temporary file, no lock left");
	}
});

test("a board lock left by a dead pid is taken over", () => {
	const { board, file } = setup();
	mkdirSync(join(file, ".."), { recursive: true });
	writeFileSync(`${file}.lock`, String(spawnSync(process.execPath, ["-e", ""]).pid));
	assert.equal(board.create("After a crash").id, "DM0001");
	assert.deepEqual(readdirSync(join(file, "..")).sort(), ["build.json", "features"]);
});

test("two writers at once never lose a change: every ticket of both is on the board, each with its own id", async () => {
	const root = temporaryFolder();
	const each = 30;
	const script = (writer: string) => `
		import { board } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, "..", "src", "board.ts")).href)};
		import { clock } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, "..", "src", "clock.ts")).href)};
		const tickets = board(() => [[{ name: "demo", path: ${JSON.stringify(root)}, prefix: "DM" }]], clock("UTC", undefined), () => {});
		for (let index = 0; index < ${each}; index++) tickets.create("${writer} " + index);
	`;
	const run = (writer: string) =>
		new Promise<number | null>((resolve) => spawn(process.execPath, ["--input-type=module", "-e", script(writer)], { stdio: "inherit" }).on("exit", resolve));
	assert.deepEqual(await Promise.all([run("first"), run("second")]), [0, 0]);
	const entries: { id: string; title: string }[] = JSON.parse(readFileSync(join(root, "spec", "build.json"), "utf8"));
	assert.deepEqual(
		entries.map((entry) => entry.id),
		Array.from({ length: 2 * each }, (_, index) => `DM${String(index + 1).padStart(4, "0")}`),
	);
	assert.equal(new Set(entries.map((entry) => entry.title)).size, 2 * each);
	assert.equal(readdirSync(join(root, "spec", "features")).length, 2 * each);
});
