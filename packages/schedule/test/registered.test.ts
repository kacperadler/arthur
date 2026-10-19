import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import type { Entry } from "../src/entry.ts";
import { claim } from "../src/run-state.ts";
import { schedule } from "../src/schedule.ts";

const STANDUP: Entry = { id: "standup", at: "09:00", action: { message: "Plan the day." } };
const REPORT = { id: "report", at: "08:00", option: "morningReport.at", action: { message: "Write the morning report." } };

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(20)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// The schedule plugin set up on a fake host in Warsaw at `now`, as `arthur run` and the `arthur` binary set it up. Its file is
// `<root>/spec/schedule.json`, given by its absolute path, so nothing reads the folder the tests run in; `manage` is the
// package folder of a plugin manage, in the host's `code` after the core's. What it prints, and emits, caught.
async function load(t: TestContext, entries: readonly Entry[], now: string, { root = temporaryFolder(), file = true } = {}) {
	const code = temporaryFolder();
	const manage = join(code, "manage");
	mkdirSync(join(manage, "roles"), { recursive: true });
	const path = join(root, "spec", "schedule.json");
	const plugin = schedule({ entries, ...(file ? { file: path } : {}) });
	const fake = fakeHost({ name: "schedule", options: plugin.options, timeZone: "Europe/Warsaw", now: new Date(now), root, code: [join(code, "core"), manage] });
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	const [logs, errors] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void logs.push(text));
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const said = (name: string) => fake.emitted.filter((event) => event.name === name).map((event) => (event.data as { readonly text: string }).text);
	const command = fake.commands.find((each) => each.name === "schedule");
	return {
		fake,
		root,
		file: path,
		manage,
		logs,
		errors,
		messages: () => said("coordinator-message"),
		notices: () => said("notice"),
		register: (name: unknown, list: unknown) => fake.call("schedule.register", name, list),
		run: (...args: string[]) => command?.run({ args, project: undefined }),
		runFor: (project: string, ...args: string[]) => command?.run({ args, project }),
		write(text: unknown) {
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, typeof text === "string" ? text : JSON.stringify(text));
		},
		read: () => JSON.parse(readFileSync(path, "utf8")),
		// One sweep at `at`, the one `arthur run` makes at its start.
		async sweep(at: string) {
			fake.setNow(new Date(at));
			await plugin.start?.();
			await plugin.stop?.();
		},
	};
}

test("a plugin registers its entries from its options: ids namespaced by the plugin, run like the config's, a procedure read from its own package folder", async (t) => {
	const box = await load(t, [STANDUP], "2026-10-20T07:59:00+02:00");
	const procedure = join(box.manage, "roles", "morning-report.md");
	writeFileSync(procedure, "# Morning report\n\nWhat was built overnight.\n");
	box.register("manage", [
		{ ...REPORT, action: { ...REPORT.action, procedure } },
		{ id: "audit", at: "02:00", days: ["tue", "fri"], option: "audit.at", job: { task: "Audit the code.", kind: "audit" } },
	]);
	box.register("voice", [{ id: "tidy", at: "2026-10-21T04:00", option: "tidy.at", action: { message: "Tidy the models." } }]);
	await box.sweep("2026-10-20T08:00:00+02:00");
	await until("the report", () => box.messages().length === 1);
	assert.deepEqual(box.messages(), ["[scheduled manage.report] Write the morning report.\n\n# Morning report\n\nWhat was built overnight."]);
	assert.equal(box.run("list"), 0);
	assert.deepEqual(box.logs, [
		[
			"standup (config): every day at 09:00, next 2026-10-20 09:00",
			"  message: Plan the day.",
			"manage.report (plugin manage, option morningReport.at): every day at 08:00, next 2026-10-21 08:00",
			`  message: Write the morning report. (procedure ${procedure})`,
			"manage.audit (plugin manage, option audit.at): tue, fri at 02:00, next 2026-10-23 02:00",
			"  job (kind audit): Audit the code.",
			"voice.tidy (plugin voice, option tidy.at): once at 2026-10-21 04:00, next 2026-10-21 04:00",
			"  message: Tidy the models.",
		].join("\n"),
	]);
});

test("a registration that clashes or is wrong is refused whole, naming the plugin; a procedure only as an absolute .md path in its own package folder", async (t) => {
	const box = await load(t, [{ id: "manage.report", at: "09:00", action: { message: "Mine." } }], "2026-10-20T07:00:00+02:00");
	const refused = (name: unknown, list: unknown, message: string) => assert.throws(() => box.register(name, list), { message });
	refused("manage", [REPORT], "schedule.register from plugin manage: entries[0].id: manage.report is the id of an entry of the config too");
	box.register("manage", [{ ...REPORT, id: "audit" }]);
	refused("manage", [{ ...REPORT, id: "audit", option: "audit.at" }], "schedule.register from plugin manage: entries[0].id: manage.audit is registered already, from option morningReport.at");
	refused("manage", [{ ...REPORT, id: "retro" }, { ...REPORT, id: "retro" }], "schedule.register from plugin manage: entries[1].id: manage.retro is registered already, from option morningReport.at");
	const at = (procedure: string) => [{ ...REPORT, id: "steps", action: { message: "Report.", procedure } }];
	for (const path of ["roles/report.md", "/etc/passwd.md", `${box.manage}/roles/../report.md`, `${box.manage}-other/report.md`, join(box.manage, ".env"), join(box.manage, "roles")])
		refused("manage", at(path), `schedule.register from plugin manage: entries[0].action.procedure: expected the absolute path of a .md file in the package folder of plugin manage, ${box.manage}, got ${JSON.stringify(path)}`);
	refused("voice", at(join(box.manage, "roles", "report.md")), "schedule.register from plugin voice: entries[0].action.procedure: plugin voice has no package folder, so its entries take no procedure");
	refused(undefined, [REPORT], "schedule.register: expected the registering plugin's name, then its entries, got nothing");
	refused("Manage", [REPORT], 'schedule.register: expected the registering plugin\'s name, then its entries, got "Manage"');
	refused("manage", REPORT, "schedule.register from plugin manage: expected a list of entries, got an object");
	refused(
		"manage",
		[{ ...REPORT, id: "fine" }, { id: "bad/id", at: "25:00", action: { message: "x" } }, "daily"],
		'schedule.register from plugin manage: entries[1].id: expected letters and digits, joined by single dots, dashes or underscores, got "bad/id"; entries[1].at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "25:00"; entries[1].option: expected the path of the plugin\'s option that makes the entry, got nothing; entries[2]: expected an entry { id, at, action or job }, got "daily"',
	);
	box.run("list");
	assert.deepEqual(
		box.logs[0]?.split("\n").filter((line) => !line.startsWith(" ")),
		["manage.report (config): every day at 09:00, next 2026-10-20 09:00", "manage.audit (plugin manage, option morningReport.at): every day at 08:00, next 2026-10-20 08:00"],
		"of a refused registration no entry is added, the good ones beside it included",
	);
});

test("a registered entry may run its plugin's own code at its time: claimed once per slot like the others, a failure said as a notice", async (t) => {
	const box = await load(t, [], "2026-10-20T03:59:00+02:00");
	const ran: string[] = [];
	box.register("sweep", [
		{ id: "docker", at: "04:00", option: "sweep.at", run: async () => void ran.push("docker") },
		{ id: "prune", at: "04:00", option: "prune.keepJobsDays", run: () => Promise.reject(new Error("rm: Permission denied")) },
	]);
	await box.sweep("2026-10-20T04:00:00+02:00");
	await box.sweep("2026-10-20T04:00:30+02:00");
	await until("the failure's notice", () => box.notices().length === 1);
	assert.deepEqual(ran, ["docker"], "two sweeps of one slot run it once");
	assert.deepEqual(box.notices(), ["schedule: sweep.prune: its run failed: rm: Permission denied"]);
	assert.deepEqual(box.messages(), [], "no message to the coordinator, no job");
	await box.sweep("2026-10-21T04:07:00+02:00");
	await until("the next day's failure", () => box.notices().length === 2);
	assert.deepEqual([ran, box.notices()[1]], [["docker", "docker"], "schedule: sweep.prune (late: due 2026-10-21 04:00): its run failed: rm: Permission denied"]);
	box.run("list");
	assert.equal(box.logs.at(-1)?.split("\n").slice(0, 2).join("\n"), "sweep.docker (plugin sweep, option sweep.at): every day at 04:00, next 2026-10-22 04:00\n  run: the plugin's own code");
	const refused = (entry: object, message: string) => assert.throws(() => box.register("sweep", [{ id: "other", at: "05:00", option: "sweep.at", ...entry }]), { message: `schedule.register from plugin sweep: entries[0].${message}` });
	refused({ run: "docker system prune" }, 'run: expected the plugin\'s own code, an async function, got "docker system prune"');
	refused({ run: async () => {}, action: { message: "Sweep." } }, "run: expected either action, job or run");
	refused({}, "action: expected either action or job");
});

test("the config and the file keep the relative path; a registered procedure behind a symlink in the package folder is never read", async (t) => {
	const box = await load(t, [], "2026-10-20T07:00:00+02:00");
	const inside = join(box.manage, "roles", "report.md");
	writeFileSync(inside, "# Report");
	writeFileSync(join(box.root, "secret.md"), "not for the coordinator");
	symlinkSync(join(box.root, "secret.md"), join(box.manage, "roles", "linked.md"));
	box.register("manage", [{ ...REPORT, id: "linked", action: { message: "Report.", procedure: join(box.manage, "roles", "linked.md") } }]);
	box.write([{ id: "steal", at: "08:00", action: { message: "Read it.", procedure: inside } }, { id: "after", at: "08:00", action: { message: "After." } }]);
	await box.sweep("2026-10-20T08:00:00+02:00");
	await until("the file's entry", () => box.messages().includes("[scheduled after] After."));
	assert.deepEqual(box.messages(), ["[scheduled after] After."]);
	assert.deepEqual(box.notices(), [
		`schedule: ${box.file}[0] "steal": skipped, action.procedure: expected the relative path of a .md file inside the folder arthur runs in, got ${JSON.stringify(inside)}`,
		`schedule: manage.linked: skipped until its procedure can be read: ${join(box.manage, "roles", "linked.md")} is or goes through a symlink, which is never read`,
	]);
	assert.deepEqual(schedule().check?.({ entries: [{ id: "steal", at: "08:00", action: { message: "x", procedure: inside } }] }, undefined as never), [
		{ path: "entries[0].action.procedure", problem: `expected the relative path of a .md file inside the folder arthur runs in, got ${JSON.stringify(inside)}` },
	]);
});

test("arthur schedule list: every entry with its source and next run; a one-off that ran, is due or is to come; a broken entry of the file named", async (t) => {
	const box = await load(t, [STANDUP], "2026-10-20T10:00:00+02:00");
	box.register("manage", [REPORT]);
	box.write([
		{ id: "release", at: "2026-11-02T08:30", action: { message: "Release day.", procedure: "docs/release.md" } },
		{ id: "missed", at: "2026-10-19T22:00", action: { message: "Missed." } },
		{ id: "done", at: "2026-10-18T22:00", action: { message: "Done." } },
		{ id: "docs", at: "03:00", days: ["wed"], job: { task: "Check the docs.", project: "shop" } },
		{ id: "broken", at: "24:00", action: { message: "Never." } },
	]);
	claim(box.fake.host.folder, "done", new Date("2026-10-18T20:00:00Z"), new Date("2026-10-18T20:00:00Z"));
	assert.equal(box.run(), 0);
	assert.deepEqual(box.logs, [
		[
			"standup (config): every day at 09:00, next 2026-10-21 09:00",
			"  message: Plan the day.",
			"manage.report (plugin manage, option morningReport.at): every day at 08:00, next 2026-10-21 08:00",
			"  message: Write the morning report.",
			`release (${box.file}): once at 2026-11-02 08:30, next 2026-11-02 08:30`,
			"  message: Release day. (procedure docs/release.md)",
			`missed (${box.file}): once at 2026-10-19 22:00, due: runs at the next sweep of arthur run`,
			"  message: Missed.",
			`done (${box.file}): once at 2026-10-18 22:00, ran`,
			"  message: Done.",
			`docs (${box.file}): wed at 03:00, next 2026-10-21 03:00`,
			"  job (kind worker, project shop): Check the docs.",
			`${box.file}[4] "broken": skipped, at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "24:00"`,
		].join("\n"),
	]);
	const empty = await load(t, [], "2026-10-20T10:00:00+02:00");
	empty.run("list");
	assert.deepEqual(empty.logs, [`no entries; arthur schedule add puts one in ${empty.file}`]);
	const none = await load(t, [], "2026-10-20T10:00:00+02:00", { file: false });
	none.run("list");
	assert.deepEqual(none.logs, ["no entries"]);
});

test("arthur schedule add puts an entry in the file; one with a time that is not valid, or an id that is taken, is refused and changes nothing", async (t) => {
	const box = await load(t, [STANDUP], "2026-10-19T10:00:00+02:00");
	box.register("manage", [{ id: "audit", at: "02:00", option: "audit.at", job: { task: "Audit.", kind: "audit" } }]);
	assert.equal(box.run("add", "weekly", "09:00", "--days", "mon,fri", "--message", "Summarise the week.", "--procedure", "docs/weekly.md"), 0);
	assert.equal(box.runFor("shop", "add", "nightly", "2026-10-20T03:00", "--task", "Check the docs.", "--kind", "worker"), 0);
	const written = [
		{ id: "weekly", at: "09:00", days: ["mon", "fri"], action: { message: "Summarise the week.", procedure: "docs/weekly.md" } },
		{ id: "nightly", at: "2026-10-20T03:00", job: { task: "Check the docs.", kind: "worker", project: "shop" } },
	];
	assert.deepEqual(box.read(), written);
	assert.deepEqual(box.logs, [
		`added weekly (${box.file}): mon, fri at 09:00, next 2026-10-23 09:00\n  message: Summarise the week. (procedure docs/weekly.md)`,
		`added nightly (${box.file}): once at 2026-10-20 03:00, next 2026-10-20 03:00\n  job (kind worker, project shop): Check the docs.`,
	]);
	const refused = (args: readonly string[], message: string) => assert.throws(() => box.run(...args), { message });
	const time = (at: string) => `at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "${at}"`;
	refused(["add", "late", "24:00", "--message", "x"], `cannot add late: ${time("24:00")}`);
	refused(["add", "late", "2026-02-30T09:00", "--message", "x"], `cannot add late: ${time("2026-02-30T09:00")}`);
	refused(["add", "late", "9:00", "--days", "monday", "--message", "x"], `cannot add late: ${time("9:00")}; days: expected a non-empty list of mon, tue, wed, thu, fri, sat, sun, got a list`);
	refused(["add", "both", "09:00", "--message", "x", "--task", "y"], "cannot add both: action: expected either action or job");
	refused(["add", "steal", "09:00", "--message", "x", "--procedure", "/etc/passwd.md"], 'cannot add steal: action.procedure: expected the relative path of a .md file inside the folder arthur runs in, got "/etc/passwd.md"');
	refused(["add", "standup", "10:00", "--message", "x"], "cannot add standup: its id is taken by an entry of the config");
	refused(["add", "manage.audit", "10:00", "--message", "x"], "cannot add manage.audit: its id is taken by plugin manage's option audit.at");
	refused(["add", "weekly", "10:00", "--message", "x"], `cannot add weekly: its id is taken by an entry of ${box.file}`);
	assert.deepEqual(box.read(), written);
	for (const args of [["frobnicate"], ["list", "all"], ["remove"], ["remove", "a", "b"], ["add", "x"], ["add", "x", "10:00", "--message"], ["add", "x", "10:00", "--message", "a", "--message", "b"], ["add", "x", "10:00", "--every", "2"]])
		assert.equal(box.run(...args), 2, args.join(" "));
	assert.equal(box.runFor("shop", "list"), 2);
	assert.deepEqual(
		box.errors.map((error) => error.split("\n")[0]),
		["unknown verb frobnicate", "list takes no arguments", "remove takes one id", "remove takes one id", "add takes an id and a time", "--message needs a value", "--message given twice", "add takes no --every", "--project is for add only"].map((why) => `arthur schedule: ${why}`),
	);
	assert.match(box.errors[0] ?? "", /\nusage: arthur schedule \[list\]; arthur schedule add <id> <at> /);

	box.write("[{");
	assert.throws(() => box.run("add", "x", "10:00", "--message", "x"), { message: new RegExp(`^${box.file}: .*JSON.*; fix it by hand first, nothing was changed$`) });
	assert.equal(readFileSync(box.file, "utf8"), "[{", "a file that is not a JSON list is never written over");
	const none = await load(t, [], "2026-10-19T10:00:00+02:00", { file: false });
	assert.throws(() => none.run("add", "x", "10:00", "--message", "x"), { message: 'cannot add x: schedule has no file option; set it in arthur.config.ts, such as file: "spec/schedule.json"' });
});

test("arthur schedule remove takes an entry and its run state out of the file; a registered or a config entry is refused, saying where it comes from", async (t) => {
	const box = await load(t, [STANDUP], "2026-10-19T10:00:00+02:00");
	box.register("manage", [{ id: "audit", at: "02:00", option: "audit.at", job: { task: "Audit.", kind: "audit" } }]);
	const kept = { id: "kept", at: "11:00", action: { message: "Kept." } };
	box.write([{ id: "weekly", at: "09:00", action: { message: "Week." } }, kept, "hand-broken"]);
	claim(box.fake.host.folder, "weekly", new Date("2026-10-19T07:00:00Z"), new Date());
	assert.equal(box.run("remove", "weekly"), 0);
	assert.deepEqual(box.read(), [kept, "hand-broken"]);
	assert.equal(existsSync(join(box.fake.host.folder, "weekly")), false, "its run state is gone, so a later weekly is a new entry");
	assert.deepEqual(box.logs, [`removed weekly from ${box.file}`]);
	const refused = (id: string, message: string) => assert.throws(() => box.run("remove", id), { message });
	refused("manage.audit", "cannot remove manage.audit: plugin manage makes it from its option audit.at; change or turn off that option in arthur.config.ts");
	refused("standup", "cannot remove standup: it is schedule.entries[0] in arthur.config.ts; remove it there");
	refused("weekly", `no entry weekly in ${box.file}; arthur schedule list shows every entry`);
	refused("../kept", 'cannot remove "../kept": expected the id of an entry; arthur schedule list shows them');
	assert.deepEqual(box.read(), [kept, "hand-broken"]);
	const none = await load(t, [], "2026-10-19T10:00:00+02:00", { file: false });
	assert.throws(() => none.run("remove", "x"), { message: "no entry x; arthur schedule list shows every entry" });
});

test("a plugin disabled after registering leaves no entry behind: none in the file, the list or the sweep", async (t) => {
	const root = temporaryFolder();
	const first = await load(t, [], "2026-10-20T07:00:00+02:00", { root });
	first.register("manage", [{ ...REPORT, at: "09:00" }]);
	first.write([{ id: "after", at: "09:00", action: { message: "After." } }]);
	assert.equal(first.run("add", "later", "12:00", "--message", "Later."), 0);
	await first.sweep("2026-10-20T09:00:00+02:00");
	await until("both entries", () => first.messages().length === 2);
	assert.deepEqual(first.messages(), ["[scheduled manage.report] Write the morning report.", "[scheduled after] After."]);
	assert.deepEqual(
		first.read().map((entry: Entry) => entry.id),
		["after", "later"],
	);

	// The next load without the plugin: the host never runs its setup, so nothing registers.
	const next = await load(t, [], "2026-10-21T07:00:00+02:00", { root });
	next.run("list");
	assert.deepEqual(next.logs[0]?.split("\n").filter((line) => !line.startsWith(" ")), [`after (${next.file}): every day at 09:00, next 2026-10-21 09:00`, `later (${next.file}): every day at 12:00, next 2026-10-21 12:00`]);
	await next.sweep("2026-10-21T09:00:00+02:00");
	await until("the file's entry", () => next.messages().length > 0);
	assert.deepEqual(next.messages(), ["[scheduled after] After."]);
});

test("two adds at once, from separate processes, lose neither's entry", async () => {
	const root = temporaryFolder();
	const folder = temporaryFolder();
	const go = Date.now() + 1000;
	const racer = (n: number) => `import { changeEntries } from ${JSON.stringify(new URL("../src/entry-file.ts", import.meta.url).href)};
		while (Date.now() < ${go});
		for (let i = 0; i < 5; i++) changeEntries("spec/schedule.json", ${JSON.stringify(root)}, ${JSON.stringify(folder)}, (list) => [...list, { id: "p${n}-" + i }]);`;
	await Promise.all(
		Array.from({ length: 6 }, (_, n) => {
			const child = spawn(process.execPath, ["--input-type=module", "-e", racer(n)], { stdio: ["ignore", "inherit", "inherit"] });
			return new Promise<void>((done) => child.on("close", () => done()));
		}),
	);
	const ids = JSON.parse(readFileSync(join(root, "spec", "schedule.json"), "utf8")).map((entry: Entry) => entry.id);
	assert.equal(ids.length, 30);
	assert.equal(new Set(ids).size, 30);
});
