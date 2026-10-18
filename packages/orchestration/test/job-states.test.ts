import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
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
async function setup(t: TestContext, now = "2026-10-18T10:00:00Z") {
	const [demo, shop] = [repository(), repository()];
	const fake = fakeHost({ name: "orchestration", root: demo, timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: new Date(now) });
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
			return text.split("\n\n## Jobs not ended\n\n")[1]?.split("\n\n## Time\n\n")[0];
		},
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => event.data),
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
	assert.deepEqual(notices(), [{ text: `${job.id} asks: ${question}` }]);
	const ended = delivered.find((event) => event.name === "job-ended");
	const wake = JSON.parse(readFileSync(join(fake.host.folder, "inbox", "queued", String(ended?.seq)), "utf8")) as { text: string };
	assert.deepEqual(wake.text.split("\n").slice(0, 3), [`Job ${job.id} ended its run blocked on the owner; its question, also sent as a notice: ${question}`, "Its final message:", `Blocked: user ${question}`]);
	assert.match((await jobs()) ?? "", new RegExp(`^blocked:\\n- ${job.id}, for 0h0\\dm: user: ${question.replace("?", "\\?")}$`));
	assert.equal(footer(), "", "a run that ended blocked is not in a run");
	assert.deepEqual(notices().length, 1, "a turn's context emits no notice");

	// `arthur continue` before the next turn: the record's reason, since, then state, as its move writes them.
	for (const [name, text] of [["reason", ""], ["since", new Date().toISOString()], ["state", "working"]] as const) writeFileSync(join(home, "jobs", job.id, name), text);
	assert.match((await jobs()) ?? "", new RegExp(`^working:\\n- ${job.id}, for 0h0\\dm$`));
	assert.deepEqual(notices().length, 1);
});

test("one notice per block: a second process given the same event sends none; the job's next block is a new notice; a dependency is none", async (t) => {
	const { fake, notices, blocked } = await setup(t);
	// A second process that loads the plugin gets the same event, as does `arthur run` again after a crash.
	blockedNotice(fake.host);
	blocked(ID, "may I?");
	assert.deepEqual(notices(), [{ text: `${ID} asks: may I?` }]);
	fake.emit("job-state", { id: ID, project: "demo", ticket: null, machine: "local", from: "blocked", to: "working", reason: "" });
	fake.emit("job-state", { id: ID, project: "demo", ticket: null, machine: "local", from: "working", to: "blocked", reason: "dependency: machine mac unreachable" });
	fake.emit("job-ended", { id: ID, kind: "worker", project: "demo", state: "blocked", reason: "dependency: AR0012" });
	assert.equal(notices().length, 1);
	blocked(ID, "and now?");
	assert.deepEqual(notices(), [{ text: `${ID} asks: may I?` }, { text: `${ID} asks: and now?` }]);
});

test("the marks of noticed events older than 7 days go at the next block, newer ones stay", async (t) => {
	const { fake, blocked } = await setup(t);
	const asked = join(fake.host.folder, "asked");
	mkdirSync(asked);
	for (const [name, days] of [["1", 8], ["2", 6]] as const) {
		writeFileSync(join(asked, name), "");
		const at = new Date(Date.now() - days * 24 * 3_600_000);
		utimesSync(join(asked, name), at, at);
	}
	const seq = blocked(ID, "may I?").seq;
	assert.deepEqual(readdirSync(asked).sort(), ["2", String(seq)].sort());
});

test("a question longer than one message is cut to 4096 characters with the job id to read it whole; 4096 exactly is sent whole", async (t) => {
	const { notices, blocked } = await setup(t);
	const head = `${ID} asks: `;
	const whole = "q".repeat(4096 - head.length);
	blocked(ID, whole);
	blocked(ID, `${whole}!`);
	const tail = " … (cut; /jobs shows the whole question of job 0000abcd)";
	// A character of two UTF-16 units across the cut is left out whole.
	blocked(ID, `${"q".repeat(4096 - head.length - tail.length - 1)}😀${"q".repeat(100)}`);
	const cut = `${head}${whole.slice(0, 4096 - head.length - tail.length)}${tail}`;
	assert.equal(cut.length, 4096);
	assert.deepEqual(notices(), [{ text: `${head}${whole}` }, { text: cut }, { text: `${head}${"q".repeat(4096 - head.length - tail.length - 1)}${tail}` }]);
});

test("in quiet hours the notice goes at once as any other, and the channel sends it without a notification", async (t) => {
	const { fake, notices, blocked } = await setup(t, "2026-10-18T21:30:00Z");
	assert.equal(fake.host.clock.isQuiet(), true, "23:30 in Warsaw is within the quiet hours");
	blocked(ID, "may I?");
	assert.deepEqual(notices(), [{ text: `${ID} asks: may I?` }]);
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
