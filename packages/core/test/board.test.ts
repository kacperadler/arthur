import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { board as ticketBoard } from "../src/board.ts";
import { type FakeHost, fakeHost, temporaryFolder } from "../src/testing.ts";

// 22:30 UTC is already the next day in Warsaw: the ticket's date is the core's time zone's.
const NOW = new Date("2026-10-16T22:30:00Z");

// The core's board, as `arthur ticket` has it, its events named by the plugin `delivery`; `host.board` is the same without `after`.
function setup(projects: readonly unknown[] = [{ name: "demo", path: temporaryFolder(), prefix: "DM" }]) {
	const fake = fakeHost({ name: "delivery", timeZone: "Europe/Warsaw", now: NOW });
	fake.provide("projects", () => projects);
	const root = (projects[0] as { path: string } | undefined)?.path ?? "";
	const board = ticketBoard(() => fake.collect("projects"), fake.host.clock, (name, data) => fake.host.events.emit(name, data));
	return { fake, board, root, file: join(root, "spec", "build.json") };
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
	const filled = readFileSync(ticket, "utf8").replace(/<!--[\s\S]*?-->/g, "Written by the human.").replace("- Kind: Written by the human.", "- Kind: fix");
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
	assert.equal(board.move("DM0001", "dropped").status, "dropped");
});

const KINDS = ["feat", "fix", "security", "perf", "refactor", "test", "docs", "build", "ci", "chore", "ux"];

test("the template's Kind line lists the kinds; planned refuses a Kind under the Goal that is none of them, not a ticket without one", () => {
	const { board, root } = setup();
	const template = readFileSync(new URL("../templates/ticket.md", import.meta.url), "utf8");
	assert.ok(template.includes(`\n- Kind: <!-- ${KINDS.join(" | ")} -->\n`), "the template's Kind line lists exactly the kinds");
	assert.deepEqual(board.kinds, KINDS);
	const write = (line: string) => {
		const { id, path } = board.create("A ticket");
		writeFileSync(join(root, path), `# A ticket\n\n## Description\n\n- Kind: bug\n\n## Goal\n\nWhy.\n\n${line}\n## Done means\n\n- Kind: bug\n`);
		return { id, path };
	};
	for (const kind of ["bug", "risk", "cleanup", "improvement", "feature", "Fix", "fix, security", "fix fix", ""]) {
		const { id, path } = write(`- Kind: ${kind}\n`);
		assert.throws(() => board.move(id, "planned"), { message: `${id}: not planned: ${path} names Kind ${JSON.stringify(kind)}, none of the template's: ${KINDS.join(", ")}` }, kind);
		assert.equal(board.get(id)?.status, "planning");
	}
	for (const kind of KINDS) assert.equal(board.move(write(`- Kind:  ${kind} \n`).id, "planned").status, "planned", kind);
	assert.equal(board.move(write("").id, "planned").status, "planned", "no Kind line under the Goal, the ones elsewhere not read");
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
	writeFileSync(file, JSON.stringify([{ ...JSON.parse(readFileSync(file, "utf8"))[0], requires: { os: "macos" } }]));
	board.move("DM0001", "dropped");
	assert.deepEqual(JSON.parse(readFileSync(file, "utf8"))[0].requires, { os: "macos" });
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
	assert.deepEqual(board.move("SH0001", "dropped").project, "shop");
	assert.deepEqual(board.list("shop").map((ticket) => ticket.id), ["SH0001"]);
	assert.throws(() => board.list("blog"), { message: "unknown project blog; projects: arthur, shop" });
});

// A board written by hand, each ticket with a `ticket.md` free of the template's guidance; `kind` is the line under its Goal,
// none without it, and `gone` leaves its ticket.md out. Neither goes on the board.
function handWritten(root: string, entries: readonly Record<string, unknown>[]): void {
	for (const { path, kind, gone } of entries) {
		mkdirSync(join(root, String(path), ".."), { recursive: true });
		if (gone !== true) writeFileSync(join(root, String(path)), kind === undefined ? "# filled in\n" : `# filled in\n\n## Goal\n\n- Kind: ${kind}\n`);
	}
	writeFileSync(join(root, "spec", "build.json"), JSON.stringify(entries.map(({ kind, gone, ...rest }) => rest)));
}

const entry = (id: string, status: string, more: Record<string, unknown> = {}) => ({
	id,
	title: `Ticket ${id}`,
	status,
	path: `spec/features/${id}-ticket/ticket.md`,
	updated: NOW.toISOString(),
	...more,
});

const ALLOWED: Readonly<Record<string, readonly string[]>> = {
	planning: ["planned", "dropped"],
	planned: ["planning", "in-progress", "dropped"],
	"in-progress": ["planning", "review", "done", "merged", "dropped"],
	review: ["in-progress", "done", "merged", "dropped"],
	done: ["in-progress", "review", "merged", "dropped"],
	merged: [],
	dropped: [],
};

test("a move is allowed only as the table says; a merged or dropped ticket never moves again", () => {
	for (const [from, allowed] of Object.entries(ALLOWED)) {
		for (const to of Object.keys(ALLOWED).filter((status) => status !== from)) {
			const { fake, board, root, file } = setup();
			handWritten(root, [entry("DM0001", from)]);
			const before = readFileSync(file, "utf8");
			if (allowed.includes(to)) {
				assert.equal(board.move("DM0001", to).status, to, `${from} -> ${to}`);
				continue;
			}
			assert.throws(() => board.move("DM0001", to), { message: `DM0001: ${from} cannot move to ${to}; from ${from}: ${allowed.join(", ") || "none, it is final"}` });
			assert.deepEqual([readFileSync(file, "utf8"), fake.emitted.length], [before, 0], `${from} -> ${to} left the board as it was`);
		}
	}
});

test("after: a ticket waits for others on its board; replaced, cleared, and emitted only when it changes", () => {
	const { fake, board, root, file } = setup();
	handWritten(root, [entry("DM0001", "planning"), entry("DM0002", "planned"), entry("DM0003", "merged")]);
	assert.deepEqual(board.after("DM0001", ["DM0002", "DM0003", "DM0002"]).after, ["DM0002", "DM0003"]);
	assert.deepEqual(JSON.parse(readFileSync(file, "utf8"))[0].after, ["DM0002", "DM0003"]);
	const written = readFileSync(file, "utf8");
	assert.deepEqual(board.after("DM0001", ["DM0002", "DM0003"]).after, ["DM0002", "DM0003"]);
	assert.equal(readFileSync(file, "utf8"), written, "the same list writes nothing");
	assert.deepEqual(board.after("DM0001", ["DM0003"]).after, ["DM0003"]);
	assert.equal(board.after("DM0001", []).after, undefined);
	assert.equal("after" in JSON.parse(readFileSync(file, "utf8"))[0], false);
	assert.deepEqual(events(fake), [
		{ plugin: "delivery", name: "ticket-after", data: { id: "DM0001", project: "demo", after: ["DM0002", "DM0003"] } },
		{ plugin: "delivery", name: "ticket-after", data: { id: "DM0001", project: "demo", after: ["DM0003"] } },
		{ plugin: "delivery", name: "ticket-after", data: { id: "DM0001", project: "demo", after: [] } },
	]);
});

test("after refuses an unknown id, another project's, a dropped one, itself and a cycle; the board is left as it is", () => {
	const shop = temporaryFolder();
	const { fake, board, root, file } = setup([
		{ name: "demo", path: temporaryFolder(), prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	handWritten(root, [entry("DM0001", "planning", { after: ["DM0002"] }), entry("DM0002", "planned", { after: ["DM0003"] }), entry("DM0003", "planning"), entry("DM0004", "dropped")]);
	handWritten(shop, [entry("SH0001", "planning")]);
	const before = readFileSync(file, "utf8");
	for (const [id, after, message] of [
		["DM0001", ["DM0002", "DM0009"], "DM0001 cannot wait for DM0009: not on its board"],
		["DM0001", ["SH0001"], "DM0001 cannot wait for SH0001: not on its board"],
		["DM0001", ["DM0004"], "DM0001 cannot wait for DM0004: dropped"],
		["DM0001", ["DM0001"], "DM0001 cannot wait for itself: DM0001 after DM0001"],
		["DM0003", ["DM0001"], "DM0003 cannot wait for itself: DM0003 after DM0001 after DM0002 after DM0003"],
		["DM0009", [], "DM0009: not on the board of project demo"],
	] as const) {
		assert.throws(() => board.after(id, after), { message });
	}
	assert.deepEqual([readFileSync(file, "utf8"), fake.emitted.length], [before, 0]);
});

test("the digest: every open ticket by status with its Kind and what it still waits for, the 10 newest merged, one line for the rest", () => {
	const { board, root } = setup();
	assert.equal(board.digest(), "the board is empty");
	const copy = temporaryFolder();
	handWritten(copy, [entry("DM0001", "planning", { kind: "ux" })]);
	assert.equal(board.digest(undefined, copy), "DM0001 planning    ux       Ticket DM0001", "a copy of the repository is read where it is, its tickets' Kinds too");
	assert.equal(board.digest(), "the board is empty", "the project's own board is not the copy's");
	board.create("Fresh");
	assert.equal(board.digest(), "DM0001 planning    -        Fresh", "the template's Kind guidance is no Kind");
	handWritten(root, boardOfKinds());
	const newest = Array.from({ length: 9 }, (_, index) => `DM${String(11 - index).padStart(4, "0")} merged      -        Ticket DM${String(11 - index).padStart(4, "0")}`);
	assert.equal(
		board.digest(),
		[
			"DM0014 planning    fix      Ticket DM0014  after DM0015",
			"DM0018 planned     -        Ticket DM0018",
			"DM0015 in-progress bug      Ticket DM0015",
			"DM0019 review      security Ticket DM0019",
			"DM0013 done        fix      Ticket DM0013",
			"DM0012 merged      security Ticket DM0012",
			...newest,
			"+ 2 older merged, 2 dropped: the full board is /board all",
		].join("\n"),
		"two words on the Kind line, or a ticket.md gone, show as -; a Kind outside the list as written",
	);
});

// Twelve merged tickets, the oldest DM0001, and one of each open status and two dropped, with their Kinds.
function boardOfKinds() {
	const merged = Array.from({ length: 12 }, (_, index) =>
		entry(`DM${String(index + 1).padStart(4, "0")}`, "merged", { updated: new Date(NOW.getTime() + index * 60_000).toISOString() }),
	);
	Object.assign(merged[0] ?? {}, { kind: "fix" });
	Object.assign(merged[10] ?? {}, { kind: "feat fix" });
	Object.assign(merged[11] ?? {}, { kind: "security" });
	return [
		...merged,
		entry("DM0013", "done", { kind: "fix" }),
		entry("DM0014", "planning", { after: ["DM0001", "DM0002", "DM0015"], kind: "fix" }),
		entry("DM0015", "in-progress", { kind: "bug" }),
		entry("DM0016", "dropped", { kind: "fix" }),
		entry("DM0017", "dropped", { after: ["DM0015"] }),
		entry("DM0018", "planned", { gone: true }),
		entry("DM0019", "review", { kind: "security" }),
	];
}

test("the full board of one Kind: its tickets of every status in the board's order, none, and a kind outside the list refused", () => {
	const { board, root } = setup();
	assert.equal(board.full(undefined, "fix"), "the board is empty");
	handWritten(root, boardOfKinds());
	assert.equal(
		board.full(undefined, "fix"),
		["DM0014 planning    fix      Ticket DM0014  after DM0015", "DM0013 done        fix      Ticket DM0013", "DM0001 merged      fix      Ticket DM0001", "DM0016 dropped     fix      Ticket DM0016"].join("\n"),
		"the oldest merged and a dropped one included, and what it waits for read from the whole board",
	);
	assert.equal(board.full(undefined, "security"), ["DM0019 review      security Ticket DM0019", "DM0012 merged      security Ticket DM0012"].join("\n"));
	assert.equal(board.full(undefined, "perf"), "no ticket of kind perf");
	for (const kind of ["bug", "Fix", "", "feat fix"]) assert.throws(() => board.full(undefined, kind), { message: `unknown kind ${kind}; kinds: ${KINDS.join(", ")}` }, kind);
	assert.equal(board.full().split("\n").length, 19, "without a kind, every ticket");
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
		[JSON.stringify([{ ...valid, path: undefined }]), "[0].path: expected spec/features/DM0001-<slug>/ticket.md, a slug of a-z, 0-9 and -, got nothing"],
		// A filing writes next to the ticket.md: a path that leaves the project, or names another ticket's folder, is refused.
		...["spec/features/../../../outside/ticket.md", "spec/features/DM0001-one/../../../outside/ticket.md", "/tmp/DM0001-one/ticket.md", "spec/features/DM0002-one/ticket.md", "spec/features/DM00011-one/ticket.md", "spec/features/DM0001-/ticket.md", "spec/features/DM0001-One/ticket.md", "spec/features/DM0001-one/plan.md", "spec/features/DM0001-one/ticket.md/", "spec/features/DM0001-one/x/ticket.md", "spec/features/DM0001-one/ticket.md\n", "./spec/features/DM0001-one/ticket.md"].map(
			(path) => [JSON.stringify([{ ...valid, path }]), `[0].path: expected spec/features/DM0001-<slug>/ticket.md, a slug of a-z, 0-9 and -, got ${JSON.stringify(path)}`] as [string, string],
		),
		[JSON.stringify([{ ...valid, updated: "yesterday" }]), "[0].updated: expected an ISO 8601 time"],
		[JSON.stringify([valid, valid]), "[1].id: DM0001 is on the board twice"],
		[JSON.stringify([{ ...valid, after: "DM0002" }]), '[0].after: expected a list of ticket ids, got "DM0002"'],
		[JSON.stringify([{ ...valid, after: ["dm2"] }]), '[0].after: expected a list of ticket ids, got ["dm2"]'],
	];
	for (const [text, problem] of cases) {
		const { board, root, file } = setup();
		mkdirSync(join(root, "spec"));
		writeFileSync(file, text);
		for (const run of [() => board.list(), () => board.create("New"), () => board.move("DM0001", "done"), () => board.get("DM0001"), () => board.after("DM0001", []), () => board.digest()]) {
			assert.throws(run, (error: Error) => error.message.startsWith(`${file}: ${problem}`) && error.message.endsWith("fix the file by hand, or restore it from Git"), text);
		}
		assert.equal(readFileSync(file, "utf8"), text);
		assert.deepEqual(readdirSync(join(root, "spec")).sort(), [".board", "build.json"], "no ticket folder left");
		assert.deepEqual(readdirSync(join(root, "spec", ".board")), [".gitignore"], "no temporary file, no lock left");
	}
});

test("the board's own folder gets its .gitignore back when a crash or a hand left it empty or changed", () => {
	for (const text of ["", "*", "build.json.tmp\n"]) {
		const { board, root } = setup();
		const ignore = join(root, "spec", ".board", ".gitignore");
		mkdirSync(join(ignore, ".."), { recursive: true });
		writeFileSync(ignore, text);
		board.create("One");
		assert.equal(readFileSync(ignore, "utf8"), "*\n", JSON.stringify(text));
	}
});

test("under umask 022 the board's own folder is its user's alone: a new one 0700, one made 0755 earlier 0700; spec/ stays the project's", (t) => {
	const mask = process.umask(0o022);
	t.after(() => process.umask(mask));
	const mode = (path: string) => statSync(path).mode & 0o777;
	for (const earlier of [false, true]) {
		const { board, root } = setup();
		const folder = join(root, "spec", ".board");
		if (earlier) mkdirSync(folder, { recursive: true });
		if (earlier) assert.equal(mode(folder), 0o755, "the umask in force");
		board.create("One");
		assert.deepEqual([mode(folder), mode(join(root, "spec"))], [0o700, 0o755], `made earlier: ${earlier}`);
	}
});

// The writer is a real process, frozen at the rename that ends its write (the lock held, the temporary file written), then
// killed. Git runs without the user's or the system's config.
test("a writer killed mid-write leaves nothing Git shows, and the next write takes its lock over", async () => {
	const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
	const git = (root: string, ...args: string[]) => {
		const run = spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd: root, env, encoding: "utf8" });
		assert.equal(run.status, 0, run.stderr);
		return run.stdout;
	};
	const source = (file: string) => JSON.stringify(pathToFileURL(join(import.meta.dirname, "..", "src", file)).href);
	for (const [action, renamedTo, temporary] of [
		[`move("DM0001", "dropped")`, "build.json", "build.json.tmp"],
		[`create("Two")`, "ticket.md", "ticket.md.tmp"],
	]) {
		const { board, root } = setup();
		git(root, "init", "--quiet");
		board.create("One");
		git(root, "add", "--all");
		git(root, "commit", "--quiet", "--message", "One");
		assert.equal(git(root, "status", "--porcelain", "--untracked-files=all"), "", "the board's own folder is ignored once it exists");
		// `renameSync` is swapped on the `node:fs` module; `syncBuiltinESMExports` passes it to the board's named import of it.
		const script = `
			import fs from "node:fs";
			import { syncBuiltinESMExports } from "node:module";
			import { board } from ${source("board.ts")};
			import { clock } from ${source("clock.ts")};
			const rename = fs.renameSync;
			fs.renameSync = (from, to) => {
				if (String(to).endsWith(${JSON.stringify(renamedTo)})) {
					fs.writeSync(1, "written\\n");
					Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
				}
				return rename(from, to);
			};
			syncBuiltinESMExports();
			board(() => [[{ name: "demo", path: ${JSON.stringify(root)}, prefix: "DM" }]], clock("UTC", undefined), () => {}).${action};
		`;
		const writer = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "inherit"] });
		try {
			await once(writer.stdout, "data");
			const transient = join(root, "spec", ".board");
			assert.deepEqual(readdirSync(transient).sort(), [".gitignore", "build.json.lock", temporary], action);
			const exited = once(writer, "exit");
			writer.kill("SIGKILL");
			await exited;
			assert.equal(git(root, "status", "--porcelain", "--untracked-files=all"), "", `killed during ${action}`);
			assert.equal(board.move("DM0001", "dropped").status, "dropped");
			assert.equal(git(root, "status", "--porcelain", "--untracked-files=all"), " M spec/build.json\n", `the write after ${action}`);
			assert.deepEqual(readdirSync(transient).filter((name) => name.includes("lock")), [], "the dead holder's lock is gone");
		} finally {
			writer.kill("SIGKILL");
		}
	}
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
