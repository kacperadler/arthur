import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type SessionOptions, session } from "../src/session.ts";

const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";
const HANDOFF = "Work in progress: AR0144, its worker ended.\nNext: review its branch.\nUnanswered: merge AR0140? (asked at 22:40)";
const ask = (handoff: string, how: string) =>
	`[Arthur] This conversation ends after this turn: the coordinator restarts ${how}. First write your handoff to ${handoff}, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when you asked it. The next conversation starts by reading it. ${ARTHUR}`;
const read = (handoff: string, text: string) => `[Arthur] The coordinator just started again. Before that you wrote this handoff (${handoff}); go on from it:\n\n${text}\n\n${ARTHUR}`;

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// The fake agent appends each line as it goes, so a read can catch the file created but its line not yet written: whole lines only.
const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line)) : []);

// The plugin on a fake host in Warsaw at `now`, started as `arthur run` starts it, its printed lines caught; the test provides
// orchestration's `coordinator.restart`, which notes `fresh` and ends every coordinator started, as killing its session does.
async function load(t: TestContext, options: SessionOptions, now: string) {
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void out.push(text));
	t.mock.method(console, "error", (text: string) => void err.push(text));
	const fake = fakeHost({ name: "session", options: { compactAt: [], ...options }, timeZone: "Europe/Warsaw", now: new Date(now) });
	const plugin = session(options);
	await fake.setup(plugin);
	const [restarts, agents, gates] = [[] as boolean[], [] as ChildProcess[], temporaryFolder()];
	fake.provide("coordinator.restart", (asked: { fresh: boolean }) => {
		restarts.push(asked.fresh);
		for (const child of agents) child.kill();
	});
	t.after(() => {
		plugin.stop?.();
		for (const child of agents) child.kill();
	});
	const { folder } = fake.host;
	const jobs = join(dirname(folder), "jobs");
	return {
		fake,
		out,
		err,
		restarts,
		folder,
		handoff: join(folder, "handoff.md"),
		start: () => plugin.start?.(),
		at: (when: string) => fake.setNow(new Date(when)),
		request: () => (existsSync(join(folder, "request.json")) ? (JSON.parse(readFileSync(join(folder, "request.json"), "utf8")) as Record<string, unknown>) : undefined),
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text),
		route: (text: string) => fake.host.commands.route(text),
		gate: (name: string) => join(gates, name),
		open: (name: string) => writeFileSync(join(gates, name), ""),
		// A job in a run of the kind given, as its record says, until `end`.
		job(id: string, kind = "worker") {
			mkdirSync(join(jobs, id), { recursive: true });
			for (const [key, value] of Object.entries({ kind, project: "acme", task: "Go.", state: "working", since: new Date().toISOString() })) writeFileSync(join(jobs, id, key), value);
			return { end: () => writeFileSync(join(jobs, id, "state"), "ended") };
		},
		// A coordinator: the fake agent playing `run` with the extension the plugin gives orchestration, started with `args`.
		coordinator(run: AgentRun, args: readonly string[] = ["--continue"]) {
			const agent = fakeAgent(run);
			const [extension] = fake.collect<{ file: string; env: Record<string, string> }>("coordinator.extension");
			assert.ok(extension);
			const child = spawn(agent, [...args, "-e", extension.file], { env: { ...process.env, ...extension.env }, stdio: "ignore" });
			agents.push(child);
			const noted = join(folder, "agent");
			return {
				messages: () => lines(join(dirname(agent), "messages.jsonl")),
				up: () => until("the coordinator's start", () => existsSync(noted) && readFileSync(noted, "utf8") === String(child.pid)),
			};
		},
	};
}

test("at freshAt with no job running the coordinator writes its handoff, the conversation starts fresh and reads it first, and Restarted. says (fresh session)", async (t) => {
	const box = await load(t, { freshAt: "23:00" }, "2026-10-18T22:59:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Handoff written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	await sleep(1200);
	assert.equal(box.request(), undefined, "nothing before freshAt");
	box.at("2026-10-18T23:00:00+02:00");
	await until("the handoff request", () => first.messages().length === 1);
	assert.deepEqual(first.messages()[0], { content: ask(box.handoff, "in a fresh conversation"), options: { attribution: "agent" }, step: 0 });
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.restarts, [true]);
	assert.deepEqual(box.out, ["session: fresh: done; the coordinator restarts in a fresh conversation, which starts by reading the handoff"]);
	assert.equal(box.request(), undefined);
	assert.deepEqual(box.notices(), [], "no notice before the next coordinator is up");
	const second = box.coordinator({ steps: [{ prompt: true }, { message: "Going on." }, { end: true }, { waitFor: box.gate("never") }] }, []);
	await second.up();
	await until("the handoff read", () => second.messages().length > 0);
	assert.deepEqual(second.messages(), [{ content: read(box.handoff, HANDOFF), options: { attribution: "agent" }, step: -1 }], "its first turn reads the handoff");
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["Restarted. (fresh session)"]);
	await sleep(1200);
	assert.deepEqual([box.restarts, box.notices().length, box.err], [[true], 1, []], "once");
});

test("while a job of any kind runs the fresh start tries again every freshRetryMinutes, never between tries", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15 }, "2026-10-18T22:59:00+02:00");
	const review = box.job("2026-10-18-review-0000000a", "review");
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await sleep(1200);
	review.end();
	box.at("2026-10-18T23:14:00+02:00");
	await sleep(1200);
	assert.deepEqual([box.restarts, box.request()], [[], undefined], "the review ran at 23:00; the next try is 23:15");
	box.at("2026-10-18T23:15:00+02:00");
	await until("the restart", () => box.restarts.length === 1);
	// No coordinator runs, so no handoff is asked.
	assert.deepEqual(box.out, ["session: fresh: done; the coordinator restarts in a fresh conversation, with no handoff: no coordinator was running"]);
});

test("while a job runs a try asks the coordinator for nothing", async (t) => {
	const box = await load(t, { freshAt: "23:00" }, "2026-10-18T22:59:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "Asked." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	box.job("2026-10-18-audit-0000000a", "audit");
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await sleep(1200);
	assert.deepEqual([first.messages(), box.request(), box.restarts], [[], undefined, []]);
});

test("a job that ends just before freshUntil: the try at freshUntil, off the retry times and after midnight, starts the fresh conversation", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15, freshUntil: "00:10" }, "2026-10-18T22:59:00+02:00");
	const job = box.job("2026-10-18-worker-0000000a");
	await box.start();
	for (const time of ["2026-10-18T23:00", "2026-10-18T23:15", "2026-10-18T23:45", "2026-10-19T00:00"]) {
		box.at(`${time}:00+02:00`);
		await sleep(1200);
	}
	job.end();
	box.at("2026-10-19T00:09:00+02:00");
	await sleep(1200);
	assert.deepEqual(box.restarts, []);
	box.at("2026-10-19T00:10:00+02:00");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.restarts, [true]);
});

test("a job running at freshUntil skips that night with one line; no fresh start outside the window; the next night tries again", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 60, freshUntil: "03:00" }, "2026-10-18T22:59:00+02:00");
	const job = box.job("2026-10-18-worker-0000000a");
	box.job("2026-10-18-plan-0000000b", "plan");
	await box.start();
	for (const time of ["2026-10-18T23:00", "2026-10-19T00:00", "2026-10-19T01:00", "2026-10-19T02:00", "2026-10-19T03:00"]) {
		box.at(`${time}:00+02:00`);
		await sleep(1200);
	}
	assert.deepEqual(box.out, ["session: fresh: skipped, 2 jobs running at 03:00"]);
	box.job("2026-10-18-plan-0000000b", "plan").end();
	job.end();
	for (const time of ["2026-10-19T03:30", "2026-10-19T12:00", "2026-10-19T22:59"]) {
		box.at(`${time}:00+02:00`);
		await sleep(1200);
	}
	assert.deepEqual(box.restarts, [], "outside the window");
	box.at("2026-10-19T23:00:00+02:00");
	await until("the next night's restart", () => box.restarts.length === 1);
});

test("freshUntil equal to freshAt is a single try; earlier than freshAt the window crosses midnight", async (t) => {
	const single = await load(t, { freshAt: "23:00", freshUntil: "23:00" }, "2026-10-18T22:59:00+02:00");
	const job = single.job("2026-10-18-worker-0000000a");
	await single.start();
	single.at("2026-10-18T23:00:00+02:00");
	await until("the skip", () => single.out.length === 1);
	assert.deepEqual(single.out, ["session: fresh: skipped, 1 job running at 23:00"]);
	job.end();
	single.at("2026-10-18T23:15:00+02:00");
	await sleep(1200);
	assert.deepEqual(single.restarts, []);
	const across = await load(t, { freshAt: "23:30", freshRetryMinutes: 30, freshUntil: "00:30" }, "2026-10-18T23:00:00+02:00");
	const late = across.job("2026-10-18-worker-0000000c");
	await across.start();
	across.at("2026-10-18T23:30:00+02:00");
	await sleep(1200);
	late.end();
	across.at("2026-10-19T00:00:00+02:00");
	await until("the restart after midnight", () => across.restarts.length === 1);
});

test("Arthur down at freshAt skips that night, not run late, and a window passed unseen is not tried late", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshUntil: "03:00" }, "2026-10-18T23:30:00+02:00");
	await box.start();
	box.at("2026-10-18T23:45:00+02:00");
	await sleep(1200);
	assert.deepEqual(box.restarts, [], "started inside the window: tonight's freshAt passed");
	// The clock jumps over the next night's window, as after a machine that slept.
	box.at("2026-10-20T04:00:00+02:00");
	await sleep(1200);
	assert.deepEqual([box.restarts, box.out], [[], []]);
	box.at("2026-10-20T23:00:00+02:00");
	await until("the restart", () => box.restarts.length === 1);
});

test("a job started during the wait for the handoff: no restart, the wait goes on, and the next try writes the handoff again", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15 }, "2026-10-18T22:59:00+02:00");
	const run = (gate: string) => [{ prompt: true }, { waitFor: box.gate(gate) }, { message: "Handoff written." }, { end: true }] as const;
	const first = box.coordinator({ steps: [...run("one"), ...run("two"), { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await until("the handoff request", () => first.messages().length === 1);
	const job = box.job("2026-10-18-worker-0000000a");
	writeFileSync(box.handoff, "The first handoff.\n");
	box.open("one");
	await until("the request settled", () => box.request() === undefined);
	await sleep(1200);
	assert.deepEqual([box.restarts, box.out], [[], []], "a job runs: no restart, and no line");
	job.end();
	box.at("2026-10-18T23:15:00+02:00");
	await until("the second handoff request", () => first.messages().length === 2);
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("two");
	await until("the restart", () => box.restarts.length === 1);
});

test("a handoff write that fails withdraws that try with one line; the next try writes it again", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15 }, "2026-10-18T22:59:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "Nothing to write." }, { end: true }, { prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await until("the withdrawn try", () => box.out.length === 1);
	assert.deepEqual(box.out, ["session: fresh: try withdrawn, handoff not written: no new handoff when the coordinator's turn ended; next try at 23:15"]);
	assert.deepEqual(box.restarts, []);
	box.at("2026-10-18T23:15:00+02:00");
	await until("the handoff asked again", () => first.messages().length === 2);
	assert.equal(first.messages()[1]?.content, ask(box.handoff, "in a fresh conversation"));
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the restart", () => box.restarts.length === 1);
});

test("at a start only a handoff newer than the last one read is read, and an empty one never", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const quiet = { steps: [{ waitFor: box.gate("never") }] };
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	writeFileSync(join(box.folder, "handoff-read"), String(statSync(box.handoff).mtimeMs));
	const again = box.coordinator(quiet);
	await again.up();
	await sleep(300);
	assert.deepEqual(again.messages(), [], "the last one read is not read again");
	writeFileSync(box.handoff, " \n\n");
	const empty = box.coordinator(quiet);
	await empty.up();
	await sleep(300);
	assert.deepEqual(empty.messages(), [], "an empty one is not read");
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	const newer = box.coordinator(quiet);
	await newer.up();
	await until("the handoff read", () => newer.messages().length > 0);
	assert.deepEqual(newer.messages().map((message) => message.content), [read(box.handoff, HANDOFF)]);
	// The extension notes it as read just after it sends it.
	await until("the handoff noted as read", () => readFileSync(join(box.folder, "handoff-read"), "utf8") === String(statSync(box.handoff).mtimeMs));
	const next = box.coordinator(quiet);
	await next.up();
	await sleep(300);
	assert.deepEqual(next.messages(), [], "read once");
});

test("/restart with one job running is refused, naming it; usage; nothing is asked and nothing restarts", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	box.coordinator({ steps: [{ waitFor: box.gate("never") }] });
	box.job("2026-10-18-review-0000000a", "review");
	await box.start();
	assert.equal(await box.route("/restart"), "error: 1 job running: 0000000a; run /stopall first");
	assert.equal(await box.route("/restart fresh"), "error: 1 job running: 0000000a; run /stopall first");
	assert.equal(await box.route("/restart now"), "usage: /restart [fresh]");
	const run = box.fake.commands.find((command) => command.name === "restart")?.run;
	assert.equal(await run?.({ args: ["fresh", "now"], project: undefined }), 2);
	assert.equal(await run?.({ args: ["now"], project: undefined }), 2);
	assert.equal(await run?.({ args: [], project: undefined }), 1);
	assert.deepEqual(box.err, ["usage: arthur restart [fresh]", "usage: arthur restart [fresh]", "error: 1 job running: 0000000a; run /stopall first"]);
	await sleep(1200);
	assert.deepEqual([box.request(), box.restarts], [undefined, []]);
});

test("/restart and /restart fresh with no coordinator running ask for no handoff; Restarted. follows once one is up; an empty after-restart.md is not sent", async (t) => {
	for (const [text, fresh, note] of [["", false, "handoff not written"], [" fresh", true, "fresh session; handoff not written"]] as const) {
		const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
		await box.start();
		const next = fresh ? "is a fresh conversation" : "goes on with --continue";
		assert.equal(await box.route(`/restart${text}`), `no coordinator is running, so no handoff is asked; its next start ${next}`);
		assert.deepEqual([box.restarts, box.request()], [[fresh], undefined]);
		writeFileSync(join(box.folder, "after-restart.md"), "  \n");
		await sleep(1200);
		assert.deepEqual(box.notices(), []);
		await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
		await until("the notice", () => box.notices().length === 1);
		assert.deepEqual(box.notices(), [`Restarted. (${note})`]);
	}
});

test("/restart with a coordinator: the handoff first, the restart goes on with --continue, the next one reads it, and Restarted. carries the steps and the health lines", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	box.fake.provide("health", () => ["main not pushed for 2 h", " "]);
	box.fake.provide("health", () => "github: CI token missing");
	box.fake.provide("health", () => undefined);
	box.fake.provide("health", () => {
		throw new Error("no repository\nat line 2");
	});
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	assert.equal(await box.route("/restart"), "restarting: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
	assert.equal(await box.route("/restart fresh"), "error: a restart is already on its way, asked by /restart");
	await until("the handoff request", () => first.messages().length === 1);
	assert.equal(first.messages()[0]?.content, ask(box.handoff, "and goes on with this one"));
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	writeFileSync(join(box.folder, "after-restart.md"), "Log in again: omp login.\n");
	box.open("written");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.restarts, [false]);
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts, which starts by reading the handoff"]);
	const second = box.coordinator({ steps: [{ prompt: true }, { message: "Going on." }, { end: true }, { waitFor: box.gate("never") }] });
	await second.up();
	await until("the handoff read", () => second.messages().length > 0);
	assert.deepEqual(second.messages().map((message) => message.content), [read(box.handoff, HANDOFF)], "the handoff, and never the command's message");
	await until("the notice", () => box.notices().length === 1);
	const health = "Health:\n- main not pushed for 2 h\n- github: CI token missing\n- test: health failed: no repository";
	assert.deepEqual(box.notices(), [`Restarted.\n\nAfter the restart:\nLog in again: omp login.\n\n${health}`]);
	assert.equal(existsSync(join(box.folder, "after-restart.md")), false, "the steps go once");
	assert.ok(!box.fake.emitted.some((event) => JSON.stringify(event.data).includes("/restart")), "the command reaches no inbox");
});

test("a handoff not written in time does not stop the restart, and Restarted. says so", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "", stopReason: "error", error: "529 overloaded" }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	assert.equal(await box.route("/restart fresh"), "restarting in a fresh conversation: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts in a fresh conversation, with no handoff (handoff not written: no new handoff when the coordinator's turn ended (529 overloaded))"]);
	await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }, []).up();
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["Restarted. (fresh session; handoff not written)"]);
	// A request an agent took 120 s ago and did not finish, its agent still there (this test's own process).
	writeFileSync(join(box.folder, "request.json"), JSON.stringify({ then: "restart", slot: "/restart", asked: Date.now() - 120_000, waitSeconds: 120, pid: process.pid }));
	await until("the second restart", () => box.restarts.length === 2);
	assert.equal(box.out[1], "session: restart: done; the coordinator restarts, with no handoff (handoff not written within 120 s)");
});

test("a job started while /restart waits for the handoff stops the restart, with a notice", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	await box.route("/restart");
	await until("the handoff request", () => first.messages().length === 1);
	box.job("2026-10-18-worker-0000000b");
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["restart: not done, 1 job running: 0000000b; run /stopall first"]);
	assert.deepEqual([box.restarts, box.request(), box.out], [[], undefined, []]);
});

test("a compaction still asked for gives way to /restart", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 600 }, "2026-10-18T12:59:00+02:00");
	const busy = join(temporaryFolder(), "busy.ts");
	writeFileSync(busy, `export default (pi) => pi.on("session_start", () => pi.sendUserMessage("Busy."));\n`);
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("idle") }, { message: "Done." }, { end: true }, { prompt: true }, { message: "No handoff." }, { end: true }, { waitFor: box.gate("never") }] }, ["-e", busy]);
	await first.up();
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the compaction taken", () => box.request()?.then === "compact" && typeof box.request()?.pid === "number");
	assert.equal(await box.route("/restart"), "restarting: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
	box.open("idle");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(first.messages().map((message) => message.content), ["Busy.", ask(box.handoff, "and goes on with this one")], "the compaction's handoff is never asked");
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts, with no handoff (handoff not written: no new handoff when the coordinator's turn ended)"]);
});

test("a restart's mark that is not one is dropped, named", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	writeFileSync(join(box.folder, "restarted.json"), "{ torn");
	await box.start();
	await until("the mark dropped", () => !existsSync(join(box.folder, "restarted.json")));
	assert.deepEqual(box.err, [`session: ${join(box.folder, "restarted.json")} is not a restart's mark, so it is dropped: { torn`]);
});
