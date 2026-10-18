import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import type { Entry } from "../src/entry.ts";
import { claim } from "../src/run-state.ts";
import { schedule } from "../src/schedule.ts";
import { sweeper } from "../src/sweep.ts";

const FILE = "spec/schedule.json";
const STANDUP: Entry = { id: "standup", at: "09:00", action: { message: "Plan the day." } };

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(20)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// The sweep of `entries` and of `spec/schedule.json` in a folder of its own, on a fake host in Warsaw at `now`; what it prints,
// emits as coordinator messages and as notices, caught.
function load(t: TestContext, entries: readonly Entry[], now: string, root = temporaryFolder()) {
	const [logs, errors] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void logs.push(text));
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const fake = fakeHost({ name: "schedule", options: { entries }, timeZone: "Europe/Warsaw", now: new Date(now), root });
	const said = (name: string) => fake.emitted.filter((event) => event.name === name).map((event) => (event.data as { readonly text: string }).text);
	return {
		fake,
		root,
		logs,
		errors,
		sweep: sweeper(fake.host, entries, [], FILE, root),
		at: (when: string) => fake.setNow(new Date(when)),
		messages: () => said("coordinator-message"),
		notices: () => said("notice"),
		write(path: string, text: string) {
			mkdirSync(dirname(join(root, path)), { recursive: true });
			writeFileSync(join(root, path), text);
		},
	};
}

test("a daily entry runs once at its time and again the next day; its run state keeps the latest slot only", async (t) => {
	const box = load(t, [STANDUP], "2026-10-19T08:59:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), []);
	box.at("2026-10-19T09:00:00+02:00");
	await box.sweep();
	box.at("2026-10-19T09:00:10+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled standup] Plan the day."]);
	box.at("2026-10-20T09:00:10+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled standup] Plan the day.", "[scheduled standup] Plan the day."]);
	assert.deepEqual(readdirSync(join(box.fake.host.folder, "standup")).sort(), ["2026-10-20T07:00:00.000Z", "seen"]);
});

test("a daily entry missed for three days runs once and says it is late; its next slot runs on time", async (t) => {
	const box = load(t, [STANDUP], "2026-10-15T09:00:00+02:00");
	await box.sweep();
	box.at("2026-10-19T08:00:00+02:00");
	await box.sweep();
	await box.sweep();
	box.at("2026-10-19T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled standup] Plan the day.", "[scheduled standup] (late: due 2026-10-18 09:00) Plan the day.", "[scheduled standup] Plan the day."]);
});

test("a new daily entry does not run a slot from before its first sweep late; one at most 5 minutes before still runs", async (t) => {
	const box = load(t, [STANDUP, { id: "tea", at: "14:55", action: { message: "Tea." } }, { id: "late-tea", at: "14:54", action: { message: "No tea." } }], "2026-10-19T15:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled tea] Tea."]);
	box.at("2026-10-20T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled tea] Tea.", "[scheduled standup] Plan the day."]);
});

test("a one-off in the past runs once at start, late; never again after a restart; a later one runs at its time", async (t) => {
	const entries: Entry[] = [
		{ id: "night", at: "2026-10-18T22:00", action: { message: "Check the night plan." } },
		{ id: "tomorrow", at: "2026-10-20T09:00", action: { message: "Not yet." } },
	];
	const box = load(t, entries, "2026-10-19T09:00:00+02:00");
	const plugin = schedule({ entries });
	await box.fake.setup(plugin);
	t.after(() => plugin.stop?.());
	await plugin.start?.();
	await until("the one-off", () => box.messages().length === 1);
	await plugin.stop?.();
	const restarted = sweeper(box.fake.host, entries, [], undefined, box.root);
	await restarted();
	box.at("2026-10-20T09:00:00+02:00");
	await restarted();
	assert.deepEqual(box.messages(), ["[scheduled night] (late: due 2026-10-18 22:00) Check the night plan.", "[scheduled tomorrow] Not yet."]);
});

test("a hand-broken entry of the file is skipped and named once while it lasts; the others still run", async (t) => {
	const box = load(t, [STANDUP], "2026-10-19T09:00:00+02:00");
	const entries = [
		{ id: "from-file", at: "09:00", action: { message: "From the file." } },
		{ id: "bad-time", at: "25:00", action: { message: "Never." } },
		null,
		{ id: "standup", at: "09:00", action: { message: "Taken." } },
		{ id: "from-file", at: "09:00", job: { task: "Taken too." } },
		{ id: "../out", at: "09:00", action: { message: "Out." }, extra: 1 },
	];
	box.write(FILE, JSON.stringify(entries));
	await box.sweep();
	box.at("2026-10-19T09:00:10+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled standup] Plan the day.", "[scheduled from-file] From the file."]);
	const named = [
		'schedule: spec/schedule.json[1] "bad-time": skipped, at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "25:00"',
		"schedule: spec/schedule.json[2]: skipped, expected an entry { id, at, action or job }, got null",
		'schedule: spec/schedule.json[3] "standup": skipped, its id is taken by an entry of the config',
		'schedule: spec/schedule.json[4] "from-file": skipped, its id is taken by an earlier entry of the file',
		'schedule: spec/schedule.json[5] "../out": skipped, extra: unknown key; keys: id, at, days, action, job; id: expected letters and digits, joined by single dots, dashes or underscores, got "../out"',
	];
	assert.deepEqual(box.notices(), named);
	assert.deepEqual(box.errors, named);

	box.write(FILE, "[{");
	box.at("2026-10-20T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages().slice(2), ["[scheduled standup] Plan the day."], "the config's entry runs while the file is broken");
	assert.match(box.notices()[5] ?? "", /^schedule: spec\/schedule\.json: none of its entries run: /);
	box.write(FILE, '{ "id": "x" }');
	await box.sweep();
	assert.equal(box.notices()[6], "schedule: spec/schedule.json: none of its entries run: expected a JSON list of entries, got an object");
	rmSync(join(box.root, FILE));
	box.at("2026-10-21T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual([box.messages().length, box.notices().length], [4, 7], "a missing file holds no entry and is no problem");
});

test("two sweeps at once claim a slot once, also from separate processes", async (t) => {
	const box = load(t, [STANDUP], "2026-10-19T09:00:00+02:00");
	await Promise.all([box.sweep(), sweeper(box.fake.host, [STANDUP], [], FILE, box.root)()]);
	assert.deepEqual(box.messages(), ["[scheduled standup] Plan the day."]);

	const slot = new Date("2026-10-19T07:00:00Z");
	assert.deepEqual([claim(box.fake.host.folder, "once", slot, slot), claim(box.fake.host.folder, "once", slot, slot)], [true, false]);
	const go = Date.now() + 1000;
	const racer = `import { claim } from ${JSON.stringify(new URL("../src/run-state.ts", import.meta.url).href)};
		while (Date.now() < ${go});
		console.log(claim(${JSON.stringify(box.fake.host.folder)}, "race", new Date(${slot.getTime()}), new Date()));`;
	const outputs = await Promise.all(
		Array.from({ length: 8 }, () => {
			const child = spawn(process.execPath, ["--input-type=module", "-e", racer], { stdio: ["ignore", "pipe", "inherit"] });
			let out = "";
			child.stdout.on("data", (chunk) => (out += chunk));
			return new Promise<string>((done) => child.on("close", () => done(out.trim())));
		}),
	);
	assert.deepEqual(outputs.sort(), ["false", "false", "false", "false", "false", "false", "false", "true"]);
});

test("a day list that excludes today runs nothing today; the entry runs on its next day", async (t) => {
	const box = load(t, [{ id: "weekly", at: "09:00", days: ["mon"], action: { message: "Summarise the week." } }, { id: "midweek", at: "09:00", days: ["tue", "wed"], action: { message: "Midweek." } }], "2026-10-19T08:00:00+02:00");
	await box.sweep();
	box.at("2026-10-19T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled weekly] Summarise the week."]);
	box.at("2026-10-20T09:00:00+02:00");
	await box.sweep();
	box.at("2026-10-21T09:00:00+02:00");
	await box.sweep();
	box.at("2026-10-23T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled weekly] Summarise the week.", "[scheduled midweek] Midweek.", "[scheduled midweek] Midweek."]);
	box.at("2026-10-26T09:00:00+01:00");
	await box.sweep();
	assert.equal(box.messages().at(-1), "[scheduled weekly] Summarise the week.");
});

test("times in the daylight saving changes: the spring gap runs at the jump, the autumn repeat once", async (t) => {
	const box = load(t, [{ id: "gap", at: "2026-03-29T02:30", action: { message: "Gap." } }, { id: "repeat", at: "02:30", action: { message: "Repeat." } }], "2026-03-29T00:59:00Z");
	await box.sweep();
	assert.deepEqual(box.messages(), []);
	box.at("2026-03-29T01:00:00Z");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled gap] Gap.", "[scheduled repeat] Repeat."], "02:30 does not exist that day: 03:00, for the one-off and the daily entry");
	box.at("2026-10-25T00:30:00Z");
	await box.sweep();
	box.at("2026-10-25T01:30:00Z");
	await box.sweep();
	assert.deepEqual(box.messages().slice(2), ["[scheduled repeat] Repeat."], "02:30 is shown twice that day: its first pass only");
});

test("an action's procedure goes under its message as the file reads when due; one that cannot be read, or whose path holds a symlink anywhere, holds the entry back, named", async (t) => {
	// The folder arthur runs in may itself be reached through a symlink; only the path below it is checked.
	const root = join(temporaryFolder(), "via-link");
	symlinkSync(temporaryFolder(), root);
	const action = (procedure: string) => ({ message: "Never.", procedure });
	const entries: Entry[] = [
		{ id: "morning", at: "09:00", action: { message: "Write the morning report.", procedure: "procedures/morning.md" } },
		{ id: "linked", at: "09:00", action: action("procedures/linked.md") },
		{ id: "up", at: "09:00", action: action("procedures/up/secret.md") },
		{ id: "self", at: "09:00", action: action("procedures/self/other.md") },
	];
	const box = load(t, entries, "2026-10-19T08:00:00+02:00", root);
	box.write("secret.md", "not for the coordinator");
	box.write("procedures/other.md", "inside, but reached through a symlink");
	symlinkSync("../secret.md", join(box.root, "procedures/linked.md"));
	symlinkSync("..", join(box.root, "procedures/up"));
	symlinkSync(".", join(box.root, "procedures/self"));
	await box.sweep();
	box.at("2026-10-19T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), []);
	const through = (id: string, path: string) => `schedule: ${id}: skipped until its procedure can be read: ${path} is or goes through a symlink, which is never read`;
	assert.deepEqual(box.notices(), [
		`schedule: morning: skipped until its procedure can be read: procedures/morning.md: ENOENT: no such file or directory, lstat '${join(realpathSync(box.root), "procedures/morning.md")}'`,
		through("linked", "procedures/linked.md"),
		through("up", "procedures/up/secret.md"),
		through("self", "procedures/self/other.md"),
	]);
	box.write("procedures/morning.md", "# Morning report\n\nFirst version.\n");
	box.at("2026-10-19T09:01:00+02:00");
	await box.sweep();
	box.write("procedures/morning.md", "# Morning report\n\nSecond version.\n");
	box.at("2026-10-20T09:00:00+02:00");
	await box.sweep();
	assert.deepEqual(box.messages(), ["[scheduled morning] Write the morning report.\n\n# Morning report\n\nFirst version.", "[scheduled morning] Write the morning report.\n\n# Morning report\n\nSecond version."]);
	assert.equal(box.notices().length, 4, "a problem is said once while it lasts");
});

test("a job entry spawns a job of its kind, late saying so; a spawn the core refuses goes to the coordinator with the reason", async (t) => {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	process.env.PATH = [dirname(fakeAgent({ steps: [{ message: "Checked." }] })), saved].join(delimiter);
	const entries: Entry[] = [
		{ id: "docs", at: "03:00", job: { task: "Check that every command has its doc page.", kind: "worker" } },
		{ id: "audit", at: "03:00", job: { task: "Audit the code.", kind: "audit" } },
	];
	const box = load(t, entries, "2026-10-19T02:58:00+02:00", root);
	await box.sweep();
	box.at("2026-10-19T03:06:00+02:00");
	await box.sweep();
	const [job] = box.fake.host.jobs.list();
	assert.deepEqual([job?.kind, readFileSync(join(dirname(box.fake.host.folder), "jobs", job?.id ?? "", "task"), "utf8")], ["worker", "Check that every command has its doc page."]);
	assert.deepEqual(box.logs, [`schedule: docs (late: due 2026-10-19 03:00): started job ${job?.id}`]);
	assert.deepEqual(box.messages(), ["[scheduled audit] (late: due 2026-10-19 03:00) Its job (kind audit) did not start: unknown kind audit; kinds: worker\nIts task: Audit the code."]);
	await until("the job's end", () => box.fake.host.jobs.list()[0]?.state === "ended");
	box.at("2026-10-19T03:07:00+02:00");
	await box.sweep();
	assert.equal(box.fake.host.jobs.list().length, 1, "a claimed slot does not spawn again");
});

test("the options: entries and file as the example config has them; every wrong one refused, naming its path", () => {
	const check = (options: unknown) => schedule().check?.(options as never, undefined as never);
	const job = { task: "Check the docs.", kind: "worker", project: "arthur" };
	const example = [
		{ id: "weekly-summary", at: "09:00", days: ["mon"], action: { message: "Summarise last week's merges for the human." } },
		{ id: "doc-check", at: "03:00", days: ["wed"], job: { kind: "worker", project: "arthur", task: "Check that every command has its doc page." } },
		{ id: "release-day", at: "2026-11-02T08:30", action: { message: "Release day.", procedure: "docs/release.md" } },
	];
	assert.deepEqual(check({ file: FILE, entries: example }), []);
	assert.deepEqual(check({ entries: [{ ...STANDUP, days: ["fri", "sun"] }, { id: "once.1", at: "2026-02-28T23:59", job }, { id: "p_2", at: "00:00", action: { message: "x", procedure: "a/b.md" } }] }), []);
	assert.deepEqual(check({}), []);
	const entries = [
		{ id: "a", at: "24:00", action: { message: "x" } },
		{ id: "b", at: "9:00", action: { message: "x" } },
		{ id: "c", at: "2026-02-29T09:00", action: { message: "x" } },
		{ id: "d", at: "2026-10-19 09:00", action: { message: "x" } },
		{ id: "e", at: "2026-10-19T09:00", days: ["mon"], action: { message: "x" } },
		{ id: "f", at: "09:00", days: [], job },
		{ id: "g", at: "09:00", days: ["monday"], job },
		{ id: "h", at: "09:00", action: { message: "x" }, job },
		{ id: "i", at: "09:00" },
		{ id: "j", at: "09:00", action: { message: " ", when: 1 } },
		{ id: "k", at: "09:00", action: { message: "x", procedure: "/etc/passwd.md" } },
		{ id: "l", at: "09:00", action: { message: "x", procedure: "../out.md" } },
		{ id: "m", at: "09:00", action: { message: "x", procedure: ".env" } },
		{ id: "n", at: "09:00", job: { kind: "worker" } },
		{ id: "a", at: "09:00", job: "go" },
		{ id: "o/p", at: "09:00", action: { message: "x" } },
		"daily",
	];
	assert.deepEqual(check({ file: "", entries, every: 1 }), [
		{ path: "every", problem: "unknown option; options: file, entries" },
		{ path: "file", problem: 'expected the path of a JSON file, got ""' },
		{ path: "entries[0].at", problem: 'expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "24:00"' },
		{ path: "entries[1].at", problem: 'expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "9:00"' },
		{ path: "entries[2].at", problem: 'expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "2026-02-29T09:00"' },
		{ path: "entries[3].at", problem: 'expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "2026-10-19 09:00"' },
		{ path: "entries[4].days", problem: "a one-off entry takes no days" },
		{ path: "entries[5].days", problem: "expected a non-empty list of mon, tue, wed, thu, fri, sat, sun, got a list" },
		{ path: "entries[6].days", problem: "expected a non-empty list of mon, tue, wed, thu, fri, sat, sun, got a list" },
		{ path: "entries[7].action", problem: "expected either action or job" },
		{ path: "entries[8].action", problem: "expected either action or job" },
		{ path: "entries[9].action.when", problem: "unknown key; keys: message, procedure" },
		{ path: "entries[9].action.message", problem: 'expected non-empty text, got " "' },
		{ path: "entries[10].action.procedure", problem: 'expected the relative path of a .md file inside the folder arthur runs in, got "/etc/passwd.md"' },
		{ path: "entries[11].action.procedure", problem: 'expected the relative path of a .md file inside the folder arthur runs in, got "../out.md"' },
		{ path: "entries[12].action.procedure", problem: 'expected the relative path of a .md file inside the folder arthur runs in, got ".env"' },
		{ path: "entries[13].job.task", problem: "expected non-empty text, got nothing" },
		{ path: "entries[14].job", problem: 'expected an object with task, kind, project, got "go"' },
		{ path: "entries[14].id", problem: "a is the id of entries[0] too" },
		{ path: "entries[15].id", problem: 'expected letters and digits, joined by single dots, dashes or underscores, got "o/p"' },
		{ path: "entries[16]", problem: 'expected an entry { id, at, action or job }, got "daily"' },
	]);
	assert.deepEqual(check({ entries: { standup: STANDUP } }), [{ path: "entries", problem: "expected a list of entries, got an object" }]);
});
