import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

// AR0355: `arthur merge --unreviewed` (delivery's `decision.owner` call) and `--budget 0` of a spawn on a paid model (the
// spawn's `decision`) go on only with the owner's own decision of their kind, for the job's ticket, used once.

const PATH = process.env.PATH ?? "";
const ONE = "spec/features/AC0001-one/ticket.md";
const TWO = "spec/features/AC0002-two/ticket.md";
const JOB = "2026-03-04-worker-0000abcd";

// The repository `acme` (AC) with AC0001 and AC0002 planned and committed, the plugin set up on the fake host outside any job,
// and the fake agent on PATH for the spawns.
async function setup(t: TestContext) {
	const saved = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	const root = join(temporaryFolder(), "acme");
	const entry = (id: string, path: string) => ({ id, title: id, status: "planned", path, updated: "2026-01-01T00:00:00Z" });
	for (const [path, text] of [[ONE, "# AC0001 - One\n"], [TWO, "# AC0002 - Two\n"], ["spec/build.json", JSON.stringify([entry("AC0001", ONE), entry("AC0002", TWO)])]]) {
		mkdirSync(dirname(join(root, path ?? "")), { recursive: true });
		writeFileSync(join(root, path ?? ""), text ?? "");
	}
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: root, encoding: "utf8" });
	git("init", "--quiet", "--initial-branch=main");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "Done." }] }))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
		if (saved === undefined) delete process.env.ARTHUR_JOB;
		else process.env.ARTHUR_JOB = saved;
	});
	const fake = fakeHost({ name: "orchestration", root, timeZone: "UTC", now: new Date("2026-03-04T08:00:00Z") });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	await fake.setup(orchestration());
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	t.mock.method(console, "error", (text: string) => void printed.push(text));
	// `arthur decision <args>`; its first line, the id an `ask` printed.
	const decision = async (...args: string[]) => {
		printed.length = 0;
		const code = await fake.commands.find((command) => command.name === "decision")?.run({ args, project: undefined });
		assert.equal(code ?? 0, 0, printed.join("\n"));
		return printed.join("\n").split("\n")[0] ?? "";
	};
	// A question of `kind` the owner answered, of `--ticket <id>` or `--job <id>` when given.
	const owners = async (kind: string, ...of: string[]) => {
		const id = await decision("ask", "--kind", kind, "--question", `May it go on, ${kind}?`, ...of);
		await decision("answer", id, "--decided", "It may", "tak");
		return id;
	};
	const used = (id: string) => (existsSync(join(fake.host.folder, "used", id)) ? readFileSync(join(fake.host.folder, "used", id), "utf8") : undefined);
	return { fake, decision, owners, used, call: (asked: object) => fake.host.call<string>("decision.owner", { what: "--unreviewed", kind: "merge", use: `merge ${JOB}`, ...asked }) };
}

test("--unreviewed goes on only with the owner's merge decision of its ticket, else of its job; each refusal names why", async (t) => {
	const { decision, owners, call, used } = await setup(t);
	assert.equal(call({ id: "", ticket: "AC0001", job: JOB }), `--unreviewed needs the owner's decision: arthur decision ask --kind merge --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then --unreviewed --decision <its id>`);
	assert.equal(call({ id: "", job: JOB }), `--unreviewed needs the owner's decision: arthur decision ask --kind merge --question '<what he decides>' --job ${JOB}, his answer recorded with arthur decision answer, then --unreviewed --decision <its id>`);
	assert.equal(call({ id: "AC-D9", ticket: "AC0001", job: JOB }), "AC-D9 is not in the decision log of project acme");
	assert.equal(call({ id: "ZZ-D1", ticket: "AC0001", job: JOB }), "ZZ-D1: no project has the prefix ZZ; prefixes: AC");
	assert.equal(call({ id: "yes", ticket: "AC0001", job: JOB }), "YES is no decision id: <prefix>-D<number>, as arthur decision ask printed it");
	const plan = await owners("plan", "--ticket", "AC0001");
	assert.equal(call({ id: plan, ticket: "AC0001", job: JOB }), `${plan} is a plan question, not merge: --unreviewed takes a merge decision`);
	const open = await decision("ask", "--kind", "merge", "--question", "Merge AC0001 unreviewed?", "--ticket", "AC0001");
	assert.equal(call({ id: open, ticket: "AC0001", job: JOB }), `${open} is open, not answered by the owner`);
	await decision("close", open, "asked again");
	assert.equal(call({ id: open, ticket: "AC0001", job: JOB }), `${open} is closed, not answered by the owner`);
	const two = await owners("merge", "--ticket", "AC0002");
	assert.equal(call({ id: two, ticket: "AC0001", job: JOB }), `${two} is of ticket AC0002, not of ticket AC0001`);
	assert.equal(call({ id: two, job: JOB }), `${two} is of ticket AC0002, not of job ${JOB}`);
	const other = await owners("merge", "--job", "2026-03-04-worker-0000ffff");
	assert.equal(call({ id: other, job: JOB }), `${other} is of job 2026-03-04-worker-0000ffff, not of job ${JOB}`);
	assert.equal(call({ id: other, ticket: "AC0001", job: "2026-03-04-worker-0000ffff" }), `${other} is of job 2026-03-04-worker-0000ffff, not of ticket AC0001`);
	assert.deepEqual([used(plan), used(open), used(two), used(other)], [undefined, undefined, undefined, undefined], "a refusal uses no decision");
	const one = await owners("merge", "--ticket", "AC0001");
	assert.equal(call({ id: one.toLowerCase(), ticket: "AC0001", job: JOB }), "", "the owner's, its id in any case");
	assert.equal(used(one), `merge ${JOB}`);
	assert.equal(call({ id: one, ticket: "AC0001", job: JOB }), "", "the same merge tried again, after a conflict or a failed check");
	assert.equal(call({ id: one, ticket: "AC0001", job: "2026-03-04-worker-0000eeee", use: "merge 2026-03-04-worker-0000eeee" }), `${one} was used already (merge ${JOB}); ask the owner again`);
	const mine = await owners("merge", "--job", JOB);
	assert.equal(call({ id: mine, job: JOB }), "", "a job of no ticket: the owner's of that job");
});

test("--unreviewed refuses a decision a class answered by policy; the owner's later answer to it counts", async (t) => {
	const { decision, owners, call } = await setup(t);
	const backing = await owners("merge", "--ticket", "AC0002");
	const proposal = await decision("class", "propose", "--kind", "merge", "--match", "go on", "--decided", "It may", "--backed-by", backing);
	await decision("answer", proposal, "--picked", "1", "--decided", "Pre-approve unreviewed merges", "zawsze");
	const policy = await decision("ask", "--kind", "merge", "--question", "May it go on unreviewed?", "--ticket", "AC0001");
	assert.equal(call({ id: policy, ticket: "AC0001", job: JOB }), `${policy} was answered by policy (${proposal}), not by the owner`);
	await decision("answer", policy, "--decided", "It may", "tak, sam");
	assert.equal(call({ id: policy, ticket: "AC0001", job: JOB }), "");
});

test("--budget 0 on a paid spawn starts only with the owner's budget decision of its ticket, or of no ticket for a spawn of none, once", async (t) => {
	const { fake, owners, used } = await setup(t);
	const spawn = (task: string, decision: string) => fake.host.jobs.spawn({ task, budgetUsd: 0, decision });
	const refused = (why: string) => ({ message: `refused by orchestration: ${why}` });
	await assert.rejects(spawn(`Ticket: ${ONE}`, ""), refused("--budget 0 needs the owner's decision: arthur decision ask --kind budget --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then --budget 0 --decision <its id>"));
	await assert.rejects(spawn("Go.", ""), refused("--budget 0 needs the owner's decision: arthur decision ask --kind budget --question '<what he decides>', his answer recorded with arthur decision answer, then --budget 0 --decision <its id>"));
	const merge = await owners("merge", "--ticket", "AC0001");
	await assert.rejects(spawn(`Ticket: ${ONE}`, merge), refused(`${merge} is a merge question, not budget: --budget 0 takes a budget decision`));
	const two = await owners("budget", "--ticket", "AC0002");
	await assert.rejects(spawn(`Ticket: ${ONE}`, two), refused(`${two} is of ticket AC0002, not of ticket AC0001`));
	await assert.rejects(spawn("Go.", two), refused(`${two} is of ticket AC0002, not of a spawn of no ticket`));
	const one = await owners("budget", "--ticket", "AC0001");
	const worker = await spawn(`Ticket: ${ONE}`, one);
	assert.deepEqual([worker.budgetUsd, used(one)], [0, "spawn"]);
	const loose = await owners("budget");
	assert.equal((await spawn("Go.", loose)).budgetUsd, 0);
	await assert.rejects(spawn("Go again.", loose), refused(`${loose} was used already (spawn); ask the owner again`));
	assert.equal((await fake.host.jobs.spawn({ task: "Go cheaply.", budgetUsd: 0 })).budgetUsd, 0, "a plugin's own spawn names no decision: no check");
});

test("--budget 0 on a continue of a job of no ticket goes on only with the owner's budget decision of that job, used once", async (t) => {
	const { fake, owners, used } = await setup(t);
	const job = await fake.host.jobs.spawn({ task: "Go." });
	const ended = async () => {
		const state = join(dirname(fake.host.folder), "jobs", job.id, "state");
		for (const deadline = Date.now() + 15_000; !existsSync(state) || readFileSync(state, "utf8") !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${job.id} to end`);
	};
	await ended();
	const go = (decision: string) => fake.host.jobs.continue(job.id, "Go on.", 0, decision);
	const refused = (why: string) => ({ message: `refused by orchestration: ${why}` });
	await assert.rejects(go(""), refused(`--budget 0 needs the owner's decision: arthur decision ask --kind budget --question '<what he decides>' --job ${job.id}, his answer recorded with arthur decision answer, then --budget 0 --decision <its id>`));
	const loose = await owners("budget");
	await assert.rejects(go(loose), refused(`${loose} is of no ticket and no job, not of job ${job.id}`));
	const other = await owners("budget", "--job", "2026-03-04-worker-0000ffff");
	await assert.rejects(go(other), refused(`${other} is of job 2026-03-04-worker-0000ffff, not of job ${job.id}`));
	assert.deepEqual([used(loose), used(other)], [undefined, undefined]);
	const mine = await owners("budget", "--job", job.id);
	assert.equal(await go(mine), undefined);
	assert.equal(used(mine), `continue ${job.id}`);
	await ended();
	await assert.rejects(go(mine), refused(`${mine} was used already (continue ${job.id}); ask the owner again`));
});
