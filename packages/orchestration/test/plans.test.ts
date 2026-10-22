import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

const PATH = process.env.PATH ?? "";
const FOLDER = "spec/features/AC0001-big";
const TICKET = `${FOLDER}/ticket.md`;
const PLAN = `${FOLDER}/plan.md`;

const ticketText = (decisions = "") =>
	`# AC0001 - Big\n\n\`\`\`json\n{ "id": "AC0001", "requires": { "os": "macos" } }\n\`\`\`\n\n## Goal\n\nA big change.\n\n- Kind: feature\n- Plan: yes\n\n## Decisions\n\n${decisions}`;

// The repository `acme` (prefix AC) with ticket AC0001 (`- Plan: yes`, planned) and AC0002 (no plan line), the plugin set up
// on the fake host with its project list, and `omp` the fake agent that plays `run`.
async function load(t: TestContext, run: AgentRun = { steps: [{ message: "## Approach\nSmall.\n" }] }, options = {}) {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(join(root, FOLDER), { recursive: true });
	mkdirSync(join(root, "spec/features/AC0002-small"), { recursive: true });
	writeFileSync(join(root, TICKET), ticketText());
	writeFileSync(join(root, "spec/features/AC0002-small/ticket.md"), "# AC0002\n\n## Goal\n\n- Kind: bug\n");
	const entry = (id: string, path: string) => ({ id, title: id, status: "planned", path, updated: "2026-01-01T00:00:00Z" });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([entry("AC0001", TICKET), entry("AC0002", "spec/features/AC0002-small/ticket.md")]));
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: root, encoding: "utf8" }).trim();
	const commit = (message: string) => {
		git("add", "--all");
		git("commit", "--quiet", "-m", message);
		return git("rev-parse", "--short", "HEAD");
	};
	git("init", "--quiet", "--initial-branch=main");
	commit("first");
	process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "orchestration", root, options });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	await fake.setup(orchestration(options));
	const home = dirname(fake.host.folder);
	const ended = async (id: string) => {
		for (const deadline = Date.now() + 15_000; readState(home, id) !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
	};
	return { root, fake, jobs: fake.host.jobs, git, commit, ended, home };
}

const readState = (home: string, id: string) => (existsSync(join(home, "jobs", id, "state")) ? readFileSync(join(home, "jobs", id, "state"), "utf8") : "");

test("a plan or plan review without one ticket.md on a Ticket: line, or of a ticket not on the board, is refused before any record", async (t) => {
	const { jobs, home, root, commit } = await load(t);
	const refused = "refused by orchestration: a plan job names its one ticket on a line Ticket: spec/features/<id>-<slug>/ticket.md; its task names";
	await assert.rejects(jobs.spawn({ task: "Plan the big one.", kind: "plan" }), { message: `${refused} none` });
	writeFileSync(join(root, FOLDER, "notes.md"), "notes\n");
	await assert.rejects(jobs.spawn({ task: `Ticket: ${TICKET}\nTicket: spec/features/AC0002-small/ticket.md`, kind: "plan" }), { message: `${refused} ${TICKET}, spec/features/AC0002-small/ticket.md` });
	mkdirSync(join(root, "spec/features/AC0009-gone"));
	writeFileSync(join(root, "spec/features/AC0009-gone/ticket.md"), "# AC0009\n");
	commit("a note, and a ticket the board does not hold");
	await assert.rejects(jobs.spawn({ task: `Ticket: ${FOLDER}/notes.md`, kind: "plan" }), { message: `${refused} ${FOLDER}/notes.md` });
	await assert.rejects(jobs.spawn({ task: "Ticket: spec/features/AC0009-gone/ticket.md", kind: "plan" }), { message: "refused by orchestration: AC0009 is not on the board" });
	await assert.rejects(jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan-review" }), {
		message: "refused by orchestration: AC0001 has no committed plan.md to review; file its plan first (arthur ticket file AC0001 <plan job>) and commit it",
	});
	assert.equal(existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")).length : 0, 0);
});

test("a plan files as plan.md with its header; planned again it replaces it, one plan.md, the old one in Git history", async (t) => {
	const { jobs, root, ended, commit, git } = await load(t);
	const first = await jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan" });
	assert.equal(first.budgetUsd, 5, "plan.budgetUsd left out is 5");
	await ended(first.id);
	assert.equal(jobs.file("AC0001", first.id), PLAN);
	assert.equal(readFileSync(join(root, PLAN), "utf8"), `# AC0001 - Plan\n\n- Job: ${first.id}\n- Planned at: ${first.base}\n\n## Approach\nSmall.`);
	assert.throws(() => jobs.file("AC0002", first.id), { message: `${first.id}'s task names AC0001 of project acme, not AC0002` });
	commit("plan");
	const second = await jobs.spawn({ task: `Ticket: ${TICKET}\nSmaller, please.`, kind: "plan" });
	await ended(second.id);
	assert.equal(jobs.file("AC0001", second.id.slice(-8)), PLAN, "the short id names the job");
	commit("plan again");
	assert.deepEqual(readdirSync(join(root, FOLDER)).sort(), ["plan.md", "ticket.md"]);
	assert.match(readFileSync(join(root, PLAN), "utf8"), new RegExp(`- Job: ${second.id}\n`));
	assert.equal(git("log", "--format=%s", "--", PLAN), "plan again\nplan");
});

test("the plan budget option sets the plan job's budget", async (t) => {
	const { jobs } = await load(t, undefined, { plan: { budgetUsd: 7.5 } });
	assert.equal((await jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan" })).budgetUsd, 7.5);
});

test("filing a failed plan job is refused and writes nothing; so is a worker, and a ticket not on the board", async (t) => {
	const { jobs, root, ended } = await load(t, { steps: [{ message: "half a plan" }], exitCode: 1 });
	const failed = await jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan" });
	await ended(failed.id);
	assert.throws(() => jobs.file("AC0001", failed.id), { message: `${failed.id} ended ended (failed: the agent exited 1), not finished: its result is unfinished and is never filed; prune it` });
	assert.equal(existsSync(join(root, PLAN)), false);
	const worker = await jobs.spawn({ task: "Ticket: spec/features/AC0002-small/ticket.md" });
	await ended(worker.id);
	assert.throws(() => jobs.file("AC0002", worker.id), { message: `${worker.id} is a worker job, and no plugin files that kind` });
	assert.throws(() => jobs.file("AC0042", failed.id), { message: "AC0042 is not on the board" });
});

test("a plan still in a run is refused", async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const { jobs } = await load(t, { steps: [{ waitFor: gate }, { message: "plan" }] });
	const running = await jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan" });
	t.after(() => writeFileSync(gate, ""));
	assert.throws(() => jobs.file("AC0001", running.id), { message: new RegExp(`^${running.id} is in a run \\((working|idle)\\); file it once it has ended$`) });
});

test("plan reviews number on from the highest one, record the verdict, and a job is never filed twice", async (t) => {
	const { jobs, root, ended, commit } = await load(t, { steps: [{ message: "The plan holds.\n\nPASS\n" }] });
	writeFileSync(join(root, PLAN), "# plan\n");
	writeFileSync(join(root, FOLDER, "plan-review-1.md"), "one\n");
	writeFileSync(join(root, FOLDER, "plan-review-3.md"), "three\n");
	commit("plan and two reviews");
	const review = await jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan-review" });
	await ended(review.id);
	assert.equal(jobs.file("AC0001", review.id), `${FOLDER}/plan-review-4.md`);
	assert.equal(
		readFileSync(join(root, FOLDER, "plan-review-4.md"), "utf8"),
		`# AC0001 - Plan review 4\n\n- Job: ${review.id}\n- Plan reviewed: ${PLAN} at ${review.base}\n- Verdict: PASS\n\nThe plan holds.\n\nPASS`,
	);
	assert.throws(() => jobs.file("AC0001", review.id), { message: `${review.id} is already filed as ${FOLDER}/plan-review-4.md` });
	assert.equal(readFileSync(join(root, FOLDER, "plan-review-3.md"), "utf8"), "three\n");
});

test("a plan review without a bare verdict on its last line is filed with the verdict none", async (t) => {
	const { jobs, root, ended, commit } = await load(t, { steps: [{ message: "Looks fine.\n**PASS**" }] });
	writeFileSync(join(root, PLAN), "# plan\n");
	commit("plan");
	const review = await jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan-review" });
	await ended(review.id);
	assert.equal(jobs.file("AC0001", review.id), `${FOLDER}/plan-review-1.md`);
	assert.match(readFileSync(join(root, FOLDER, "plan-review-1.md"), "utf8"), /\n- Verdict: none\n/);
});

test("a worker on a Plan: yes ticket needs its plan.md committed, approved by the owner for this plan.md, and on its Plan: line", async (t) => {
	const { jobs, root, commit } = await load(t);
	const task = `Ticket: ${TICKET}\nPlan: ${PLAN}`;
	await assert.rejects(jobs.spawn({ task }), {
		message: `refused by orchestration: AC0001 says "- Plan: yes" and has no committed plan.md; plan it first: arthur spawn --kind plan 'Ticket: ${TICKET}', then the owner's ok`,
	});
	writeFileSync(join(root, PLAN), "# plan one\n");
	const filed = commit("plan one");
	const unapproved = /^refused by orchestration: AC0001: its plan\.md at HEAD is not one the owner approved: /;
	await assert.rejects(jobs.spawn({ task }), { message: unapproved });
	writeFileSync(join(root, TICKET), ticketText(`- 2026-01-01: Plan approved by the owner: plan.md at ${filed}\n`));
	commit("approved");
	await assert.rejects(jobs.spawn({ task: `Ticket: ${TICKET}` }), { message: `refused by orchestration: AC0001: the task needs the line Plan: ${PLAN}, so the worker follows the approved plan` });
	const worker = await jobs.spawn({ task });
	assert.equal(worker.kind, "worker");
	// Planned again after the approval: the approval names the earlier plan.md, so the next worker waits for a new one.
	writeFileSync(join(root, PLAN), "# plan two\n");
	commit("plan two");
	await assert.rejects(jobs.spawn({ task }), { message: unapproved });
});

test("the plan guard reads only the Goal: a Plan: yes line elsewhere, a ticket without it, and other kinds are not checked", async (t) => {
	const { jobs, root, commit } = await load(t);
	writeFileSync(join(root, TICKET), "# AC0001\n\n## Goal\n\n- Kind: feature\n\n## Description\n\n- Plan: yes\n");
	commit("plan line outside the goal");
	assert.equal((await jobs.spawn({ task: `Ticket: ${TICKET}` })).kind, "worker");
	assert.equal((await jobs.spawn({ task: "Ticket: spec/features/AC0002-small/ticket.md" })).kind, "worker");
	assert.equal((await jobs.spawn({ task: "No ticket at all." })).kind, "worker");
});

test("a worker or a continue on a pre-approved ticket needs a budget above 0 and at most the recorded one, until the owner approves it", async (t) => {
	const { jobs, fake, root, commit, ended } = await load(t);
	const small = "spec/features/AC0002-small/ticket.md";
	const task = `Ticket: ${small}`;
	const decisions = "## Decisions\n\n- 2026-01-01: Source: F1 of AC0001\n- 2026-01-02: Pre-approved by policy: bug from F1 of AC0001, 1 Scope file, budget $1.5 of the $3 cap\n";
	writeFileSync(join(root, small), `# AC0002\n\n## Goal\n\n- Kind: bug\n\n${decisions}`);
	commit("pre-approved");
	const over = (got: string) => ({ message: `refused by orchestration: AC0002 is pre-approved by policy with a budget of $1.5; its worker gets at most that, above 0, not $${got}: --budget 1.5, or the owner's approval under its Decisions ("- YYYY-MM-DD: The owner approved ...")` });
	await assert.rejects(jobs.spawn({ task }), over("2"), "the jobs' default budget");
	await assert.rejects(jobs.spawn({ task, budgetUsd: 1.51 }), over("1.51"));
	await assert.rejects(jobs.spawn({ task, budgetUsd: 0 }), over("0 (no limit)"));
	const worker = await jobs.spawn({ task, budgetUsd: 1.5 });
	await ended(worker.id);
	await assert.rejects(fake.host.jobs.continue(worker.id, "Go on.", 10), over("10"));
	// The owner's own approval after the record lifts it; one before it does not.
	writeFileSync(join(root, small), `# AC0002\n\n## Goal\n\n- Kind: bug\n\n${decisions.replace("- 2026-01-02", "- 2026-01-01: The owner approved this.\n- 2026-01-02")}`);
	commit("approved before");
	await assert.rejects(jobs.spawn({ task, budgetUsd: 10 }), over("10"));
	writeFileSync(join(root, small), `# AC0002\n\n## Goal\n\n- Kind: bug\n\n${decisions}- 2026-01-03: The owner approved this at $10.\n`);
	commit("approved after");
	assert.equal((await jobs.spawn({ task, budgetUsd: 10 })).budgetUsd, 10);
});

test("a worker or a continue on a pre-approved ticket on a free model starts with its budget of 0; a paid one with 0 stays refused", async (t) => {
	const { jobs, fake, root, commit, ended } = await load(t);
	const small = "spec/features/AC0002-small/ticket.md";
	writeFileSync(join(root, small), "# AC0002\n\n## Goal\n\n- Kind: bug\n\n## Decisions\n\n- 2026-01-02: Pre-approved by policy: bug from F1 of AC0001, 1 Scope file, budget $1.5 of the $3 cap\n");
	commit("pre-approved");
	// The models plugin's answer: a provider model costs nothing, a built-in one does.
	fake.provide("models.pick", (list: readonly string[]) => ({ model: list[0], why: `using ${list[0]}`, free: list[0] === "mac/qwen3" }));
	const worker = await jobs.spawn({ task: `Ticket: ${small}`, model: "mac/qwen3", budgetUsd: 2 });
	assert.deepEqual([worker.budgetUsd, worker.free, worker.failed], [0, true, undefined]);
	await ended(worker.id);
	assert.equal(await fake.host.jobs.continue(worker.id, "Go on."), undefined, "its record's budget of 0 on its free model");
	await ended(worker.id);
	const refused = /^refused by orchestration: AC0002 is pre-approved by policy with a budget of \$1\.5; its worker gets at most that, above 0, not \$0 \(no limit\)/;
	await assert.rejects(jobs.spawn({ task: `Ticket: ${small}`, model: "anthropic/opus", budgetUsd: 0 }), { message: refused });
});

test("a plan job carries its ticket, so placement reads the ticket's labels and the job goes to the ticket's machine", async (t) => {
	const { jobs, fake, root } = await load(t);
	// A fake ssh that notes where it was sent and fails, as an unreachable machine does.
	const bin = temporaryFolder();
	const log = join(bin, "ssh.log");
	writeFileSync(join(bin, "ssh"), `#!/bin/sh\necho "$@" >> '${log}'\necho 'ssh: no route' >&2\nexit 255\n`, { mode: 0o755 });
	process.env.PATH = `${bin}${delimiter}${process.env.PATH}`;
	jobs.registerMachine({ name: "mac", ssh: "mac-mini", home: "/Users/test/.arthur", labels: { os: "macos" } });
	// Placement as the machines plugin does it: the ticket's `requires` from the ticket a `Ticket:` path names, else local.
	const asked: unknown[] = [];
	fake.provide("jobs.place", (spawn: { readonly tickets: readonly string[] }) => {
		asked.push(spawn.tickets);
		const [path] = spawn.tickets;
		if (path === undefined) return "local";
		const json = /```json\n([\s\S]*?)\n```/.exec(readFileSync(join(root, path), "utf8"))?.[1] ?? "{}";
		return JSON.parse(json).requires?.os === "macos" ? "mac" : "local";
	});
	await assert.rejects(jobs.spawn({ task: `Ticket: ${TICKET}`, kind: "plan" }));
	assert.deepEqual(asked, [[TICKET]]);
	assert.match(readFileSync(log, "utf8"), / mac-mini 'arthur' 'version'\n/);
});

test("the wake of a plan or plan review carries the procedure; another kind's carries none", async (t) => {
	const { fake } = await load(t);
	const procedure = readFileSync(new URL("../roles/coordinator/plan-ended.md", import.meta.url), "utf8").trim();
	// The decision log's line (decision-hooks.ts) is only for a run blocked on the owner.
	const lines = (kind: string) => fake.collect("coordinator.wake", { id: "x", kind, state: "ended" }).filter((line) => line !== undefined);
	for (const kind of ["plan", "plan-review"]) assert.deepEqual(lines(kind), [procedure], kind);
	assert.deepEqual(lines("worker"), []);
	assert.match(procedure, /arthur ticket file <ticket id> <job id>/);
});

test("/plan: the status and plan.md, or no plan; the id as 1, AC1 or AC0001", async (t) => {
	const { fake, root } = await load(t);
	const { route } = fake.host.commands;
	assert.equal(await route("/plan 1"), `AC0001: no plan (${PLAN} does not exist)`);
	writeFileSync(join(root, PLAN), "# AC0001 - Plan\n\nSmall.\n");
	for (const id of ["1", "AC1", "ac0001"]) assert.equal(await route(`/plan ${id}`), "AC0001 planned\n# AC0001 - Plan\n\nSmall.\n", id);
	assert.equal(await route("/plan"), "usage: /plan <id>");
});
