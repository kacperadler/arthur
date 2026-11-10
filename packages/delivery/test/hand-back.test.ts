import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { type AgentRun, temporaryFolder, until } from "@arthur/core/testing";
import { handBack } from "../src/hand-back.ts";
import { reviewTask, untested, worker as workerOf } from "../src/review-command.ts";
import { FOLDER, load, OTHER, PROCEDURE, reviews, RUN_CHECKS, TICKET, told } from "./review-setup.ts";

// The hand-back in arthur run (review-setup.ts): a FAIL back to its worker, a review after its end, and each way it stops.

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
	await until("the drop's lines", () => said.length > 0);
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
	await until("the drop's lines", () => said.some((line) => line.includes(" dropped: ")));
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

test("a review starts only on a tip whose check, test and mutate passed there: arthur review refuses one without each, the hand-back continues its worker once to run them, and a second miss goes to the coordinator", async (t) => {
	const { root, fake, git, worker, review, home, ended, field, step, agent, state } = await load(t, { start: true });
	writeFileSync(join(root, "package.json"), `${JSON.stringify({ scripts: { check: "tsc", test: "node --test", mutate: "node mutate.ts" } })}\n`);
	git(root, "add", "package.json");
	git(root, "commit", "--quiet", "-m", "scripts");
	const old = git(root, "rev-parse", "HEAD");
	const job = await worker();
	const tip = job.commit;
	const checks = (lines: string) => (mkdirSync(join(fake.host.folder, job.id), { recursive: true }), writeFileSync(join(fake.host.folder, job.id, "checks"), lines));
	// Each on the tip's clean tree: mutate with survivors left, which the worker names, capped at 25 of its 29 mutants.
	const passing = (at: string) => `check pass ${at} clean\ntest pass 3/3 ${at} clean\nmutate fail 25 run, 3 survived, 4 not run ${at} clean\n`;
	const refusal = (at: string, gaps: string) => `${job.branch} at ${at.slice(0, 7)} is reviewed only once the job's checks passed on its clean tip (check and test pass, mutate ran at least min(25, all) mutants): ${gaps}`;
	const moved = (from: string) => ["check", "test", "mutate"].map((script) => `${script} ran on ${from.slice(0, 7)}, not the tip`).join(", ");
	const mutated = (counts: string) => passing(tip).replace("mutate fail 25 run, 3 survived, 4 not run", `mutate ${counts}`);
	for (const [lines, gaps] of [
		["", "no check, no test, no mutate"],
		[passing(tip).replace(/^check .*\n/, ""), "no check"],
		[passing(tip).replace(/^test .*\n/m, ""), "no test"],
		[passing(tip).replace(/^mutate .*\n/m, ""), "no mutate"],
		[passing(tip).replace("check pass", "check fail"), "check fail"],
		[passing(tip).replace("test pass 3/3", "test fail 2/3"), "test fail 2/3"],
		[passing(tip).replace(`test pass 3/3 ${tip} clean`, `test pass 3/3 ${tip} dirty`), "test ran on a dirty tree"],
		[passing(tip).replace(`not run ${tip}`, `not run ${old}`), `mutate ran on ${old.slice(0, 7)}, not the tip`],
		// AR0637: a run capped below min(25, all its mutants), or one without its counts, did not reach the whole change.
		[mutated("pass 4 run, 0 survived, 12 not run"), "mutate capped at --max 4 (4 run, 0 survived, 12 not run of 16; it counts at 16)"],
		[mutated("fail 24 run, 2 survived, 1 not run"), "mutate capped at --max 24 (24 run, 2 survived, 1 not run of 25; it counts at 25)"],
		[mutated("pass"), "mutate pass without its counts"],
		[mutated("fail"), "mutate fail without its counts"],
	] as const) {
		checks(lines);
		const refused = await review("PASS", job.id);
		assert.deepEqual([refused.code, refused.err], [1, `arthur review: ${refusal(tip, gaps)}`], JSON.stringify(lines));
	}
	for (const counts of ["pass 3 run, 0 survived, 0 not run", "fail 25 run, 1 survived, 0 not run", "pass 26 run, 0 survived, 74 not run", "pass 0 run, 0 survived, 0 not run"]) {
		checks(mutated(counts));
		assert.equal(untested(fake.host, workerOf(fake.host, job.id)), undefined, counts);
	}
	assert.deepEqual(reviews(fake), [], "no review job for a tip without its checks");
	checks(passing(tip));
	const first = await review("Missing test.\n\nFAIL", job.id);
	await until("the worker continued with the findings", () => step(job.id) === "continued");
	await until("the continued run's end", () => fake.host.jobs.result(job.id).startsWith("Missing test."));
	// The worker's fix, committed, so its tip moved and the old tip's checks count no more.
	const worktree = field(job.id, "worktree") ?? "";
	const commit = (name: string) => {
		writeFileSync(join(worktree, name), "export const fix = 1;\n");
		git(worktree, "add", name);
		git(worktree, "commit", "--quiet", "-m", name);
		return git(root, "rev-parse", job.branch);
	};
	const second = commit("fix.ts");
	agent({ steps: [{ message: "Checks run." }] });
	await ended(job.id);
	await until("the worker continued to run its checks", () => field(job.id, "continue") === `Arthur starts no review yet: ${refusal(second, moved(tip))}. ${RUN_CHECKS}` && step(job.id) === "continued");
	assert.deepEqual(reviews(fake), [first.id], "no review of a tip without its checks");
	// It ran them on its tip: the next review starts there.
	checks(passing(second));
	await until("the run of its checks ended", () => fake.host.jobs.result(job.id) === "Checks run.");
	agent({ steps: [{ message: "Missing test.\n\nFAIL" }] });
	await ended(job.id);
	await until("the next review", () => step(job.id) === "reviewing");
	const [next = ""] = reviews(fake).filter((id) => id !== first.id);
	assert.equal(readFileSync(join(home, "jobs", next, "task"), "utf8").split("\n\n")[0], `Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${second}`);
	// Its FAIL hands back again: a fix committed, a continue to run the checks, which the worker ends without: the coordinator is told.
	await until("review 2's run", () => state(next) === "ended");
	fake.emit("job-ended", { id: next, state: "ended" });
	await until("the worker continued with review 2's findings", () => field(job.id, "continue")?.startsWith(`Review ${next} `) === true && step(job.id) === "continued");
	await until("that run's end", () => fake.host.jobs.result(job.id).startsWith("Missing test."));
	const third = commit("more.ts");
	agent({ steps: [{ message: "Checks run." }] });
	await ended(job.id);
	await until("the worker continued to run its checks, once in this round too", () => field(job.id, "continue") === `Arthur starts no review yet: ${refusal(third, moved(second))}. ${RUN_CHECKS}` && step(job.id) === "continued");
	await until("the run of its checks ended", () => fake.host.jobs.result(job.id) === "Checks run.");
	await ended(job.id);
	await until("the hand-back ended", () => step(job.id) === undefined);
	assert.deepEqual(told(fake), [`Delivery's hand-back of ${job.branch} after FAIL ${next} stopped: ${refusal(third, moved(second))}. Hand it back yourself: arthur continue ${job.id} '<the findings of ${next}>', then arthur review ${job.id} once it ends.`]);
	assert.equal(reviews(fake).length, 2, "no review after the second miss");
	// A job on another machine writes its checks there: none is asked of it.
	writeFileSync(join(home, "jobs", job.id, "machine"), "mac");
	assert.match(reviewTask(fake.host, workerOf(fake.host, job.id), undefined).task, new RegExp(`^Ticket: ${TICKET}\nBranch: ${job.branch}\nCommit: ${third}\n`));
});

test("a hand-back whose worker's tip cannot be read for its next review stops and tells the coordinator once", async (t) => {
	const { fake, worker, review, ended, step, home } = await load(t, { start: true });
	const job = await worker();
	const failed = await review("Missing test.\n\nFAIL", job.id);
	await until("the worker continued", () => step(job.id) === "continued");
	await until("the continued run's end", () => fake.host.jobs.result(job.id).startsWith("Missing test."));
	writeFileSync(join(home, "jobs", job.id, "project"), "gone");
	await ended(job.id);
	await until("the hand-back ended", () => step(job.id) === undefined);
	assert.deepEqual(told(fake), [`Delivery's hand-back of ${job.branch} after FAIL ${failed.id} stopped: ${job.id}'s project gone is not in the project list. Hand it back yourself: arthur continue ${job.id} '<the findings of ${failed.id}>', then arthur review ${job.id} once it ends.`]);
});
