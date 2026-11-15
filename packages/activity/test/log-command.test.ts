import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { type FakeHost, fakeHost } from "@arthur/core/testing";
import type { Line } from "../src/activity-line.ts";
import { type ActivityOptions, activity } from "../src/activity.ts";

// `arthur log` and `/log` against the fake host: the day files written as the plugin writes them, read in `core.timeZone`
// (Europe/Warsaw, an hour ahead of UTC in November). docs/commands/log.md.

const NOW = new Date("2026-11-13T10:00:00Z");
const [J, J2] = ["2026-11-13-review-0000000b", "2026-11-12-plan-0000000c"];
const line = (seq: number, minute: number, actor: string, what: string, text: string, more: Partial<Line> = {}): Line => ({
	seq,
	time: `2026-11-13T08:${String(minute).padStart(2, "0")}:00.000Z`,
	actor,
	plugin: "core",
	what,
	...more,
	text,
});
const YESTERDAY: Line[] = [
	{ ...line(7, 0, "user:telegram", "message-received", "Plan AC0013"), time: "2026-11-12T20:00:00.000Z" },
	{ ...line(8, 0, "coordinator", "job-started", "plan on AC0013, machine local", { on: [7], job: J2, kind: "plan", ticket: "AC0013", project: "acme" }), time: "2026-11-12T20:01:00.000Z" },
	{ ...line(9, 0, "user:telegram", "message-received", "Steer the plan"), time: "2026-11-12T22:59:00.000Z" },
];
const TODAY: Line[] = [
	line(10, 0, "user:telegram", "message-received", "Merge AC0012"),
	line(11, 1, "coordinator", "command spawn", "--kind review Ticket: spec/features/AC0012-shop/ticket.md (exit 0)", { on: [10], project: "acme" }),
	line(12, 1, "coordinator", "job-started", "review on AC0012, machine local", { on: [10], job: J, kind: "review", ticket: "AC0012", project: "acme" }),
	line(13, 2, "coordinator", "command coordinator", "context (exit 0)"),
	line(14, 3, "user:telegram/bot2", "phone-command", "/jobs"),
	line(15, 4, `job:${J}`, "ticket-moved", "in-review -> done", { job: J, kind: "review", ticket: "AC0012" }),
	line(16, 5, "arthur", "job-ended", "ended: finished", { job: J, kind: "review", ticket: "AC0012", project: "acme" }),
	line(17, 6, "user:terminal:alice", "command ticket", "status AC0013 planned (exit 0)", { project: "shop" }),
	line(18, 7, "coordinator", "command steer", `${J2} Fix it (exit 0)`, { on: [9] }),
	line(19, 8, "plugin:schedule", "schedule-fired", "audit: job"),
	line(20, 9, "user:telegram/bot2", "phone-command", "/stopall"),
	line(21, 10, "coordinator", "command coordinator", "stop (exit 0)"),
	line(22, 11, "coordinator", "coordinator-replied", "Done", { on: [10], cut: 450 }),
	line(23, 12, "arthur", "job-state", "working -> blocked: a question", { job: J2, kind: "plan", ticket: "AC0013", project: "acme" }),
	line(24, 13, "user:discord", "message-received", "hi"),
	line(25, 14, "user:terminal:alice", "command log", "--all (exit 0)"),
	line(26, 15, "user:terminal:alice", "command config", "check (exit 0)"),
];
// What `arthur log` prints of each line of TODAY, by its seq.
const SHOWN: Readonly<Record<number, string>> = {
	10: "09:00  user:telegram  message-received  Merge AC0012",
	11: "09:01  coordinator  command spawn  --kind review Ticket: spec/features/AC0012-shop/ticket.md (exit 0)",
	12: "09:01  coordinator  job-started  review on AC0012, machine local",
	13: "09:02  coordinator  command coordinator  context (exit 0)",
	14: "09:03  user:telegram/bot2  phone-command  /jobs",
	15: `09:04  job:${J}  ticket-moved  in-review -> done`,
	16: "09:05  arthur  job-ended  ended: finished",
	17: "09:06  user:terminal:alice  command ticket  status AC0013 planned (exit 0)",
	18: `09:07  coordinator  command steer  ${J2} Fix it (exit 0)`,
	19: "09:08  plugin:schedule  schedule-fired  audit: job",
	20: "09:09  user:telegram/bot2  phone-command  /stopall",
	21: "09:10  coordinator  command coordinator  stop (exit 0)",
	22: "09:11  coordinator  coordinator-replied  Done… (450 chars, event 22)",
	23: "09:12  arthur  job-state  working -> blocked: a question",
	24: "09:13  user:discord  message-received  hi",
	25: "09:14  user:terminal:alice  command log  --all (exit 0)",
	26: "09:15  user:terminal:alice  command config  check (exit 0)",
};
const READ_ONLY = [13, 14, 25, 26];
const shown = (...seqs: number[]) => seqs.map((seq) => SHOWN[seq]).join("\n");
const visible = TODAY.map((each) => each.seq).filter((seq) => !READ_ONLY.includes(seq));
const USAGE = "usage: arthur log [--day YYYY-MM-DD|today|yesterday] [--user <u>] [--actor <a>] [--ticket <id>] [--job <id>] [--project <name>] [--all]";
const PHONE_USAGE = "usage: /log [today|yesterday|<date>] [<ticket id>] [job <id>]";

const day = (fake: FakeHost, date: string, text: string) => {
	mkdirSync(join(fake.host.folder, "days"), { recursive: true });
	writeFileSync(join(fake.host.folder, "days", `${date}.jsonl`), text);
};
const jsonl = (lines: readonly unknown[]) => lines.map((each) => `${JSON.stringify(each)}\n`).join("");

// The plugin with `options` on a fake host at NOW, YESTERDAY and TODAY in its day files unless `empty`; `cli(...args)` runs
// `arthur log` as the CLI does, `project` its `--project`.
async function load(t: TestContext, empty = false, options: ActivityOptions = {}) {
	const fake = fakeHost({ name: "activity", now: NOW, timeZone: "Europe/Warsaw" });
	const plugin = activity(options);
	await fake.setup(plugin);
	if (!empty) {
		day(fake, "2026-11-12", jsonl(YESTERDAY));
		day(fake, "2026-11-13", jsonl(TODAY));
	}
	const command = fake.commands.find((each) => each.name === "log");
	const cli = async (args: readonly string[], project?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	return { fake, plugin, cli, route: fake.host.commands.route };
}
const ok = (out: string) => ({ code: 0, out, err: "" });

test("the default is today in core.timeZone, one line each, the commands that only read hidden; --all shows them", async (t) => {
	const { cli } = await load(t);
	assert.deepEqual(await cli([]), ok(shown(...visible)));
	assert.deepEqual(await cli(["--day", "today"]), ok(shown(...visible)));
	assert.deepEqual(await cli(["--all"]), ok(shown(...TODAY.map((each) => each.seq))));
});

// Every command the doc page names as one that only reads, as a command-ran and as a channel's `/name`; beside each, one that acts.
const ONLY_READ = ["board", "config check", "coordinator context", "decisions", "doctor", "findings", "health", "help", "jobs", "log", "plan", "projects", "resources", "retro-due", "review-needed", "roles", "stats", "task", "usage", "version"];
test("each command that only reads is hidden, run in a shell or sent on a channel; config and coordinator otherwise, and every action, show", async (t) => {
	const { fake, cli } = await load(t, true);
	const acting = ["config", "coordinator stop", "merge", "steer", "stopall", "ticket"];
	const ran = (seq: number, words: string) => line(seq, 0, "coordinator", `command ${words.split(" ")[0]}`, `${words.split(" ").slice(1).join(" ")} AC0012 (exit 0)`.trim());
	const sent = (seq: number, words: string) => line(seq, 0, "user:telegram", "phone-command", `/${words} AC0012`);
	const lines = [...ONLY_READ, ...acting].flatMap((words, index) => [ran(2 * index + 1, words), sent(2 * index + 2, words)]);
	day(fake, "2026-11-13", jsonl(lines));
	const printed = (kept: readonly Line[]) => kept.map((each) => `09:00  ${each.actor}  ${each.what}  ${each.text}`).join("\n");
	assert.deepEqual(await cli([]), ok(printed(lines.slice(2 * ONLY_READ.length))));
	assert.deepEqual(await cli(["--all"]), ok(printed(lines)));
});

test("--day: yesterday and a real date by the day file of that date in core.timeZone; a day with no file says so", async (t) => {
	const { cli } = await load(t);
	const yesterday = ["21:00  user:telegram  message-received  Plan AC0013", "21:01  coordinator  job-started  plan on AC0013, machine local", "23:59  user:telegram  message-received  Steer the plan"].join("\n");
	assert.deepEqual(await cli(["--day", "yesterday"]), ok(yesterday));
	assert.deepEqual(await cli(["--day", "2026-11-12"]), ok(yesterday));
	assert.deepEqual(await cli(["--day", "2026-11-13"]), ok(shown(...visible)));
	assert.deepEqual(await cli(["--day", "2026-11-11"]), ok("no activity to show on 2026-11-11"));
	const fresh = await load(t, true);
	assert.deepEqual(await fresh.cli([]), ok("no activity to show on 2026-11-13"), "no days folder at all");
});

test("--user: his own lines, those on one of his messages, and a job's lines whose job-started was, from an earlier day too", async (t) => {
	const { cli } = await load(t);
	const telegram = shown(10, 11, 12, 15, 16, 18, 20, 22, 23);
	assert.deepEqual(await cli(["--user", "telegram"]), ok(telegram), "18 is on yesterday's message 9, 23 a line of yesterday's job J2");
	assert.deepEqual(await cli(["--user", "user:telegram"]), ok(telegram), "the actor as printed");
	assert.deepEqual(await cli(["--user", "telegram/bot2"]), ok(shown(20)), "one instance: its own lines alone");
	assert.deepEqual(await cli(["--user", "telegram", "--all"]), ok(shown(10, 11, 12, 14, 15, 16, 18, 20, 22, 23)));
	assert.deepEqual(await cli(["--user", "terminal"]), ok(shown(17)));
	assert.deepEqual(await cli(["--user", "terminal:alice", "--all"]), ok(shown(17, 25, 26)));
	assert.deepEqual(await cli(["--user", "discord"]), ok(shown(24)));
	assert.deepEqual(await cli(["--user", "tele"]), ok("no activity to show on 2026-11-13"), "a name's start is no user");
	assert.deepEqual(await cli(["--user", "telegram", "--day", "yesterday"]), ok(["21:00  user:telegram  message-received  Plan AC0013", "21:01  coordinator  job-started  plan on AC0013, machine local", "23:59  user:telegram  message-received  Steer the plan"].join("\n")));
});

test("--actor: that actor and its own, never a name's start", async (t) => {
	const { cli } = await load(t);
	assert.deepEqual(await cli(["--actor", "coordinator"]), ok(shown(11, 12, 18, 21, 22)));
	assert.deepEqual(await cli(["--actor", "job"]), ok(shown(15)));
	assert.deepEqual(await cli(["--actor", `job:${J}`]), ok(shown(15)));
	assert.deepEqual(await cli(["--actor", "user"]), ok(shown(10, 17, 20, 24)));
	assert.deepEqual(await cli(["--actor", "user:telegram"]), ok(shown(10, 20)));
	assert.deepEqual(await cli(["--actor", "plugin:schedule"]), ok(shown(19)));
	assert.deepEqual(await cli(["--actor", "coord"]), ok("no activity to show on 2026-11-13"));
});

test("--ticket, --job by its full or short id, --project; the filters combine", async (t) => {
	const { cli } = await load(t);
	assert.deepEqual(await cli(["--ticket", "AC0012"]), ok(shown(12, 15, 16)));
	assert.deepEqual(await cli(["--ticket", "AC0013"]), ok(shown(23)));
	assert.deepEqual(await cli(["--job", J]), ok(shown(12, 15, 16)));
	assert.deepEqual(await cli(["--job", "0000000b"]), ok(shown(12, 15, 16)));
	assert.deepEqual(await cli(["--job", "000000b"]), ok("no activity to show on 2026-11-13"), "a short id is the whole part after the last dash");
	assert.deepEqual(await cli([], "acme"), ok(shown(11, 12, 16, 23)));
	assert.deepEqual(await cli(["--all"], "shop"), ok(shown(17)));
	assert.deepEqual(await cli(["--user", "telegram", "--ticket", "AC0013"]), ok(shown(23)));
	assert.deepEqual(await cli(["--actor", "coordinator", "--job", J]), ok(shown(12)));
	assert.deepEqual(await cli(["--actor", "arthur"], "shop"), ok("no activity to show on 2026-11-13"));
});

test("wrong usage prints the usage line and exits 2", async (t) => {
	const { cli } = await load(t);
	for (const args of [["today"], ["--day"], ["--day", "tomorrow"], ["--day", "2026-02-30"], ["--day", "2026-13-01"], ["--day", "2026-11-1"], ["--day", "2026-11"], ["--since", "1d"], ["--all=yes"], ["--user"]])
		assert.deepEqual(await cli(args), { code: 2, out: "", err: USAGE }, args.join(" "));
});

test("a line cut by a crash, or edited into one it cannot show, is skipped; the rest still show", async (t) => {
	const { fake, cli } = await load(t, true);
	const good = TODAY[0];
	const bad = [[], "text", 7, null, { ...good, seq: "10" }, { ...good, seq: 1.5 }, { ...good, time: "nope" }, { ...good, time: 0 }, { ...good, actor: 1 }, { ...good, what: null }, { ...good, text: undefined }];
	day(fake, "2026-11-13", `${jsonl(bad)}${jsonl([{ ...good, seq: 30, on: "10", job: 5 }])}${jsonl([good])}{"seq":31,"ti`);
	assert.deepEqual(await cli([]), ok(`${SHOWN[10]}\n${SHOWN[10]}`));
	assert.deepEqual(await cli(["--user", "discord"]), ok("no activity to show on 2026-11-13"), "an on that is no list names no message");
	assert.deepEqual(await cli(["--job", "5"]), ok("no activity to show on 2026-11-13"), "a job that is no string matches no id");
});

test("/log on a channel: today's last 30 lines by default, a day, a ticket, a job, in any order; other words get the usage", async (t) => {
	const { fake, route } = await load(t);
	assert.deepEqual(fake.host.commands.phone(), [{ name: "log", about: "the activity log, the last 30 lines of today by default: /log yesterday, /log AR0012, /log job <id>" }]);
	assert.equal(await route("/log", { channel: "telegram" }), shown(...visible));
	assert.equal(await route("/log yesterday"), ["21:00  user:telegram  message-received  Plan AC0013", "21:01  coordinator  job-started  plan on AC0013, machine local", "23:59  user:telegram  message-received  Steer the plan"].join("\n"));
	assert.equal(await route("/log  2026-11-12  AC0013 "), "21:01  coordinator  job-started  plan on AC0013, machine local");
	assert.equal(await route("/log AC0012"), shown(12, 15, 16));
	assert.equal(await route("/log job 0000000b today"), shown(12, 15, 16));
	assert.equal(await route("/log AC0013 job 0000000b"), "no activity to show on 2026-11-13");
	assert.equal(await route("/log 2026-11-11"), "no activity to show on 2026-11-11");
	for (const text of ["/log job", "/log nope", "/log today yesterday", "/log AC0012 AC0013", "/log ac0012", "/log AC012", "/log --all", "/log 2026-02-30", "/log 2026-11"]) assert.equal(await route(text), PHONE_USAGE, text);
});

test("/log keeps the last 30 lines, a first line saying how many there were; 30 exactly has none", async (t) => {
	const { fake, route } = await load(t, true);
	const many = (count: number) => Array.from({ length: count }, (_, index) => line(index + 1, index, "arthur", "notice", `n${index + 1}`));
	const printed = (lines: readonly Line[]) => lines.map((each) => `09:${String(each.seq - 1).padStart(2, "0")}  arthur  notice  ${each.text}`);
	day(fake, "2026-11-13", jsonl(many(30)));
	assert.equal(await route("/log"), printed(many(30)).join("\n"));
	day(fake, "2026-11-13", jsonl(many(31)));
	assert.equal(await route("/log"), ["the last 30 of 31 lines on 2026-11-13; arthur log shows them all", ...printed(many(31).slice(1))].join("\n"));
});

test("what arthur run wrote reads back: the owner's message and the reply on his word, each cut at textChars", async (t) => {
	const { fake, plugin, cli } = await load(t, true, { textChars: 5 });
	await plugin.start?.();
	const message = fake.emit("message-received", { channel: "telegram", parts: [{ kind: "text", text: "Merge AC0012 now" }] });
	fake.emit("notice", { text: "Restarted." });
	const reply = fake.emit("coordinator-replied", { text: "On it.", answers: [message.seq], channels: ["telegram"] });
	// The bus stamps events with the real time, not the fake's `now`: read back the day they were filed under in core.timeZone.
	const at = (time: string) => fake.host.clock.local(new Date(time));
	const lines = [`${at(message.time).time}  user:telegram  message-received  Merge… (16 chars, event ${message.seq})`, `${at(reply.time).time}  ${reply.by?.actor}  coordinator-replied  On it… (6 chars, event ${reply.seq})`];
	assert.deepEqual(await cli(["--user", "telegram", "--day", at(message.time).date]), ok(lines.join("\n")));
});
