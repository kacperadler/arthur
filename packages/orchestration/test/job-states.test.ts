import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { blockedNotice } from "../src/blocked-notice.ts";
import { orchestration } from "../src/orchestration.ts";

// Job state in the coordinator and the channels (spec/roadmap.md, entry 27): the jobs section of the context, the wake of a
// run that ended blocked, the notice of a job blocked on the owner, and the footer's counts.

const PATH = process.env.PATH ?? "";
const ID = "2026-10-18-worker-0000abcd";

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// A Git repository with one commit.
function repository(): string {
	const root = temporaryFolder();
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: root });
	git("init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "# demo\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	return root;
}

// The plugin, set up only (no coordinator), on a fake host in Warsaw with quiet hours across midnight, at `now`, with the
// projects `demo` (the main one, holding the jobs' repository) and `shop`.
// `env`, the env file's values: the host's `secrets`.
async function setup(t: TestContext, now = "2026-10-18T10:00:00Z", env: Record<string, string> = {}) {
	const [demo, shop] = [repository(), repository()];
	const fake = fakeHost({ name: "orchestration", root: demo, timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: new Date(now), env });
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	await fake.setup(orchestration());
	t.after(() => void (process.env.PATH = PATH));
	const home = dirname(fake.host.folder);
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	return {
		fake,
		home,
		// The jobs section of what `arthur coordinator context` prints; undefined when there is none.
		async jobs() {
			printed.length = 0;
			assert.equal(await fake.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined }), 0);
			const text = printed.join("\n");
			assert.match(text, /\n\n## Time\n\n/);
			return text.split("\n\n## Jobs not ended\n\n")[1]?.split(/\n\n## (?:Open decisions|Time)\n\n/)[0];
		},
		// Their text; the first test below asserts the whole notice.
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => ({ text: (event.data as { text: string }).text })),
		footer: () => readFileSync(join(fake.host.folder, "footer"), "utf8"),
		// A record as the spawn and the wrapper leave it, spawned `age` minutes after the first, in its state since `since`.
		record(id: string, age: number, keys: Readonly<Record<string, string>>) {
			const folder = join(home, "jobs", id);
			mkdirSync(folder, { recursive: true });
			for (const [key, value] of Object.entries({ kind: "worker", project: "demo", task: "Go.", ...keys })) writeFileSync(join(folder, key), value);
			const born = new Date(Date.UTC(2026, 9, 18, 0, age));
			utimesSync(join(folder, "kind"), born, born);
		},
		blocked: (id: string, question: string) => fake.emit("job-state", { id, project: "demo", ticket: null, machine: "local", from: "working", to: "blocked", reason: `user: ${question}` }),
	};
}

test("the context lists every job not ended, blocked first, each with its reason and for how long; another project's is named", async (t) => {
	const { jobs, record } = await setup(t);
	record("2026-10-18-worker-0000000a", 1, { state: "working", since: "2026-10-18T09:55:00Z" });
	record("2026-10-18-worker-0000000b", 2, { state: "ended", reason: "finished", since: "2026-10-18T09:00:00Z" });
	record("2026-10-18-worker-0000000c", 3, { state: "idle", since: "2026-10-18T08:30:00Z", project: "shop" });
	record("2026-10-18-worker-0000000d", 4, { state: "blocked", reason: "user: may I drop the table?", since: "2026-10-17T07:59:30Z" });
	record("2026-10-18-worker-0000000e", 5, { state: "blocked", reason: "dependency: machine mac unreachable", hold: "machine mac unreachable", since: "2026-10-18T10:00:00Z" });
	record("2026-10-18-worker-0000000f", 6, { state: "paused", since: "not a time" });
	record("2026-10-18-worker-00000010", 7, { state: "working", since: "2026-10-18T10:05:00Z" });
	assert.equal(
		await jobs(),
		[
			"blocked:",
			"- 2026-10-18-worker-0000000e, for 0h00m: dependency: machine mac unreachable",
			"- 2026-10-18-worker-0000000d, for 26h00m: user: may I drop the table?",
			"working:",
			"- 2026-10-18-worker-00000010, for 0h00m",
			"- 2026-10-18-worker-0000000a, for 0h05m",
			"idle:",
			"- 2026-10-18-worker-0000000c, project shop, for 1h30m",
			"paused:",
			"- 2026-10-18-worker-0000000f, since an unknown time",
		].join("\n"),
	);
});

test("no job that has not ended means no jobs section", async (t) => {
	const { jobs, record } = await setup(t);
	assert.equal(await jobs(), undefined, "no job at all");
	record("2026-10-18-worker-0000000b", 1, { state: "ended", reason: "finished", since: "2026-10-18T09:00:00Z" });
	assert.equal(await jobs(), undefined, "only an ended job");
});

test("a run that ends blocked on the owner: one notice with its question, the wake names it, the context shows it; continued, it shows as working", async (t) => {
	const { fake, home, jobs, notices, footer } = await setup(t, new Date().toISOString());
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "Blocked: user May I drop the old orders table?\nIt holds three years of orders." }] }))}${delimiter}${PATH}`;
	const job = await fake.host.jobs.spawn({ task: "Clean the database." });
	const logged = () => fake.host.events.read(1).filter(({ name, data }) => ["job-state", "job-ended"].includes(name) && typeof data === "object" && data !== null && "id" in data && data.id === job.id);
	await until("the run's end", () => logged().some((event) => event.name === "job-ended"));
	// As `arthur run` delivers what the job's wrapper logged.
	const delivered = logged().map((event) => fake.emit(event.name, event.data));
	const question = "May I drop the old orders table?";
	assert.deepEqual(notices(), [{ text: `${job.id} asks [DM-D1]: ${question}` }], "asked in the decision log first");
	assert.deepEqual(fake.emitted.find((event) => event.name === "notice")?.data, { text: `${job.id} asks [DM-D1]: ${question}`, blocked: job.id }, "marked as the notice silent mode lets through");
	const ended = delivered.find((event) => event.name === "job-ended");
	const wake = JSON.parse(readFileSync(join(fake.host.folder, "inbox", "queued", `${ended?.seq}-${Date.parse(ended?.time ?? "")}`), "utf8")) as { text: string };
	assert.deepEqual(wake.text.split("\n").slice(0, 3), [`Job ${job.id} ended its run blocked on the owner; its question, also sent as a notice: ${question}`, "Its final message:", `Blocked: user ${question}`]);
	assert.match(wake.text, new RegExp(`\nIts question is decision DM-D1: record the owner's answer first, arthur decision answer DM-D1 .*, then arthur continue ${job.id} '<his answer>'\.$`));
	assert.match((await jobs()) ?? "", new RegExp(`^blocked:\\n- ${job.id}, for 0h0\\dm: user: ${question.replace("?", "\\?")}$`));
	assert.equal(footer(), "", "a run that ended blocked is not in a run");
	assert.deepEqual(notices().length, 1, "a turn's context emits no notice");

	// `arthur continue` before the next turn: the record's reason, since, then state, as its move writes them.
	for (const [name, text] of [["reason", ""], ["since", new Date().toISOString()], ["state", "working"]] as const) writeFileSync(join(home, "jobs", job.id, name), text);
	assert.match((await jobs()) ?? "", new RegExp(`^working:\\n- ${job.id}, for 0h0\\dm$`));
	assert.deepEqual(notices().length, 1);
});

test("a blocked question reaches the phone and the wake redacted; the final message's other lines lose only the env file's values", async (t) => {
	const { fake, notices } = await setup(t, new Date().toISOString(), { ARTHUR_ORCHESTRATION_PASS: "correct-horse-battery" });
	// What the coordinator reads to act on: a job id, a ticket folder and a full commit hash, none of them a secret.
	const kept = "Blocked by 2026-10-23-ar0319-security-check-93862bb2 on spec/features/AR0341-a-blocked-job-s-question/ticket.md at 0123456789abcdef0123456789abcdef01234567";
	const message = `Blocked: user the key is sk-live-4f9a8b7c6d5e4f3a2b1c with correct-horse-battery?\n${kept}; the env file holds correct-horse-battery.`;
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message }] }))}${delimiter}${PATH}`;
	const job = await fake.host.jobs.spawn({ task: "Rotate the key." });
	const logged = () => fake.host.events.read(1).filter(({ name, data }) => ["job-state", "job-ended"].includes(name) && typeof data === "object" && data !== null && "id" in data && data.id === job.id);
	await until("the run's end", () => logged().some((event) => event.name === "job-ended"));
	const ended = logged().map((event) => fake.emit(event.name, event.data)).find((event) => event.name === "job-ended");
	assert.deepEqual(notices(), [{ text: `${job.id} asks [DM-D1]: the key is [redacted] with [redacted]?` }]);
	const wake = JSON.parse(readFileSync(join(fake.host.folder, "inbox", "queued", `${ended?.seq}-${Date.parse(ended?.time ?? "")}`), "utf8")) as { text: string };
	assert.deepEqual(wake.text.split("\n").slice(0, 4), [
		`Job ${job.id} ended its run blocked on the owner; its question, also sent as a notice: the key is [redacted] with [redacted]?`,
		"Its final message:",
		"Blocked: user the key is [redacted] with [redacted]?",
		`${kept}; the env file holds [redacted].`,
	]);
	assert.match(wake.text, /\nIts question is decision DM-D1: /, "the wake still finds the question in the log");
	assert.doesNotMatch(wake.text, /sk-live|correct-horse/);
});

test("a Blocked: on reason and the lines plugins add to the wake lose the env file's values; their job ids stay readable", async (t) => {
	const { fake } = await setup(t, new Date().toISOString(), { ARTHUR_ORCHESTRATION_PASS: "correct-horse-battery" });
	// As projects' onboarding: a procedure naming the job, then the questions it reads from the final message.
	fake.provide("coordinator.wake", (job: { id: string }, final: string) => `Procedure: arthur continue ${job.id} '<his answer>'.\n\nIts questions to send the owner:\n${final.split("## Questions\n")[1]}`);
	const other = "2026-10-23-ar0319-security-check-93862bb2";
	const message = `Blocked: on ${other} with correct-horse-battery\n\n## Questions\n1. Is correct-horse-battery the staging password?`;
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message }] }))}${delimiter}${PATH}`;
	const job = await fake.host.jobs.spawn({ task: "Onboard." });
	const logged = () => fake.host.events.read(1).filter(({ name, data }) => ["job-state", "job-ended"].includes(name) && typeof data === "object" && data !== null && "id" in data && data.id === job.id);
	await until("the run's end", () => logged().some((event) => event.name === "job-ended"));
	const ended = logged().map((event) => fake.emit(event.name, event.data)).find((event) => event.name === "job-ended");
	const queued: { text: string } = JSON.parse(readFileSync(join(fake.host.folder, "inbox", "queued", `${ended?.seq}-${Date.parse(ended?.time ?? "")}`), "utf8"));
	assert.equal(
		queued.text,
		[
			`Job ${job.id} ended its run: blocked (dependency: ${other} with [redacted]).`,
			"Its final message:",
			`Blocked: on ${other} with [redacted]`,
			"",
			"## Questions",
			"1. Is [redacted] the staging password?",
			`Procedure: arthur continue ${job.id} '<his answer>'.`,
			"",
			"Its questions to send the owner:",
			"1. Is [redacted] the staging password?",
		].join("\n"),
	);
});

test("one notice per block: a second process given the same event sends none; the job's next block is a new notice; a dependency is none", async (t) => {
	const { fake, notices, blocked } = await setup(t);
	// A second process that loads the plugin gets the same event, as does `arthur run` again after a crash.
	blockedNotice(fake.host);
	blocked(ID, "may I?");
	assert.deepEqual(notices(), [{ text: `${ID} asks [DM-D1]: may I?` }]);
	fake.emit("job-state", { id: ID, project: "demo", ticket: null, machine: "local", from: "blocked", to: "working", reason: "" });
	fake.emit("job-state", { id: ID, project: "demo", ticket: null, machine: "local", from: "working", to: "blocked", reason: "dependency: machine mac unreachable" });
	fake.emit("job-ended", { id: ID, kind: "worker", project: "demo", state: "blocked", reason: "dependency: AR0012" });
	assert.equal(notices().length, 1);
	blocked(ID, "and now?");
	assert.deepEqual(notices(), [{ text: `${ID} asks [DM-D1]: may I?` }, { text: `${ID} asks [DM-D2]: and now?` }]);
	// Only a crash's notice takes the job's open question of the same words; a new block asks its own.
	blocked(ID, "and now?");
	assert.deepEqual(notices().at(-1), { text: `${ID} asks [DM-D3]: and now?` });
});

test("the marks of noticed events older than 7 days go at the next block, newer ones stay", async (t) => {
	const { fake, notices, blocked } = await setup(t);
	const asked = join(fake.host.folder, "asked");
	mkdirSync(asked);
	for (const [name, days] of [["900001-0", 8], ["900002-0", 6]] as const) {
		writeFileSync(join(asked, name), "");
		const at = new Date(Date.now() - days * 24 * 3_600_000);
		utimesSync(join(asked, name), at, at);
	}
	const event = blocked(ID, "may I?");
	assert.deepEqual(notices(), [{ text: `${ID} asks [DM-D1]: may I?` }]);
	const mark = `${event.seq}-${Date.parse(event.time)}`;
	assert.deepEqual(readdirSync(asked).sort(), ["900002-0", mark, `${mark}.sent`].sort());
});

test("a crash before the notice, its question waiting for the log's lock: the next start sends it once, with the question asked before, else asking it", async (t) => {
	const { fake, home, notices } = await setup(t, undefined, { ARTHUR_ORCHESTRATION_PASS: "correct-horse-battery" });
	const asked = join(fake.host.folder, "asked");
	mkdirSync(asked);
	const dead = String(spawnSync(process.execPath, ["-e", ""]).pid);
	const live = spawn("sleep", ["60"]);
	t.after(() => live.kill());
	// A job-state the crashed process got, as the event log holds it, and what it left: its lock of `holder`, its mark unless
	// `before`, `.sent` if it got so far; `gone`, the mark of an event before the event log was cut, which another event of its
	// number (`time`) or time (`seq`) took the place of.
	const crashed = (id: string, question: string, holder: string, left: { readonly before?: true; readonly sent?: true; readonly gone?: "time" | "seq" } = {}) => {
		const seq = (fake.host.events.read(1).at(-1)?.seq ?? 0) + 1;
		const time = new Date().toISOString();
		const data = { id, project: "demo", ticket: null, machine: "local", from: "working", to: "blocked", reason: `user: ${question}` };
		appendFileSync(join(home, "events.jsonl"), `${JSON.stringify({ seq: seq + (left.gone === "seq" ? 1 : 0), time, plugin: "core", name: "job-state", data })}\n`);
		const mark = join(asked, `${seq}-${Date.parse(time) - (left.gone === "time" ? 1 : 0)}`);
		writeFileSync(`${mark}.lock`, holder);
		if (!left.before) writeFileSync(mark, "");
		if (left.sent) writeFileSync(`${mark}.sent`, "");
	};
	const demo = fake.host.board.projects().find((each) => each.name === "demo")?.path ?? "";
	const asks = () => readFileSync(join(demo, "spec/decisions.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line)).filter((each) => each.record === "ask");
	const decision = (...args: string[]) => fake.commands.find((command) => command.name === "decision")?.run({ args, project: "demo" });
	const [a, b, c, d, e, f, g] = [..."abcdefg"].map((last) => `2026-10-18-worker-0000000${last}`) as [string, string, string, string, string, string, string];
	// None of these is a's question of this block: another kind, other words, answered.
	await decision("ask", "--kind", "question", "--question", "May I drop it?", "--job", a);
	await decision("ask", "--kind", "job", "--question", "May I drop the rest?", "--job", a);
	await decision("ask", "--kind", "job", "--question", "May I drop it?", "--job", a);
	await decision("answer", "DM-D3", "--decided", "Drop it", "yes");
	// b asked before its crash; the log holds its question trimmed and redacted, a value of the env file too.
	const rename = "May I rename it to sk-live-4f9a8b7c with correct-horse-battery? ";
	await decision("ask", "--kind", "job", "--question", rename, "--job", b);
	assert.deepEqual(asks().map((each) => each.question).at(-1), "May I rename it to [redacted] with [redacted]?");
	crashed(a, "May I drop it?", dead);
	crashed(b, rename, dead);
	crashed(c, rename, String(live.pid));
	crashed(d, "May I move it?", dead, { before: true });
	// Its notice went, its lock not yet released; events the log no longer holds.
	crashed(e, "May I keep it?", dead, { sent: true });
	crashed(f, "May I copy it?", dead, { gone: "time" });
	crashed(g, "May I paste it?", dead, { gone: "seq" });
	// `arthur run` started again, after the replay.
	const start = blockedNotice(fake.host);
	start();
	const idOf = (job: string) => asks().findLast((each) => each.job === job)?.id;
	assert.deepEqual(asks().slice(4).map((each) => [each.kind, each.job, each.question]).toSorted(), [["job", a, "May I drop it?"], ["job", d, "May I move it?"]], "b's question not asked again");
	const said = "May I rename it to [redacted] with [redacted]? ";
	const sent = [`${a} asks [${idOf(a)}]: May I drop it?`, `${b} asks [DM-D4]: ${said}`, `${d} asks [${idOf(d)}]: May I move it?`];
	assert.deepEqual(notices().map((each) => each.text).toSorted(), sent);
	start();
	assert.equal(notices().length, 3, "one notice per block");
	live.kill();
	await once(live, "exit");
	start();
	assert.deepEqual(notices().slice(3), [{ text: `${c} asks [${idOf(c)}]: ${said}` }], "c's holder alive, then dead");
	assert.deepEqual([idOf(c), asks().length], ["DM-D7", 7], "b's question is not c's");
	assert.equal(readdirSync(asked).filter((name) => name.endsWith(".lock")).length, 2, "only f's and g's locks are left, their events gone");
});

test("after the event log is cut by hand, a block with a number noticed before is still a notice", async (t) => {
	const { home, notices, blocked } = await setup(t);
	const first = blocked(ID, "may I?");
	assert.deepEqual(notices(), [{ text: `${ID} asks [DM-D1]: may I?` }]);
	rmSync(join(home, "events.jsonl"));
	await sleep(5);
	const again = blocked(ID, "and now?");
	assert.equal(again.seq, first.seq, "the numbers start again");
	assert.deepEqual(notices(), [{ text: `${ID} asks [DM-D2]: and now?` }], "the cut log holds only what came after; the decision log, in the project, is not cut");
});

test("a question longer than one message is cut to 4096 characters with the job id to read it whole; 4096 exactly is sent whole", async (t) => {
	const { notices, blocked } = await setup(t);
	// Each block asks again: DM-D1 to DM-D3, heads of one length.
	const head = (n: number) => `${ID} asks [DM-D${n}]: `;
	const whole = "q".repeat(4096 - head(1).length);
	blocked(ID, whole);
	blocked(ID, `${whole}!`);
	const tail = " … (cut; /jobs shows the whole question of job 0000abcd)";
	// A character of two UTF-16 units across the cut is left out whole.
	blocked(ID, `${"q".repeat(4096 - head(3).length - tail.length - 1)}😀${"q".repeat(100)}`);
	const cut = `${head(2)}${whole.slice(0, 4096 - head(2).length - tail.length)}${tail}`;
	assert.equal(cut.length, 4096);
	assert.deepEqual(notices(), [{ text: `${head(1)}${whole}` }, { text: cut }, { text: `${head(3)}${"q".repeat(4096 - head(3).length - tail.length - 1)}${tail}` }]);
});

test("in quiet hours the notice goes at once as any other, and the channel sends it without a notification", async (t) => {
	const { fake, notices, blocked } = await setup(t, "2026-10-18T21:30:00Z");
	assert.equal(fake.host.clock.isQuiet(), true, "23:30 in Warsaw is within the quiet hours");
	blocked(ID, "may I?");
	assert.deepEqual(notices(), [{ text: `${ID} asks [DM-D1]: may I?` }]);
});

test("the footer counts the jobs in a run by state, blocked first, with their short ids; none in a run is empty", async (t) => {
	const { fake, record, footer } = await setup(t);
	const changed = () => fake.emit("job-state", { id: ID, project: "demo", ticket: null, machine: "local", from: "working", to: "idle", reason: "" });
	record("2026-10-18-worker-0000000b", 1, { state: "ended", reason: "finished" });
	record("2026-10-18-worker-0000000d", 2, { state: "blocked", reason: "user: may I?" });
	changed();
	assert.equal(footer(), "");
	record("2026-10-18-worker-0000000a", 3, { state: "working" });
	record("2026-10-18-worker-0000000c", 4, { state: "idle" });
	record("2026-10-18-worker-0000000e", 5, { state: "blocked", reason: "dependency: cap reached", hold: "cap reached" });
	record("2026-10-18-worker-0000000f", 6, { state: "working" });
	changed();
	assert.equal(footer(), "arthur · 1 blocked, 2 working, 1 idle: 0000000e, 0000000f, 0000000a, 0000000c");
	assert.equal(existsSync(join(fake.host.folder, "footer.new")), false);
});
