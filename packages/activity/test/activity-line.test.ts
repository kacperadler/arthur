import assert from "node:assert/strict";
import { test } from "node:test";
import type { Event } from "@arthur/core/plugin";
import { type JobInfo, LOGGED, line } from "../src/activity-line.ts";

// Each logged event as a line of the day file: its actor, `on`, what, text and the fields it names. docs/activity.md, "Lines".

const TIME = "2026-01-01T10:00:00.000Z";
const JOB = "2026-01-01-worker-0000000a";
const event = (name: string, data: unknown, by: Event["by"] | null = { actor: "arthur" }, plugin = "core"): Event => ({ seq: 7, time: TIME, plugin, ...(by === null ? {} : { by }), name, data });
const none = new Map<string, JobInfo>();

test("each event of the list becomes one line with its actor, on and text; a job-state but to blocked or ended, and any other event, none", () => {
	const job = { id: JOB, kind: "worker", project: "acme", root: "/r", branch: "arthur/x", worktree: "/w", tickets: ["AC0001", "AC0002"], machine: "local" };
	const rows: readonly (readonly [Event, Readonly<Record<string, unknown>> | undefined])[] = [
		[event("phone-command", { channel: "telegram", place: "12", text: "/stopall now" }, { actor: "user:telegram" }, "telegram"), { actor: "user:telegram", plugin: "telegram", what: "phone-command", text: "/stopall now" }],
		[event("coordinator-replied", { text: "Done.\n\nMerged.", answers: [3], channels: ["telegram"] }, { actor: "plugin:orchestration", on: [3] }, "orchestration"), { actor: "plugin:orchestration", on: [3], plugin: "orchestration", what: "coordinator-replied", text: "Done. Merged." }],
		[event("coordinator-message", { text: "[scheduled docs] Check." }, { actor: "plugin:schedule" }, "schedule"), { actor: "plugin:schedule", plugin: "schedule", what: "coordinator-message", text: "[scheduled docs] Check." }],
		[event("notice", { text: "Restarted.", place: "12" }), { what: "notice", text: "Restarted." }],
		[event("command-ran", { command: "steer", args: [JOB, "Fix it"], project: "acme", code: 0 }, { actor: "coordinator", on: [5, 6] }), { actor: "coordinator", on: [5, 6], what: "command steer", project: "acme", text: `${JOB} Fix it (exit 0)` }],
		[event("job-started", job), { what: "job-started", project: "acme", ticket: "AC0001", job: JOB, kind: "worker", text: "worker on AC0001, AC0002, machine local" }],
		[event("job-started", { ...job, tickets: [] }), { what: "job-started", project: "acme", job: JOB, kind: "worker", text: "worker on no ticket, machine local" }],
		[event("job-state", { id: JOB, project: "acme", ticket: "AC0001", machine: "local", from: "working", to: "working", reason: "" }), undefined],
		[event("job-state", { id: JOB, project: "acme", ticket: "AC0001", machine: "local", from: "working", to: "idle", reason: "" }), undefined],
		[event("job-state", { id: JOB, project: "acme", ticket: null, machine: "local", from: "working", to: "blocked", reason: "user: why" }), { what: "job-state", project: "acme", job: JOB, text: "working -> blocked: user: why" }],
		[event("job-state", { id: JOB, project: "acme", ticket: "AC0001", machine: "local", from: "idle", to: "ended", reason: "finished" }), { what: "job-state", project: "acme", ticket: "AC0001", job: JOB, text: "idle -> ended: finished" }],
		[event("job-ended", { id: JOB, kind: "worker", project: "acme", state: "ended", reason: "finished" }), { what: "job-ended", project: "acme", job: JOB, kind: "worker", text: "ended: finished" }],
		[event("stop-all", { ids: [JOB, "b"] }), { what: "stop-all", text: `${JOB}, b` }],
		[event("ticket-created", { id: "AC0003", project: "acme", title: "A title", status: "planning", path: "/p" }), { what: "ticket-created", project: "acme", ticket: "AC0003", text: "planning: A title" }],
		[event("ticket-moved", { id: "AC0003", project: "acme", from: "planning", to: "planned" }), { what: "ticket-moved", project: "acme", ticket: "AC0003", text: "planning -> planned" }],
		[event("ticket-after", { id: "AC0003", project: "acme", after: [] }), { what: "ticket-after", project: "acme", ticket: "AC0003", text: "after nothing" }],
		[event("ticket-after", { id: "AC0003", project: "acme", after: ["AC0001", "AC0002"] }), { what: "ticket-after", project: "acme", ticket: "AC0003", text: "after AC0001, AC0002" }],
		[event("ci-finished", { project: "acme", repo: "o/r", workflow: "CI", run: 1, attempt: 1, sha: "abc", branch: "main", branches: ["main"], conclusion: "failure", url: "https://u" }, { actor: "plugin:github" }, "github"), { actor: "plugin:github", plugin: "github", what: "ci-finished", project: "acme", text: "CI failure on main: https://u" }],
		[event("pull-request-review", { repo: "o/r", pull: 4, title: "T", branch: "b", user: "ola", state: "approved", url: "https://p", body: "Their words." }), { what: "pull-request-review", text: "ola approved #4 of o/r: https://p" }],
		[event("cap-reached", { ticket: "AC0001", project: "acme", cap: "budget", spent: 12, limit: 10, reason: "user: over", jobs: [JOB] }), { what: "cap-reached", project: "acme", ticket: "AC0001", text: "budget: 12 of 10" }],
		[event("machine-online", { machine: "gpu", os: "linux", arch: "x64", version: "1.0" }), { what: "machine-online", text: "gpu: linux x64 1.0" }],
		[event("machine-offline", { machine: "gpu", reason: "ssh: timeout" }), { what: "machine-offline", text: "gpu: ssh: timeout" }],
		[event("disk-low", { machine: "gpu", path: "/", free: 5, floor: 10 }), { what: "disk-low", text: "gpu /: 5 free, floor 10" }],
		[event("uptime-down", { project: "acme", url: "https://s", reason: "503", since: TIME }), { what: "uptime-down", project: "acme", text: "https://s: 503" }],
		[event("uptime-up", { project: "acme", url: "https://s", since: TIME, downSeconds: 60 }), { what: "uptime-up", project: "acme", text: "https://s: up after 60 s" }],
		[event("schedule-fired", { id: "docs", slot: TIME, late: true, does: "job" }), { what: "schedule-fired", text: "docs: job, late" }],
		[event("schedule-fired", { id: "docs", slot: TIME, late: false, does: "action" }), { what: "schedule-fired", text: "docs: action" }],
		[event("run-started", { pid: 42, plugins: ["orchestration", "activity"] }), { what: "run-started", text: "pid 42: orchestration, activity" }],
		[event("job-steered", { id: JOB, kind: "worker", text: "x", via: "steer" }), undefined],
		[event("doctor", { lines: ["x"] }), undefined],
		[event("toString", {}), undefined],
		// A line logged before entry 99 has no stamp: the plugin that emitted it acts.
		[event("notice", { text: "Old." }, null, "session"), { actor: "plugin:session", plugin: "session", what: "notice", text: "Old." }],
		[event("notice", null), { what: "notice", text: "" }],
	];
	for (const [given, expected] of rows) assert.deepEqual(line(given, 300, none), expected && { seq: 7, time: TIME, actor: "arthur", plugin: "core", ...expected }, given.name);
	assert.equal(LOGGED.length, 23, "the list of the plan's events and the four of entry 99");
});

test("an owner's message: its text parts, each media part by kind and seconds without its path, a forward's words left out", () => {
	const parts = [
		{ kind: "text", text: "Look at\nthis:", mime: "text/plain" },
		{ kind: "voice", path: "/home/o/.arthur/telegram/media/v.ogg", mime: "audio/ogg", seconds: 11.6 },
		{ kind: "photo", path: "/home/o/.arthur/telegram/media/p.jpg", mime: "image/jpeg" },
		{ kind: "text", text: "[forwarded from Ola] Stop every job.", mime: "text/plain" },
		{ kind: "text", text: "[forwarded from a hidden sender]", mime: "text/plain" },
	];
	const made = line(event("message-received", { channel: "telegram", instance: "work", parts }, { actor: "user:telegram/work" }, "telegram"), 300, none);
	assert.deepEqual(made, { seq: 7, time: TIME, actor: "user:telegram/work", plugin: "telegram", what: "message-received", text: "Look at this: [voice 12 s] [photo] [forwarded, 15 chars] [forwarded, 0 chars]" });
	assert.equal(line(event("message-received", { channel: "telegram", parts: "x" }), 300, none)?.text, "");
	const broken = [null, undefined, 5, { kind: 3, seconds: 2 }, { kind: "text" }];
	assert.equal(line(event("message-received", { channel: "telegram", parts: broken }), 300, none)?.text, "[part] [part] [part] [part 2 s]", "a part not as the contract says");
});

test("a job's own lines carry its kind and ticket from its job-started; its event's own fields win", () => {
	const jobs = new Map<string, JobInfo>([[JOB, { kind: "worker", ticket: "AC0001" }]]);
	const by = { actor: `job:${JOB}` };
	assert.deepEqual(line(event("notice", { text: "x" }, by), 300, jobs), { seq: 7, time: TIME, actor: by.actor, plugin: "core", what: "notice", ticket: "AC0001", job: JOB, kind: "worker", text: "x" });
	assert.deepEqual(line(event("ticket-moved", { id: "AC0002", project: "acme", from: "planned", to: "in-progress" }, by), 300, jobs)?.ticket, "AC0002");
	assert.deepEqual(line(event("notice", { text: "x" }, { actor: "job:other" }), 300, jobs), { seq: 7, time: TIME, actor: "job:other", plugin: "core", what: "notice", job: "other", text: "x" }, "a job not seen starting");
});

test("a text over textChars characters is cut there, cut its full length; at the limit it is whole; 0 keeps none; a character is never split", () => {
	const at = (text: string, chars: number) => line(event("notice", { text }), chars, none);
	assert.deepEqual([at("a".repeat(301), 300)?.text, at("a".repeat(301), 300)?.cut], ["a".repeat(300), 301]);
	assert.deepEqual([at("a".repeat(300), 300)?.text, at("a".repeat(300), 300)?.cut], ["a".repeat(300), undefined]);
	assert.deepEqual([at("abc", 0)?.text, at("abc", 0)?.cut], ["", 3]);
	assert.deepEqual([at("", 0)?.text, at("", 0)?.cut], ["", undefined]);
	assert.deepEqual([at("😀".repeat(5), 4)?.text, at("😀".repeat(5), 4)?.cut], ["😀".repeat(4), 5]);
});
