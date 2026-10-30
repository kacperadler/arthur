import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import { coreVersion } from "@arthur/core";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { startWait } from "../src/ci-wait.ts";
import { delivery } from "../src/delivery.ts";
import { handBack } from "../src/hand-back.ts";
import { reviewTask, worker as workerOf } from "../src/review-command.ts";
import { saveReview, verdictOf } from "../src/review-records.ts";

const PATH = process.env.PATH ?? "";
const FOLDER = "spec/features/AC0001-shop";
const TICKET = `${FOLDER}/ticket.md`;
const OTHER = "spec/features/AC0002-other/ticket.md";
const PROCEDURE = readFileSync(new URL("../roles/coordinator/review-limit.md", import.meta.url), "utf8").trim();
// The worker's rule (packages/core/roles/worker.md), word for word: omp ends a bash call at 300 s when it names no timeout (AR0566).
const TIMEOUT_RULE = "\n- Run each check (the project's tests, its type check) in one bash call with a `timeout` of 1800 seconds: a call ends at its timeout, 300 seconds when it names none, and a check it kills gives no result. A suite that needs longer gets up to 3600.\n";

// The repository `acme` (prefix AC): ticket AC0001, labelled os=macos, and AC0002, both planned; the repository `beta` (prefix
// BE), whose HEAD holds AC0001's ticket file and no board entry; delivery set up on the fake host with its project list, and
// with `start` started as `arthur run` starts it, so it hands a FAIL back. `worker(task, file)` runs a worker on AC0001 and
// commits a file on its branch (`<job>.ts` by default), as a worker would; `review(message, ...args)` runs `arthur review` with
// the fake agent playing a reviewer whose final message is `message`; `setAutoMerge` sets acme's `autoMerge`.
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
	const other = join(dirname(root), "beta");
	mkdirSync(join(other, FOLDER), { recursive: true });
	writeFileSync(join(other, TICKET), readFileSync(join(root, TICKET)));
	writeFileSync(join(other, "spec/build.json"), "[]");
	git(other, "init", "--quiet", "--initial-branch=main");
	git(other, "add", "--all");
	git(other, "commit", "--quiet", "-m", "first");
	t.after(() => {
		process.env.PATH = PATH;
	});
	// Put first on `PATH`, before whatever a test put there (a fake ssh).
	const agent = (run: AgentRun) => {
		process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${process.env.PATH}`;
	};
	const fake = fakeHost({ name: "delivery", root });
	let autoMerge: boolean | undefined;
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC", ...(autoMerge === undefined ? {} : { autoMerge }) }, { name: "beta", path: other, prefix: "BE" }]);
	const plugin = delivery();
	await fake.setup(plugin);
	if (start) await plugin.start?.();
	const home = dirname(fake.host.folder);
	const state = (id: string) => (existsSync(join(home, "jobs", id, "state")) ? readFileSync(join(home, "jobs", id, "state"), "utf8") : "");
	const ended = async (id: string) => {
		await until(`${id} to end`, () => state(id) === "ended");
		fake.emit("job-ended", { id, state: "ended" });
	};
	const worker = async (task = `Ticket: ${TICKET}`, file?: string) => {
		agent({ steps: [{ message: "Done.\nTicket: spec/features/AC0002-other/ticket.md was not touched." }] });
		const job = await fake.host.jobs.spawn({ task });
		await ended(job.id);
		const path = file ?? `${job.id}.ts`;
		writeFileSync(join(job.worktree, path), "export const shop = 1;\n");
		git(job.worktree, "add", path);
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
	return { root, other, fake, git, worker, review, status, home, state, ended, agent, field, step, plugin, setAutoMerge: (value: boolean | undefined) => void (autoMerge = value) };
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

test("a PASS review runs on the branch's tip with its ticket, moves the ticket to review and then done, asks github.push to push the branch, and files once", async (t) => {
	const { root, fake, git, worker, review, status, home } = await load(t);
	const pushes: unknown[] = [];
	fake.provide("github.push", (branch: unknown) => (pushes.push(branch), Promise.resolve("github: pushed")));
	const job = await worker();
	assert.equal(status("AC0001"), "in-progress");
	const passed = await review("Clean.\n\nPASS", job.id.slice(-8));
	assert.equal(passed.code, undefined, passed.err);
	assert.deepEqual(pushes, [{ project: "acme", branch: job.branch }]);
	const task = readFileSync(join(home, "jobs", passed.id, "task"), "utf8");
	assert.equal(task.split("\n\n")[0], `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`);
	assert.match(task, new RegExp(`## The worker's final message \\(job ${job.id}\\)\n\nDone.\nTicket\\\\: spec/features/AC0002`));
	const prompt = readFileSync(join(home, "jobs", passed.id, "prompt"), "utf8");
	assert.ok(prompt.includes(TIMEOUT_RULE), "the worker's timeout rule");
	assert.doesNotMatch(prompt, /proc:\/\/|sleep 30/, "no wait on proc://, which the job sandbox refuses");
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
	assert.match(String(fake.collect("coordinator.wake", { id: none.id, kind: "review" })[0]), new RegExp(`^Review ${none.id}: no verdict, so the review failed: the last line of its final message is not PASS or FAIL alone though Arthur resumed it once for that already, or its run did not finish\\. .* Review again with arthur review ${job.id}, then arthur prune ${none.id}\\.$`));
	assert.throws(() => fake.host.jobs.file("AC0001", none.id), { message: `${none.id} ended ended (${reason}), not finished: its result is unfinished and is never filed; prune it` });
	assert.deepEqual(readdirSync(join(root, FOLDER)), ["ticket.md"]);
	assert.deepEqual(fake.collect("coordinator.wake", { id: job.id, kind: "worker" }), [undefined], "a worker's wake gets nothing");
	// One that `arthur stop` or `stopall` stopped is started again only on the owner's word.
	writeFileSync(join(home, "jobs", none.id, "reason"), "stopped");
	assert.match(String(fake.collect("coordinator.wake", { id: none.id, kind: "review" })[0]), new RegExp(`^Review ${none.id} was stopped, so it has no verdict, .* Review again only when the owner asks: arthur review ${job.id};`));
});

test("a review in no home, an eval's, is worded from the record its data names and the final message it is given, and writes nothing", async (t) => {
	const { fake } = await load(t);
	const id = "2026-10-22-review-1f2e3d4c";
	const [branch, commit] = ["arthur/2026-10-22-worker-4d5e6f70", "9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d"];
	const records = (delivery: unknown) => ({ delivery });
	const given = { ticket: "AC0001", branch, commit };
	const ended = { id, kind: "review", project: "acme", state: "ended", reason: "finished", records: records(given) };
	const wake = (job: object, result: unknown) => fake.collect("coordinator.wake", job, result)[0];
	const file = `File it: arthur ticket file AC0001 ${id}, commit it, then arthur prune ${id}.`;
	assert.equal(wake(ended, "Clean.\n\nPASS"), `Review verdict: PASS on ${branch} at 9c1d2e3; AC0001 moves to done. ${file}`);
	assert.equal(
		wake({ ...ended, records: records({ ...given, autoMerge: true }) }, "Clean.\n\nPASS"),
		`Review verdict: PASS on ${branch} at 9c1d2e3; AC0001 moves to done. acme merges on its own (autoMerge): delivery runs arthur merge --auto 2026-10-22-worker-4d5e6f70, whose merge files and prunes this review, and wakes you with what it printed; nothing to do until then.`,
		"no filing and no merge of the coordinator's, which would race the merge on main",
	);
	assert.match(String(wake(ended, "Rounds each line.\n\nFAIL")), new RegExp(`^Review verdict: FAIL on ${branch} at 9c1d2e3, 1 since its last PASS; AC0001 moves back to in-progress\\. .* It hands the branch back: `));
	assert.match(String(wake(ended, "PASS\n\nAll good.")), new RegExp(`^Review ${id}: no verdict, so the review failed: `));
	assert.match(String(wake({ ...ended, reason: "limit: budget" }, "Clean.\n\nPASS")), new RegExp(`^Review ${id}: no verdict, `), "a run that did not finish has none");
	assert.match(String(wake({ ...ended, state: "blocked" }, "Clean.\n\nPASS")), new RegExp(`^Review ${id}: no verdict, `), "nor one blocked");
	assert.match(String(wake({ ...ended, reason: "stopped" }, "")), new RegExp(`^Review ${id} was stopped, `));
	assert.equal(wake({ ...ended, records: {} }, "PASS"), undefined, "no record named, no line");
	assert.equal(wake({ ...ended, kind: "worker" }, "PASS"), undefined, "a worker's end gets no review line, whatever its data names");
	assert.equal(existsSync(join(fake.host.folder, "reviews")), false, "no record written");
	for (const wrong of [{ ...given, ticket: "shop" }, { ...given, branch: "main" }, { ...given, commit: "HEAD" }, { ...given, autoMerge: "yes" }, "AC0001", null])
		assert.throws(() => wake({ ...ended, records: records(wrong) }, "PASS"), { message: `review ${id}: records.delivery: expected { ticket: <id>, branch: arthur/<worker job>, commit: <sha>, autoMerge?: true | false }, got ${JSON.stringify(wrong)}` });
	// A review of this home is read from its own record, whatever the data names.
	saveReview(fake.host, { id, ticket: "AC0002", branch, commit, at: 1 });
	assert.match(String(wake(ended, "Clean.\n\nPASS")), /AC0002 stays at review/);
});

test("a FAIL moves the ticket back to in-progress and pushes nothing; a fifth review after 4 FAILs is refused naming them, until --round 5", async (t) => {
	const { root, fake, worker, review, status, home } = await load(t);
	const pushes: unknown[] = [];
	fake.provide("github.push", (branch: unknown) => (pushes.push(branch), Promise.resolve("github: pushed")));
	const job = await worker();
	const first = await review("Missing test.\n\nFAIL", job.id);
	assert.equal(status("AC0001"), "in-progress");
	assert.deepEqual(pushes, [], "a FAIL pushes nothing");
	assert.deepEqual(readdirSync(join(root, FOLDER)), ["ticket.md"], "outside arthur run no hand-back: nothing filed");
	const wake = (id: string) => String(fake.collect("coordinator.wake", { id, kind: "review" })[0]);
	const filed = (id: string) => `Delivery files it as the next review-N.md in AC0001's folder; commit that, then arthur prune ${id}.`;
	assert.equal(
		wake(first.id),
		`Review verdict: FAIL on ${job.branch} at ${job.commit.slice(0, 7)}, 1 since its last PASS; AC0001 moves back to in-progress. ${filed(first.id)} It hands the branch back: ${job.id} continues with the findings and a new budget, and the next review starts when it ends; arthur stopall cancels it.`,
	);
	assert.equal((await review("x\nFAIL", job.id, "--round", "3")).err, `arthur review: refused by delivery: round 3 is not the next one of ${job.branch}: it has 1 FAIL since its last PASS, so the next round is 2`);
	const fails = [first.id];
	for (const round of [2, 3, 4]) {
		const failed = await review(`Still missing, round ${round}.\n\nFAIL`, job.id);
		assert.equal(failed.code, undefined, `round ${round} starts without --round: ${failed.err}`);
		fails.push(failed.id);
		const line = `${round} since its last PASS; AC0001 moves back to in-progress. ${filed(failed.id)}`;
		if (round < 4) assert.ok(wake(failed.id).endsWith(`${line} It hands the branch back: ${job.id} continues with the findings and a new budget, and the next review starts when it ends; arthur stopall cancels it.`), `FAIL ${round} hands back`);
		else assert.ok(wake(failed.id).endsWith(`${line} The hand-back stops at the limit.\n\n${PROCEDURE}`), "the fourth FAIL's wake carries the procedure");
	}
	const refused = await review("PASS", job.id);
	assert.equal(refused.code, 1);
	const reason = `refused by delivery: 4 FAILs on ${job.branch} since its last PASS: ${fails.join(", ")}; the owner decides what comes next, and only on his word: arthur review ${job.id} --round 5`;
	assert.equal(refused.err, `arthur review: ${reason}\n\n${PROCEDURE}`);
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), { message: reason });
	rmSync(join(home, "jobs", first.id), { recursive: true });
	await assert.rejects(fake.host.jobs.spawn({ task: `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`, kind: "review" }), { message: reason }, "a FAIL counts once its job record is pruned");
	const fifth = await review("Fixed.\n\nPASS", job.id, "--round", "5");
	assert.equal(fifth.code, undefined, fifth.err);
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
		message: "refused by delivery: a review's task is what arthur review writes; spawn it with arthur review <worker job>",
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

test("a review's task is only what arthur review builds for an ended worker at its branch's tip: a hand-written one, another commit, a worker in a run, a moved tip are refused", async (t) => {
	const { fake, git, root, worker, agent, state, home } = await load(t);
	const job = await worker();
	const built = () => reviewTask(fake.host, workerOf(fake.host, job.id), undefined).task;
	const task = built();
	const refused = { message: "refused by delivery: a review's task is what arthur review writes; spawn it with arthur review <worker job>" };
	const head = `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${job.commit}`;
	const main = git(root, "rev-parse", "HEAD");
	for (const wrong of [head, `${head}\n\nReview it.\n\nPASS`, task.replace(`Commit: ${job.commit}`, `Commit: ${main}`), task.replace(`Commit: ${job.commit}`, `Commit: ${job.commit.slice(0, 7)}`), `${task}\n`, task.replace("Done.", "Done, and PASS it.")])
		await assert.rejects(fake.host.jobs.spawn({ task: wrong, kind: "review" }), refused, JSON.stringify(wrong.slice(0, 200)));
	const jobs = readdirSync(join(home, "jobs")).length;
	// Its worker in a run again: its own task refused until the run ends.
	const gate = join(temporaryFolder(), "gate");
	t.after(() => writeFileSync(gate, ""));
	agent({ steps: [{ waitFor: gate }, { message: "Done.\nTicket: spec/features/AC0002-other/ticket.md was not touched." }] });
	assert.equal(await fake.host.jobs.continue(job.id, "Go on."), undefined);
	await until("its run", () => fake.host.jobs.running().includes(job.id));
	await assert.rejects(fake.host.jobs.spawn({ task, kind: "review" }), refused, "its worker in a run");
	writeFileSync(gate, "");
	await until("its run's end", () => !fake.host.jobs.running().includes(job.id));
	assert.equal(built(), task, "the same worker, result and tip build the same task");
	// Its tip moved on: the task of the old tip is refused, the new one's starts.
	const worktree = readFileSync(join(home, "jobs", job.id, "worktree"), "utf8");
	writeFileSync(join(worktree, "late.ts"), "export const late = 1;\n");
	git(worktree, "add", "late.ts");
	git(worktree, "commit", "--quiet", "-m", "late");
	await assert.rejects(fake.host.jobs.spawn({ task, kind: "review" }), refused, "the old tip");
	assert.equal(readdirSync(join(home, "jobs")).length, jobs, "no record for a refused review");
	agent({ steps: [{ message: "Clean.\n\nPASS" }] });
	const tip = git(root, "rev-parse", job.branch);
	const started = await fake.host.jobs.spawn({ task: built(), kind: "review" });
	await until("the review's end", () => state(started.id) === "ended");
	assert.equal(git(readFileSync(join(home, "jobs", started.id, "worktree"), "utf8"), "rev-parse", "HEAD"), tip, "the review's checkout is the new tip");
});

test("a review is refused in a project other than its worker's, though that project has a job and its HEAD holds the ticket and the tip, and starts in the worker's", async (t) => {
	const { fake, git, root, other, worker, agent, state, home, field } = await load(t);
	const job = await worker();
	git(other, "fetch", "--quiet", root, job.branch);
	agent({ steps: [{ message: "Done." }] });
	const own = await fake.host.jobs.spawn({ task: "Tidy beta.", project: "beta" });
	await until("beta's worker's end", () => state(own.id) === "ended");
	assert.equal(field(own.id, "project"), "beta");
	const { task } = reviewTask(fake.host, workerOf(fake.host, job.id), undefined);
	const jobs = readdirSync(join(home, "jobs")).length;
	await assert.rejects(fake.host.jobs.spawn({ task, kind: "review", project: "beta" }), {
		message: "refused by delivery: a review's task is what arthur review writes; spawn it with arthur review <worker job>",
	});
	assert.equal(readdirSync(join(home, "jobs")).length, jobs, "no record for a refused review");
	agent({ steps: [{ message: "Clean.\n\nPASS" }] });
	const started = await fake.host.jobs.spawn({ task, kind: "review", project: "acme" });
	await until("the review's end", () => state(started.id) === "ended");
	assert.equal(field(started.id, "project"), "acme");
});

const reviews = (fake: { readonly host: { readonly jobs: { list(): readonly { readonly id: string; readonly kind: string }[] } } }) =>
	fake.host.jobs.list().filter((each) => each.kind === "review").map((each) => each.id);

test("in arthur run a FAIL is filed, its worker continued with the findings and a new budget, reviewed again at its end; rounds 3 and 4 start by themselves; the fourth FAIL stops at the limit", async (t) => {
	const { root, fake, worker, review, home, ended, field, step, agent, state } = await load(t, { start: true });
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
	const wake = (id: string) => String(fake.collect("coordinator.wake", { id, kind: "review" })[0]);
	const seen = [first.id, next];
	let current = next;
	for (const round of [2, 3]) {
		// FAIL `round` ends: the worker is continued with its findings and ends; then review `round + 1` starts by itself.
		await until(`review ${round}'s run`, () => state(current) === "ended");
		agent({ steps: [{ message: `Fixed for round ${round + 1}.` }] });
		fake.emit("job-ended", { id: current, state: "ended" });
		await until(`FAIL ${round} filed and the continued run's end`, () => existsSync(join(root, FOLDER, `review-${round}.md`)) && fake.host.jobs.result(job.id) === `Fixed for round ${round + 1}.`);
		assert.match(field(job.id, "continue") ?? "", new RegExp(`^Review ${current} of your branch ${job.branch} says FAIL\\. `));
		assert.match(wake(current), new RegExp(`, ${round} since its last PASS; .* It hands the branch back: `));
		agent({ steps: [{ message: "Missing test.\n\nFAIL" }] });
		await ended(job.id);
		await until(`review ${round + 1}`, () => reviews(fake).length === round + 1);
		current = reviews(fake).find((id) => !seen.includes(id)) ?? "";
		seen.push(current);
	}
	await ended(current);
	await until("the fourth FAIL filed and the hand-back ended", () => existsSync(join(root, FOLDER, "review-4.md")) && step(job.id) === undefined);
	assert.equal(reviews(fake).length, 4, "no fifth review");
	assert.match(wake(current), new RegExp(`4 since its last PASS; .* The hand-back stops at the limit\\.\n\n${PROCEDURE.slice(0, 20)}`));
	assert.equal(fake.collect("coordinator.wake", { id: job.id, kind: "worker" })[0], undefined);
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-message"), [], "the repeated end of the first review did nothing");
});

test("a FAIL's end delivered before arthur run's start, as its replay of the log is, is handed back once it starts", async (t) => {
	const { root, worker, review, step, plugin } = await load(t);
	const job = await worker();
	await review("Missing test.\n\nFAIL", job.id);
	assert.deepEqual([readdirSync(join(root, FOLDER)), step(job.id)], [["ticket.md"], undefined]);
	await plugin.start?.();
	await until("the worker continued", () => step(job.id) === "continued");
	assert.ok(existsSync(join(root, FOLDER, "review-1.md")));
});

test("a continue or review refused at maxAgents waits for the next end of a run, or arthur run's next start, then starts", async (t) => {
	const { fake, worker, review, ended, field, step } = await load(t, { start: true });
	const [full, asked] = [new Set<string>(), [] as string[]];
	fake.beforeSpawn((spawn) => (asked.push(spawn.kind), full.has(spawn.kind) ? "maxAgents is 1 and 1 job is in a run: other; spawn again once one ends" : undefined));
	const job = await worker();
	full.add("worker");
	await review("Missing test.\n\nFAIL", job.id);
	await until("the continue refused", () => asked.filter((kind) => kind === "worker").length === 2);
	assert.deepEqual([step(job.id), field(job.id, "continue")], ["continue", undefined]);
	full.clear();
	full.add("review");
	// `arthur run` started again: a new hand-back on the same folder goes on with the one kept.
	handBack(fake.host).start();
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

test("a drop ends the hand-back of its ticket's worker, which goes with its branch, and tells the coordinator nothing; a refusal by delivery itself, which no freed slot lifts, ends the hand-back and tells the coordinator once", async (t) => {
	const { root, fake, git, worker, review, ended, field, step } = await load(t, { start: true });
	let [full, asked] = [false, 0];
	fake.beforeSpawn((spawn) => (asked++, full && spawn.kind === "worker" ? "maxAgents is 1 and 1 job is in a run: other; spawn again once one ends" : undefined));
	const told = () => fake.emitted.flatMap((event) => (event.name === "coordinator-message" && typeof event.data === "object" && event.data !== null && "text" in event.data ? [String(event.data.text)] : []));
	const other = () => fake.emit("job-ended", { id: "2026-01-01-worker-00000000", state: "ended" });
	// Another plugin's refusal is tried again at each run's end, silently.
	const one = await worker(`Ticket: ${OTHER}`);
	full = true;
	await review("Missing test.\n\nFAIL", one.id);
	await until("the continue refused", () => asked === 3);
	other();
	await until("the continue refused again", () => asked === 4);
	assert.deepEqual([step(one.id), told()], ["continue", []]);
	// Its ticket dropped meanwhile (F1 of AR0555): the hand-back ends, and the worker and its review go as the ticket's other jobs do.
	full = false;
	const said: string[] = [];
	t.mock.method(console, "log", (text: string) => void said.push(text));
	fake.host.board.move("AC0002", "dropped");
	t.mock.restoreAll();
	assert.ok(said.includes(`delivery: AC0002 dropped: ${one.branch} deleted, not merged: AC0002 is dropped`), said.join("\n"));
	assert.deepEqual([step(one.id), field(one.id, "state"), git(root, "branch", "--list", one.branch), reviews(fake)], [undefined, undefined, "", []]);
	// A later run's end continues no one and says nothing.
	other();
	// Delivery's own: the review's ticket moved back to planning by hand while the worker ran.
	const two = await worker();
	const second = await review("Missing test.\n\nFAIL", two.id);
	await until("the worker continued", () => step(two.id) === "continued");
	await until("the continued run's end", () => fake.host.jobs.result(two.id).startsWith("Missing test."));
	fake.host.board.move("AC0001", "planning");
	await ended(two.id);
	await until("the review refused", () => told().length > 0);
	assert.equal(told().length, 1, told().join("\n"));
	assert.match(told()[0] ?? "", new RegExp(`^Delivery's hand-back of ${two.branch} after FAIL ${second.id} stopped: refused by delivery: AC0001 is planning; a review is of a ticket in-progress, review or done\\. Hand it back yourself: `));
	assert.deepEqual([step(two.id), reviews(fake)], [undefined, [second.id]], "no review after the second; the first went with its dropped ticket's prune");
});

test("a review in its run when its ticket is dropped is kept, then pruned when it ends: its FAIL hands nothing back, files nothing, its wake says just that, and the coordinator gets no other word", async (t) => {
	const { root, fake, git, worker, review, ended, agent, state, step, home } = await load(t, { start: true });
	const told = () => fake.emitted.flatMap((event) => (event.name === "coordinator-message" && typeof event.data === "object" && event.data !== null && "text" in event.data ? [String(event.data.text)] : []));
	const one = await worker(`Ticket: ${OTHER}`);
	const gate = join(temporaryFolder(), "gate");
	agent({ steps: [{ waitFor: gate }, { message: "Missing test.\n\nFAIL" }] });
	const said: string[] = [];
	t.mock.method(console, "log", (text: string) => void said.push(text));
	await fake.commands[0]?.run({ args: [one.id], project: undefined });
	const id = said[0] ?? "";
	const checkout = readFileSync(join(home, "jobs", id, "worktree"), "utf8");
	fake.host.board.move("AC0002", "dropped");
	assert.ok(said.includes(`delivery: AC0002 dropped: ${id}: kept: it is in a run; once it ends, delivery prunes it, its branch too`), said.join("\n"));
	assert.ok(said.includes(`delivery: AC0002 dropped: ${one.branch} deleted, not merged: AC0002 is dropped`), said.join("\n"));
	const failed: string[] = [];
	t.mock.method(console, "error", (text: string) => void failed.push(text));
	writeFileSync(gate, "");
	await ended(id);
	// Right after its end's handlers the job is still there: a wake (orchestration's, whatever the plugins' order) reads its final message; the prune comes after.
	assert.deepEqual([state(id), fake.host.jobs.result(id)], ["ended", "Missing test.\n\nFAIL"]);
	const wake = fake.collect<string | undefined>("coordinator.wake", { id, kind: "review", project: "acme", state: "ended", reason: "finished" }, "Missing test.\n\nFAIL");
	assert.deepEqual(wake, [`Review ${id} ended on AC0002, which is dropped: it is not filed, nothing is handed back, and delivery prunes it with the ticket's other jobs. Nothing to do.`]);
	await until("the review pruned", () => state(id) === "");
	t.mock.restoreAll();
	assert.ok(said.includes(`delivery: AC0002 dropped: ${id}: worktree ${checkout} removed; record deleted`), said.join("\n"));
	assert.deepEqual([failed, fake.host.board.get("AC0002")?.status], [[], "dropped"], "its verdict moves no dropped ticket");
	// A FAIL of another ticket after it: once its worker is continued, the hand-back has acted on the first end (one queue).
	const two = await worker();
	await review("Missing test.\n\nFAIL", two.id);
	await until("the second worker continued", () => step(two.id) === "continued");
	assert.deepEqual([step(one.id), told(), git(root, "branch", "--list", one.branch), existsSync(join(home, "jobs", one.id))], [undefined, [], "", false]);
	const filed = join(root, dirname(OTHER));
	assert.deepEqual(existsSync(filed) ? readdirSync(filed).filter((name) => name.startsWith("review-")) : [], [], "the dropped ticket's FAIL is not filed");
});

test("stop-all cancels the hand-back: between the worker's end and its review, before a FAIL's end is acted on, and while a review starts", async (t) => {
	const { root, fake, worker, review, ended, agent, state, step } = await load(t, { start: true });
	let [refuse, stopIn, refused] = [false, "", 0];
	fake.beforeSpawn((spawn) => {
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
	const failed = await fake.host.jobs.spawn({ task: reviewTask(fake.host, workerOf(fake.host, two.id), undefined).task, kind: "review", fetch: two.commit });
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
	assert.equal(
		fake.collect("coordinator.wake", { id: started, kind: "review" })[0],
		`Review ${started} was stopped, so it has no verdict, is never filed, and AC0001 stays at review. Review again only when the owner asks: arthur review ${three.id}; arthur prune ${started} frees it.`,
	);
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
	// A record broken by hand: said, naming it, at each try.
	writeFileSync(join(fake.host.folder, "hand-backs", "broken.json"), "{");
	const said: string[] = [];
	t.mock.method(console, "error", (text: string) => said.push(text));
	fake.emit("job-ended", { id: "2026-01-01-worker-00000000", state: "ended" });
	await until("the broken record named", () => said.length > 0);
	assert.match(said[0] ?? "", new RegExp(`^delivery: hand-back: ${join(fake.host.folder, "hand-backs", "broken.json")}: not a hand-back record \\(.+\\); remove it$`));
});

test("a worker's run that ends blocked keeps its hand-back, one that fails ends it, and a review with no verdict ends it", async (t) => {
	const { fake, worker, review, ended, agent, state, step } = await load(t, { start: true });
	let hold = false;
	fake.host.jobs.beforeSpawn((spawn) => (hold && spawn.kind === "worker" ? "maxAgents is 1 and 1 job is in a run: other; spawn again once one ends" : undefined));
	// The FAIL's continue held at maxAgents, so the continued run plays `run`.
	const handOver = async (job: { readonly id: string }, run: AgentRun) => {
		hold = true;
		await review("Missing test.\n\nFAIL", job.id);
		await until("the continue held", () => step(job.id) === "continue");
		agent(run);
		hold = false;
		fake.emit("job-ended", { id: "2026-01-01-worker-00000000", state: "ended" });
		await until("the worker continued", () => step(job.id) === "continued");
		await until("its run's end", () => !fake.host.jobs.running().includes(job.id));
	};
	const blocked = await worker();
	await handOver(blocked, { steps: [{ message: "Blocked: user which table?" }] });
	fake.emit("job-ended", { id: blocked.id, state: "blocked" });
	assert.match(String(fake.collect("coordinator.wake", { id: blocked.id, kind: "worker" })[0]), /itself once its run ends; run no arthur review-needed/);
	agent({ steps: [{ message: "Looks fine." }] });
	assert.equal(await fake.host.jobs.continue(blocked.id, "The orders table."), undefined);
	await until("the answered run's end", () => fake.host.jobs.result(blocked.id) === "Looks fine.");
	await ended(blocked.id);
	await until("the next review", () => step(blocked.id) === "reviewing");
	const [next = ""] = reviews(fake);
	await until("the review's end", () => state(next) === "ended");
	fake.emit("job-ended", { id: next, state: "ended" });
	await until("no verdict ended the hand-back", () => step(blocked.id) === undefined);
	const failed = await worker();
	await handOver(failed, { steps: [{ stderr: "boom" }], exitCode: 1 });
	const count = reviews(fake).length;
	await ended(failed.id);
	await until("the failed run ended the hand-back", () => step(failed.id) === undefined);
	assert.equal(reviews(fake).length, count, "no review of a run that failed");
});

// `arthur` as `arthur run` starts it for a merge: the core's CLI in the folder the test then runs in, as `arthur run` runs in its
// config's. That config loads a fake `merge`, which notes its arguments, prints `out` and `err` and exits `code` as `answer` sets.
function fakeMerge(t: TestContext) {
	const folder = temporaryFolder();
	const [log, answer] = [join(folder, "asked"), join(folder, "answer.json")];
	writeFileSync(join(folder, "merge.md"), "# arthur merge\n");
	const merge = `{ name: "merge", doc: new URL("./merge.md", import.meta.url), run({ args }) { appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n"); const { out, err, code } = JSON.parse(readFileSync(${JSON.stringify(answer)}, "utf8")); process.stdout.write(out); process.stderr.write(err); return code; } }`;
	writeFileSync(join(folder, "arthur.config.ts"), `import { appendFileSync, readFileSync } from "node:fs";\nexport default { plugins: [{ name: "orchestration", setup() {} }, { name: "fake", setup(host) { host.commands.register(${merge}); } }] };\n`);
	const cwd = process.cwd();
	process.chdir(folder);
	t.after(() => process.chdir(cwd));
	return {
		answer: (out: string, err: string, code: number) => writeFileSync(answer, JSON.stringify({ out, err, code })),
		asked: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []),
	};
}

const told = (fake: { readonly emitted: readonly { readonly name: string; readonly data: unknown }[] }) =>
	fake.emitted.flatMap(({ name, data }) => (name === "coordinator-message" && typeof data === "object" && data !== null && "text" in data ? [String(data.text)] : []));
// The causes delivery forwarded for a job, as `<folder>/<job>/forwarded` keeps them; read once the event's handler has run.
const forwarded = async (folder: string, id: string) => {
	await tick();
	return existsSync(join(folder, id, "forwarded")) ? readFileSync(join(folder, id, "forwarded"), "utf8") : "";
};

test("in arthur run with autoMerge on, a PASS and then CI passed on a waiting branch each run arthur merge --auto as a child and wake the coordinator once with what it printed; a repeated end runs none, nor a PASS without autoMerge", async (t) => {
	const merge = fakeMerge(t);
	const { fake, worker, review, setAutoMerge } = await load(t, { start: true });
	const off = await worker();
	const unmerged = await review("Clean.\n\nPASS", off.id);
	assert.match(String(fake.collect("coordinator.wake", { id: unmerged.id, kind: "review" })[0]), /File it: arthur ticket file AC0001 /, "without autoMerge the coordinator files it");
	assert.equal(await forwarded(fake.host.folder, off.id), "", "and no merge runs");
	setAutoMerge(true);
	const job = await worker(`Ticket: ${OTHER}`);
	merge.answer("merged arthur/x into main: 1a2b3c4\n\n# After a merge that went in\n", "", 0);
	const passed = await review("Clean.\n\nPASS", job.id);
	await until("the coordinator woken", () => told(fake).length === 1);
	assert.deepEqual(merge.asked(), [["--auto", job.id]]);
	const ran = `acme merges on its own (autoMerge), so delivery ran arthur merge --auto ${job.id}`;
	assert.deepEqual(told(fake), [`Review ${passed.id} says PASS on AC0002, ${job.branch} at ${job.commit.slice(0, 7)}. ${ran}: it went in; follow the procedure it printed last. What it printed:\n\nmerged arthur/x into main: 1a2b3c4\n\n# After a merge that went in`]);
	assert.match(String(fake.collect("coordinator.wake", { id: passed.id, kind: "review" })[0]), new RegExp(`moves to done\\. acme merges on its own \\(autoMerge\\): delivery runs arthur merge --auto ${job.id}, `));
	fake.emit("job-ended", { id: passed.id, state: "ended" });
	assert.equal(await forwarded(fake.host.folder, job.id), `${passed.id}\n`, "the repeated end runs no second merge");
	// CI passed on the branch a refused --auto left waiting: the merge runs again, its refusal one wake.
	merge.answer("", "arthur merge: --auto merges no held path: x changes roles/a.md (a role); its merge waits for the owner: arthur merge x on his word; main is unchanged\n", 1);
	startWait(fake.host, { job: job.id, project: "acme", branch: job.branch, tip: job.commit, own: 1 });
	const run = { id: 7, attempt: 1, sha: job.commit, branch: job.branch, status: "completed", conclusion: "success", url: "https://github.com/acme/shop/actions/runs/7", startedAt: "2026-01-01T00:00:00Z", below: 0 };
	assert.deepEqual(fake.collect("delivery.ciEnded", { project: "acme", branch: job.branch, below: 0, run }), [true]);
	await until("the coordinator woken again", () => told(fake).length === 2);
	assert.deepEqual(merge.asked(), [["--auto", job.id], ["--auto", job.id]]);
	assert.equal(
		told(fake)[1],
		`CI passed on ${job.branch} (run 7, attempt 1, on ${job.commit.slice(0, 7)}): ${run.url}. ${ran}: exit 1, it did not go in; act on its last line as arthur merge --help, "What the coordinator does with the result", says. What it printed:\n\narthur merge: --auto merges no held path: x changes roles/a.md (a role); its merge waits for the owner: arthur merge x on his word; main is unchanged`,
	);
});

test("a no review of arthur review-needed, in its own process, is merged by arthur run once it starts, with one wake; the same answer again runs none", async (t) => {
	const merge = fakeMerge(t);
	const { fake, worker, setAutoMerge, plugin } = await load(t);
	setAutoMerge(true);
	const job = await worker(undefined, "notes.md");
	merge.answer("", "arthur merge: --auto merges only with CI passed on the branch: no run built the tip yet; it waits: when that run ends, the coordinator is woken with its verdict; main is unchanged\n", 1);
	const needed = async () => {
		const out: string[] = [];
		t.mock.method(console, "log", (text: string) => out.push(text));
		await fake.commands.find((each) => each.name === "review-needed")?.run({ args: [job.id], project: undefined });
		t.mock.restoreAll();
		return out.join("\n");
	};
	assert.equal(await needed(), `no review: 1 file, all docs (*.md)\nAC0001 moves to done.\nacme merges on its own (autoMerge): arthur run runs arthur merge --auto ${job.id} and wakes you with what it printed; nothing to do until then.`);
	assert.equal(await forwarded(fake.host.folder, job.id), "", "a process arthur run did not start runs no merge");
	await plugin.start?.();
	await until("the coordinator woken", () => told(fake).length === 1);
	assert.deepEqual(merge.asked(), [["--auto", job.id]]);
	assert.match(told(fake)[0] ?? "", new RegExp(`^arthur review-needed answered no review for AC0001, ${job.branch} at ${job.commit.slice(0, 7)}\\. acme merges on its own \\(autoMerge\\), so delivery ran arthur merge --auto ${job.id}: exit 1, it did not go in; .*What it printed:\n\narthur merge: --auto merges only with CI passed on the branch: no run built the tip yet; `));
	await needed();
	assert.equal(await forwarded(fake.host.folder, job.id), `no review ${job.commit}\n`, "the same answer on the same tip runs no second merge");
	// An event of another shape, or naming no job, as a hand-written line in the log could: nothing runs.
	fake.emit("no-review", { id: job.id, project: "acme", ticket: "AC0001", branch: job.branch });
	for (const id of ["../outside", "--unreviewed"]) fake.emit("no-review", { id, project: "acme", ticket: "AC0001", branch: job.branch, commit: "f".repeat(40) });
	assert.equal(await forwarded(fake.host.folder, job.id), `no review ${job.commit}\n`, "no commit, no merge");
	assert.deepEqual([existsSync(join(fake.host.folder, "..", "outside")), existsSync(join(fake.host.folder, "--unreviewed"))], [false, false], "an id that is no job's is never a path or a flag");
});
