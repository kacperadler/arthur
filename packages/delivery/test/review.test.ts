import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { coreVersion } from "@arthur/core";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";
import { verdictOf } from "../src/review-records.ts";

const PATH = process.env.PATH ?? "";
const FOLDER = "spec/features/AC0001-shop";
const TICKET = `${FOLDER}/ticket.md`;
const OTHER = "spec/features/AC0002-other/ticket.md";
const PROCEDURE = readFileSync(new URL("../roles/coordinator/review-limit.md", import.meta.url), "utf8").trim();

// The repository `acme` (prefix AC): ticket AC0001, labelled os=macos, and AC0002, both planned; delivery set up on the fake
// host with its project list, and with `start` started as `arthur run` starts it, so it hands a FAIL back. `worker()` runs a
// worker on AC0001 and commits a file on its branch, as a worker would; `review(message, ...args)` runs `arthur review` with
// the fake agent playing a reviewer whose final message is `message`.
async function load(t: TestContext, { start = false } = {}) {
	const root = join(temporaryFolder(), "acme");
	for (const [path, json] of [[TICKET, '{ "id": "AC0001", "requires": { "os": "macos" } }'], [OTHER, '{ "id": "AC0002" }']] as const) {
		mkdirSync(join(root, dirname(path)), { recursive: true });
		writeFileSync(join(root, path), `# ${dirname(path)}\n\n\`\`\`json\n${json}\n\`\`\`\n\n## Goal\n\nA change.\n`);
	}
	const entry = (id: string, path: string) => ({ id, title: id, status: "planned", path, updated: "2026-01-01T00:00:00Z" });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([entry("AC0001", TICKET), entry("AC0002", OTHER)]));
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8" }).trim();
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	t.after(() => {
		process.env.PATH = PATH;
	});
	// Put first on `PATH`, before whatever a test put there (a fake ssh).
	const agent = (run: AgentRun) => {
		process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${process.env.PATH}`;
	};
	const fake = fakeHost({ name: "delivery", root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const plugin = delivery();
	await fake.setup(plugin);
	if (start) await plugin.start?.();
	const home = dirname(fake.host.folder);
	const state = (id: string) => (existsSync(join(home, "jobs", id, "state")) ? readFileSync(join(home, "jobs", id, "state"), "utf8") : "");
	const ended = async (id: string) => {
		for (const deadline = Date.now() + 15_000; state(id) !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
		fake.emit("job-ended", { id, state: "ended" });
	};
	const worker = async (task = `Ticket: ${TICKET}`) => {
		agent({ steps: [{ message: "Done.\nTicket: spec/features/AC0002-other/ticket.md was not touched." }] });
		const job = await fake.host.jobs.spawn({ task });
		await ended(job.id);
		writeFileSync(join(job.worktree, `${job.id}.ts`), "export const shop = 1;\n");
		git(job.worktree, "add", `${job.id}.ts`);
		git(job.worktree, "commit", "--quiet", "-m", "shop");
		return { id: job.id, branch: job.branch ?? "", commit: git(root, "rev-parse", job.branch ?? "") };
	};
	const [command] = fake.commands;
	// `arthur review` as the CLI runs it: a throw is `arthur review: <message>` and exit code 1.
	const review = async (message: string, ...args: string[]) => {
		agent({ steps: [{ message }] });
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project: undefined })).catch((error: Error) => (err.push(`arthur review: ${error.message}`), 1));
		t.mock.restoreAll();
		const id = out[0] ?? "";
		if (code === undefined && id !== "") await ended(id);
		return { id, code, err: err.join("\n") };
	};
	const status = (id: string) => fake.host.board.get(id)?.status;
	// A job's record file, and the step of a worker's hand-back (none without one).
	const field = (id: string, name: string) => (existsSync(join(home, "jobs", id, name)) ? readFileSync(join(home, "jobs", id, name), "utf8") : undefined);
	const step = (id: string) => {
		const path = join(fake.host.folder, "hand-backs", `${id}.json`);
		const record: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
		return typeof record === "object" && record !== null && "step" in record ? record.step : undefined;
	};
	return { root, fake, git, worker, review, status, home, state, ended, agent, field, step };
}

async function until(what: string, holds: () => boolean) {
	for (const deadline = Date.now() + 15_000; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

test("the verdict is the last line, exactly PASS or FAIL; anything else is none", () => {
	for (const [message, verdict] of [
		["PASS", "PASS"],
		["Findings: none.\n\nFAIL\n\n", "FAIL"],
		["  PASS  ", "PASS"],
		["PASS\n\nAll good.", "none"],
		["**PASS**", "none"],
		["Verdict: PASS", "none"],
		["PASS.", "none"],
		["", "none"],
	] as const)
		assert.equal(verdictOf(message), verdict, JSON.stringify(message));
});

test("a PASS review runs on the branch's tip with its ticket, moves the ticket to review and then done, and files once", async (t) => {
	const { root, fake, git, worker, review, status, home } = await load(t);
	const job = await worker();
	assert.equal(status("AC0001"), "in-progress");
	const passed = await review("Clean.\n\nPASS", job.id.slice(-8));
	assert.equal(passed.code, undefined, passed.err);
	const task = readFileSync(join(home, "jobs", passed.id, "task"), "utf8");
	assert.equal(task.split("\n\n")[0], `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`);
	assert.match(task, new RegExp(`## The worker's final message \\(job ${job.id}\\)\n\nDone.\nTicket\\\\: spec/features/AC0002`));
	assert.equal(git(readFileSync(join(home, "jobs", passed.id, "worktree"), "utf8"), "rev-parse", "HEAD"), job.commit, "the review's checkout is the tip");
	assert.equal(status("AC0001"), "done");
	assert.deepEqual(
		fake.emitted.filter((event) => event.name === "ticket-moved").map((event) => event.data),
		[{ id: "AC0001", project: "acme", from: "in-progress", to: "review" }, { id: "AC0001", project: "acme", from: "review", to: "done" }],
	);
	assert.equal(fake.collect("coordinator.wake", { id: passed.id, kind: "review", state: "ended" })[0], `Review verdict: PASS on ${job.branch} at ${job.commit.slice(0, 7)}; AC0001 moves to done. File it: arthur ticket file AC0001 ${passed.id}, commit it, then arthur prune ${passed.id}.`);
	writeFileSync(join(root, FOLDER, "review-2.md"), "an older review\n");
	assert.equal(fake.host.jobs.file("AC0001", passed.id), `${FOLDER}/review-3.md`);
	assert.equal(readFileSync(join(root, FOLDER, "review-3.md"), "utf8"), `# AC0001 - Review 3\n\n- Job: ${passed.id}\n- Branch: ${job.branch}\n- Commit reviewed: ${job.commit}\n- Verdict: PASS\n\n## Final message\n\nClean.\n\nPASS`);
	assert.throws(() => fake.host.jobs.file("AC0001", passed.id), { message: `${passed.id} is already filed as ${FOLDER}/review-3.md` });
	assert.deepEqual(readdirSync(join(root, FOLDER)).sort(), ["review-2.md", "review-3.md", "ticket.md"]);
});

test("PASS not on the last line is no verdict: the run ends failed, the ticket stays at review, the wake says so, and it is never filed", async (t) => {
	const { root, fake, worker, review, status, home } = await load(t);
	const job = await worker();
	const none = await review("PASS\n\nThe branch holds.", job.id);
	const reason = "failed: no verdict: the last line of its final message is not PASS or FAIL alone";
	assert.equal(readFileSync(join(home, "jobs", none.id, "reason"), "utf8"), reason, "the core's record says the review failed");
	assert.equal(status("AC0001"), "review");
	assert.match(String(fake.collect("coordinator.wake", { id: none.id, kind: "review" })[0]), new RegExp(`^Review ${none.id}: no verdict, so the review failed: .* Review again with arthur review ${job.id}, then arthur prune ${none.id}\\.$`));
	assert.throws(() => fake.host.jobs.file("AC0001", none.id), { message: `${none.id} ended ended (${reason}), not finished: its result is unfinished and is never filed; prune it` });
	assert.deepEqual(readdirSync(join(root, FOLDER)), ["ticket.md"]);
	assert.deepEqual(fake.collect("coordinator.wake", { id: job.id, kind: "worker" }), [undefined], "a worker's wake gets nothing");
});

test("a FAIL moves the ticket back to in-progress; a third review after 2 FAILs is refused naming both, until --round 3", async (t) => {
	const { root, fake, worker, review, status, home } = await load(t);
	const job = await worker();
	const first = await review("Missing test.\n\nFAIL", job.id);
	assert.equal(status("AC0001"), "in-progress");
	assert.deepEqual(readdirSync(join(root, FOLDER)), ["ticket.md"], "outside arthur run no hand-back: nothing filed");
	const wake = (id: string) => String(fake.collect("coordinator.wake", { id, kind: "review" })[0]);
	const filed = (id: string) => `Delivery files it as the next review-N.md in AC0001's folder; commit that, then arthur prune ${id}.`;
	assert.equal(
		wake(first.id),
		`Review verdict: FAIL on ${job.branch} at ${job.commit.slice(0, 7)}, 1 since its last PASS; AC0001 moves back to in-progress. ${filed(first.id)} It hands the branch back: ${job.id} continues with the findings and a new budget, and the next review starts when it ends; arthur stopall cancels it.`,
	);
	assert.equal((await review("x\nFAIL", job.id, "--round", "3")).err, `arthur review: refused by delivery: round 3 is not the next one of ${job.branch}: it has 1 FAIL since its last PASS, so the next round is 2`);
	const second = await review("Still missing.\n\nFAIL", job.id);
	assert.ok(wake(second.id).endsWith(`2 since its last PASS; AC0001 moves back to in-progress. ${filed(second.id)} The hand-back stops at the limit.\n\n${PROCEDURE}`), "the second FAIL's wake carries the procedure");
	const refused = await review("PASS", job.id);
	assert.equal(refused.code, 1);
	const reason = `refused by delivery: 2 FAILs on ${job.branch} since its last PASS: ${first.id}, ${second.id}; the owner decides what comes next, and only on his word: arthur review ${job.id} --round 3`;
	assert.equal(refused.err, `arthur review: ${reason}\n\n${PROCEDURE}`);
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), { message: reason });
	rmSync(join(home, "jobs", first.id), { recursive: true });
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), { message: reason }, "a FAIL counts once its job record is pruned");
	const third = await review("Fixed.\n\nPASS", job.id, "--round", "3");
	assert.equal(third.code, undefined, third.err);
	assert.equal(status("AC0001"), "done");
	const after = await review("Looked again.\n\nFAIL", job.id);
	assert.equal(after.code, undefined, "a PASS starts the count again");
});

test("a review carries its ticket, so placement reads the ticket's labels and the review goes to the ticket's machine", async (t) => {
	const { fake, root, worker, review } = await load(t);
	const job = await worker();
	const bin = temporaryFolder();
	const log = join(bin, "ssh.log");
	// A fake ssh that notes where it was sent: there is this core's arthur, which holds every commit asked of it, then the
	// worktree's step fails as an unreachable machine does.
	writeFileSync(join(bin, "ssh"), `#!/bin/sh\necho "$@" >> '${log}'\ncase "$*" in *"'version'"*) echo '${coreVersion()}';; *"'repo'"*) echo present;; *) echo 'ssh: no route' >&2; exit 255;; esac\n`, { mode: 0o755 });
	process.env.PATH = `${bin}${delimiter}${process.env.PATH}`;
	fake.host.jobs.registerMachine({ name: "mac", ssh: "mac-mini", home: "/Users/test/.arthur", labels: { os: "macos" } });
	const asked: unknown[] = [];
	// Placement as the machines plugin does it: the `requires` of the ticket a `Ticket:` path names, else local.
	fake.provide("jobs.place", (spawn: { readonly tickets: readonly string[] }) => {
		asked.push(spawn.tickets);
		const [path] = spawn.tickets;
		const json = path === undefined ? "{}" : (/```json\n([\s\S]*?)\n```/.exec(readFileSync(join(root, path), "utf8"))?.[1] ?? "{}");
		return JSON.parse(json).requires?.os === "macos" ? "mac" : "local";
	});
	const placed = await review("PASS", job.id);
	assert.equal(placed.code, 1);
	assert.deepEqual(asked, [[TICKET]]);
	const said = readFileSync(log, "utf8");
	assert.match(said, / mac-mini 'arthur' 'version'\n/);
	assert.match(said, new RegExp(` mac-mini 'arthur' 'remote-job' 'repo' '/Users/test/.arthur' 'acme' '${job.commit}'\n`), "the branch's tip is asked for there, to be pushed when missing");
});

test("refused before any job: not a worker, in a run, no ticket, nothing to review, no head lines, a ticket not started", async (t) => {
	const { fake, root, git, worker, review, home } = await load(t);
	const jobs = () => (existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")).length : 0);
	assert.equal((await review("PASS", "nope")).err, "arthur review: no job nope; arthur jobs lists them");
	assert.equal((await review("PASS")).code, 2);
	assert.match((await review("PASS", "a", "--round", "0")).err, /--round needs a whole number of 1 or more, got 0\nusage: arthur review <worker job> \[--round <n>\]$/);
	const job = await worker();
	const reviewed = await review("PASS", job.id.slice(-8));
	assert.equal((await review("PASS", reviewed.id)).err, `arthur review: ${reviewed.id} is a review job; a review is of a worker's branch`);
	git(root, "merge", "--quiet", job.branch);
	assert.equal((await review("PASS", job.id)).err, `arthur review: ${job.branch} at ${job.commit.slice(0, 7)} adds nothing to HEAD (${job.commit.slice(0, 7)}): nothing to review`);
	const loose = await worker("No ticket here.");
	assert.equal((await review("PASS", loose.id)).err, `arthur review: ${loose.id}'s task names no ticket; a review is of one ticket's branch`);
	const count = jobs();
	const refused = "refused by delivery: a review names its one ticket on a line Ticket: spec/features/<id>-<slug>/ticket.md; its task names";
	await assert.rejects(fake.host.jobs.spawn({ task: "Review it.", kind: "review" }), { message: `${refused} none` });
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nTicket: ${OTHER}`, kind: "review" }), { message: `${refused} ${TICKET}, ${OTHER}` });
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\n\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), {
		message: "refused by delivery: a review names the branch and commit it reviews on lines Branch: arthur/<worker job> and Commit: <sha>, below its Ticket: line; arthur review <worker job> writes them",
	});
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${OTHER}\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), {
		message: "refused by delivery: AC0002 is planned; a review is of a ticket in-progress, review or done",
	});
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${"f".repeat(40)}`, kind: "review" }), {
		message: new RegExp(`^plugin delivery: prepare failed: ${job.branch} at f{40} cannot be checked out on machine local: .+; the job's worktree and record were removed$`),
	});
	assert.equal(jobs(), count, "no record for a refused review");
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "done" }] }))}${delimiter}${PATH}`;
	const running = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}` });
	t.after(() => writeFileSync(gate, ""));
	assert.match((await review("PASS", running.id)).err, new RegExp(`^arthur review: ${running.id} is in a run \\((working|idle)\\); review its branch once the run has ended$`));
	writeFileSync(join(fake.host.folder, "reviews", "broken.json"), "{");
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), {
		message: new RegExp(`^plugin delivery: beforeSpawn failed: ${join(fake.host.folder, "reviews", "broken.json")}: not a review record \\(.+\\); restore it or remove it$`),
	});
});

const reviews = (fake: { readonly host: { readonly jobs: { list(): readonly { readonly id: string; readonly kind: string }[] } } }) =>
	fake.host.jobs.list().filter((each) => each.kind === "review").map((each) => each.id);

test("in arthur run a FAIL is filed, its worker continued with the findings and a new budget, reviewed again at its end; the second FAIL stops at the limit", async (t) => {
	const { root, fake, worker, review, home, ended, field, step } = await load(t, { start: true });
	const job = await worker();
	writeFileSync(join(home, "jobs", job.id, "cost"), "1.25");
	// The reviewer's run plays for the continued worker and the next review too: each ends on FAIL.
	const first = await review("Missing test.\n\nFAIL", job.id);
	await until("the worker continued", () => step(job.id) === "continued");
	assert.match(readFileSync(join(root, FOLDER, "review-1.md"), "utf8"), new RegExp(`^# AC0001 - Review 1\n\n- Job: ${first.id}\n.*- Verdict: FAIL\n`, "s"));
	assert.equal(field(job.id, "continue"), `Review ${first.id} of your branch ${job.branch} says FAIL. Fix every finding below, run the project's checks, commit, and end: Arthur reviews the branch again when you end.\n\n## The review's final message\n\nMissing test.\n\nFAIL`);
	assert.equal(field(job.id, "budget"), "3.25", "its budget of $2 again on top of the $1.25 it spent");
	fake.emit("job-ended", { id: first.id, state: "ended" });
	await until("the continued run's end", () => fake.host.jobs.result(job.id).startsWith("Missing test."));
	await ended(job.id);
	await until("the next review", () => step(job.id) === "reviewing");
	assert.match(String(fake.collect("coordinator.wake", { id: job.id, kind: "worker" })[0]), new RegExp(`^${job.id} is in delivery's hand-back after FAIL ${first.id}: delivery starts the next review of ${job.branch} itself when a slot is free; run no arthur review-needed or arthur review for it\\.$`));
	const [next = ""] = reviews(fake).filter((id) => id !== first.id);
	assert.equal(readFileSync(join(home, "jobs", next, "task"), "utf8").split("\n\n")[0], `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`);
	await ended(next);
	await until("the second FAIL filed and the hand-back ended", () => existsSync(join(root, FOLDER, "review-2.md")) && step(job.id) === undefined);
	assert.equal(reviews(fake).length, 2, "no third review");
	assert.equal(field(job.id, "budget"), "3.25", "not continued again");
	assert.match(String(fake.collect("coordinator.wake", { id: next, kind: "review" })[0]), new RegExp(`2 since its last PASS; .* The hand-back stops at the limit\\.\n\n${PROCEDURE.slice(0, 20)}`));
	assert.equal(fake.collect("coordinator.wake", { id: job.id, kind: "worker" })[0], undefined);
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-message"), [], "the repeated end of the first review did nothing");
});

test("a continue or review refused at maxAgents waits for the next end of a run, then starts", async (t) => {
	const { fake, worker, review, ended, field, step } = await load(t, { start: true });
	const [full, asked] = [new Set<string>(), [] as string[]];
	fake.host.jobs.beforeSpawn((spawn) => (asked.push(spawn.kind), full.has(spawn.kind) ? "maxAgents is 1 and 1 job is in a run: other; spawn again once one ends" : undefined));
	const job = await worker();
	full.add("worker");
	await review("Missing test.\n\nFAIL", job.id);
	await until("the continue refused", () => asked.includes("worker"));
	assert.deepEqual([step(job.id), field(job.id, "continue")], ["continue", undefined]);
	full.clear();
	full.add("review");
	fake.emit("job-ended", { id: "2026-01-01-worker-00000000", state: "ended" });
	await until("the worker continued", () => step(job.id) === "continued");
	await until("the continued run's end", () => fake.host.jobs.result(job.id).startsWith("Missing test."));
	await ended(job.id);
	await until("the review refused", () => asked.filter((kind) => kind === "review").length === 2);
	assert.deepEqual([step(job.id), reviews(fake).length], ["review", 1]);
	full.clear();
	fake.emit("job-ended", { id: "2026-01-01-worker-00000000", state: "ended" });
	await until("the next review", () => step(job.id) === "reviewing");
	assert.equal(reviews(fake).length, 2);
});

test("stop-all cancels the hand-back: between the worker's end and its review, before a FAIL's end is acted on, and while a review starts", async (t) => {
	const { root, fake, worker, review, ended, agent, state, step } = await load(t, { start: true });
	let [refuse, stopIn, refused] = [false, "", 0];
	fake.host.jobs.beforeSpawn((spawn) => {
		// As `arthur stopall` would land while this spawn is under way.
		if (spawn.kind === stopIn) {
			stopIn = "";
			fake.emit("stop-all", { ids: [] });
		}
		if (!refuse || spawn.kind !== "review") return undefined;
		refused++;
		return "maxAgents is 1 and 1 job is in a run: other; spawn again once one ends";
	});
	// Between the worker's end and its review, the review waiting for a slot.
	const one = await worker();
	await review("Missing test.\n\nFAIL", one.id);
	refuse = true;
	await until("the worker continued", () => step(one.id) === "continued");
	await until("the continued run's end", () => fake.host.jobs.result(one.id).startsWith("Missing test."));
	await ended(one.id);
	await until("the review refused", () => refused === 1 && step(one.id) === "review");
	fake.emit("stop-all", { ids: [] });
	assert.equal(step(one.id), undefined);
	refuse = false;
	fake.emit("job-ended", { id: "2026-01-01-worker-00000000", state: "ended" });
	// A FAIL ended just before a stop-all: filed, never handed back. Its handling comes after the end above, so once it filed,
	// that end was acted on too.
	const two = await worker();
	agent({ steps: [{ message: "Wrong file.\n\nFAIL" }] });
	const failed = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${two.branch}\nCommit: ${two.commit}`, kind: "review", fetch: two.commit });
	await until("the review's end", () => state(failed.id) === "ended");
	fake.emit("job-ended", { id: failed.id, state: "ended" });
	fake.emit("stop-all", { ids: [] });
	await until("the FAIL filed", () => readdirSync(join(root, FOLDER)).filter((name) => name.startsWith("review-")).length === 2);
	assert.deepEqual([step(one.id), step(two.id), reviews(fake).length], [undefined, undefined, 2], "no review of the first, no hand-back of the second");
	// A stop-all while the next review starts: the review is stopped.
	const three = await worker();
	await review("Missing test.\n\nFAIL", three.id);
	await until("the worker continued", () => step(three.id) === "continued");
	await until("the continued run's end", () => fake.host.jobs.result(three.id).startsWith("Missing test."));
	stopIn = "review";
	await ended(three.id);
	await until("a fourth review", () => reviews(fake).length === 4);
	const [started = ""] = reviews(fake);
	await until("its run stopped", () => !fake.host.jobs.running().includes(started));
	assert.deepEqual([state(started), fake.host.jobs.list().find((each) => each.id === started)?.reason], ["blocked", "user: arthur stopall cancelled delivery's hand-back"]);
	assert.equal(step(three.id), undefined);
});

test("a hand-back that cannot go on stops and tells the coordinator: the worker's worktree gone", async (t) => {
	const { fake, worker, review, field, step } = await load(t, { start: true });
	const job = await worker();
	rmSync(field(job.id, "worktree") ?? "", { recursive: true });
	const failed = await review("Missing test.\n\nFAIL", job.id);
	await until("the coordinator told", () => fake.emitted.some((event) => event.name === "coordinator-message"));
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-message").map((event) => event.data), [
		{
			text: `Delivery's hand-back of ${job.branch} after FAIL ${failed.id} stopped: ${job.id}: its worktree was pruned; spawn a new job on its branch ${job.branch}. Hand it back yourself: arthur continue ${job.id} '<the findings of ${failed.id}>', then arthur review ${job.id} once it ends.`,
		},
	]);
	assert.equal(step(job.id), undefined);
});
