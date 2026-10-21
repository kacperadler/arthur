import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { AUDIT_TASK } from "../src/audit.ts";
import { type ManageOptions, manage } from "../src/manage.ts";

// The audit against the fake host and the fake agent, the test providing `schedule.register` as the schedule plugin would and
// running the entry's code itself: the repository `acme` (prefix AC) with a board, a vision and a findings.md.

const PATH = process.env.PATH ?? "";
// A Wednesday, 02:00 UTC.
const NOW = new Date("2026-10-21T02:00:00Z");
const FOUND = "spec/features/AC0001-one";
const PROCEDURE = readFileSync(new URL("../roles/coordinator/audit-ended.md", import.meta.url), "utf8").trim();

const findings = [
	"# AC0001 - Findings\n",
	"## F1. The prune skips a link\n\n- Kind: bug\n- Where: `src/prune.ts:12`\n- Status: open\n",
	"## F2. Fixed already\n\n- Kind: bug\n- Where: `src/a.ts:1`\n- Status: fixed in abc1234\n",
	"## F3. No where\n\n- Kind: risk\n- Status: open\n",
].join("\n");

async function load(t: TestContext, options: ManageOptions = { audit: { at: "02:00" } }, run: AgentRun = { steps: [{ message: "## 1. A bug\nKind: bug\n\nNO PROPOSALS is not this." }] }) {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(join(root, FOUND), { recursive: true });
	writeFileSync(join(root, "spec/vision.md"), "# Vision\n");
	writeFileSync(join(root, FOUND, "ticket.md"), "# AC0001 - One\n");
	writeFileSync(join(root, FOUND, "findings.md"), findings);
	const entry = (id: string, status: string, updated: string) => ({ id, title: `Ticket ${id}`, status, path: `spec/features/${id}-one/ticket.md`, updated });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([entry("AC0001", "in-progress", "2026-01-01T00:00:00Z"), entry("AC0002", "merged", "2000-01-01T00:00:00Z"), entry("AC0003", "merged", "2999-01-01T00:00:00Z")]));
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: root, encoding: "utf8" }).trim();
	// A commit of a new file `file`, or, with `null`, of what the checkout holds.
	const commit = (message: string, file: string | null = `${message}.txt`) => {
		if (file !== null) writeFileSync(join(root, file), message);
		git("add", "--all");
		git("commit", "--quiet", "-m", message);
		return git("rev-parse", "HEAD");
	};
	git("init", "--quiet", "--initial-branch=main");
	commit("first");
	process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "manage", options, now: NOW, root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const entries: Record<string, unknown>[] = [];
	fake.provide("schedule.register", (plugin: unknown, list: Record<string, unknown>[]) => void entries.push(...list.map((each) => ({ plugin, ...each }))));
	await fake.setup(manage(options));
	const printed: string[] = [];
	t.mock.method(console, "log", (line: string) => printed.push(line));
	const home = dirname(fake.host.folder);
	const read = (id: string, name: string) => (existsSync(join(home, "jobs", id, name)) ? readFileSync(join(home, "jobs", id, name), "utf8") : "");
	const audits = () => fake.host.jobs.list().filter((job) => job.kind === "audit");
	// The entry's run, as the schedule calls it at its slot; the audit it started, if any.
	const night = async () => {
		const before = audits().length;
		await (entries[0]?.run as () => Promise<void>)();
		return audits().length > before ? audits()[0] : undefined;
	};
	const ended = async (id: string) => {
		for (const deadline = Date.now() + 15_000; read(id, "state") !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
	};
	return { root, fake, git, commit, entries, printed, home, read, night, ended, jobs: fake.host.jobs };
}

test("audit.at registers one entry with the schedule on audit.days, running manage's code; without it none; without the schedule the load is refused", async (t) => {
	const { entries } = await load(t, { audit: { at: "02:00", days: ["tue", "fri"] } });
	assert.deepEqual(entries.map(({ run, ...rest }) => ({ ...rest, run: typeof run })), [{ plugin: "manage", id: "audit", at: "02:00", days: ["tue", "fri"], option: "audit.at", run: "function" }]);
	assert.deepEqual((await load(t, { audit: { at: "02:00" } })).entries.map((each) => "days" in each), [false], "every day: no days");
	assert.deepEqual((await load(t, {})).entries, [], "no audit option, no entry");
	await assert.rejects(Promise.try(() => manage({ audit: { at: "02:00" } }).setup(fakeHost({ name: "manage", options: { audit: { at: "02:00" } } }).host)), {
		message: "audit.at needs the schedule plugin, which starts the audit; add schedule() to the config's plugins, or leave audit out",
	});
});

test("the night's audit is a read-only job with its budget and model, its prompt the commits, board, stats, findings and vision", async (t) => {
	const { night, read, printed, commit, root } = await load(t, { audit: { at: "02:00", budgetUsd: 7.5, model: "anthropic/opus" } });
	const head = commit("second");
	const job = await night();
	assert.ok(job !== undefined);
	assert.deepEqual(printed, [`manage: audit: started job ${job.id}`]);
	assert.match(job.id, /^2026-10-21-audit-[0-9a-f]{8}$/);
	assert.deepEqual([job.branch, read(job.id, "task"), read(job.id, "budget"), read(job.id, "model"), read(job.id, "resume-on-budget"), read(job.id, "base")], ["", AUDIT_TASK, "7.5", "anthropic/opus", "true", head]);
	const prompt = read(job.id, "prompt");
	assert.match(prompt, /^# Auditor\n/);
	const section = prompt.slice(prompt.indexOf("## This audit"));
	assert.match(section, new RegExp(`^## This audit\n\nYou audit project acme at ${head}; your worktree is a detached checkout of that commit\\.\n\n`));
	assert.match(section, /### Commits of the last 24 hours \(no report in spec\/quality\/ names an audited commit\)\n\n[0-9a-f]+ second\n[0-9a-f]+ first\n\n/);
	assert.ok(section.includes("### Board\n\nAC0001 in-progress"), section);
	assert.ok(section.includes("### Stats\n\nStats of acme: 2 merged tickets\n"), "no audit before: every merged ticket");
	assert.ok(section.includes(`### Open findings\n\n- AC0001 F1: The prune skips a link. Where: \`src/prune.ts:12\`\n- AC0001 F3: No where\n\n`), section);
	assert.ok(section.endsWith("### Vision\n\n`spec/vision.md`: read it first, and rank each proposal by how far it moves the project there.\n"), section);
	assert.equal(existsSync(join(root, "spec/quality")), false, "nothing filed before the coordinator files it");
});

test("filed as spec/quality/<date>.md with the commit audited; a second audit the same day is -2.md and starts from the first's commit", async (t) => {
	const { night, jobs, ended, root, commit, read } = await load(t);
	const first = await night();
	assert.ok(first !== undefined);
	await ended(first.id);
	const base = read(first.id, "base");
	assert.equal(jobs.file(undefined, first.id), "spec/quality/2026-10-21.md");
	const report = readFileSync(join(root, "spec/quality/2026-10-21.md"), "utf8");
	assert.equal(report, `# Audit 2026-10-21\n\n- Job: ${first.id}\n- Commit audited: ${base}\n\n## Final message\n\n## 1. A bug\nKind: bug\n\nNO PROPOSALS is not this.`);
	assert.throws(() => jobs.file(undefined, first.id), { message: `${first.id} is already filed as spec/quality/2026-10-21.md` });
	commit("the report", null);
	const third = commit("third");
	const second = await night();
	assert.ok(second !== undefined);
	const section = read(second.id, "prompt");
	assert.match(section, new RegExp(`### Commits since the last audit, ${base.slice(0, 12)} \\(spec/quality/2026-10-21\\.md\\)\n\n${third.slice(0, 7)}[0-9a-f]* third\n\n`), "the report's own commit is not listed");
	assert.ok(section.includes("### Stats\n\nStats of acme: 1 merged ticket\nAC0003 "), "only the tickets merged since the last audited commit");
	await ended(second.id);
	assert.equal(jobs.file(undefined, second.id), "spec/quality/2026-10-21-2.md");
	assert.match(readFileSync(join(root, "spec/quality/2026-10-21-2.md"), "utf8"), new RegExp(`^# Audit 2026-10-21\n\n- Job: ${second.id}\n- Commit audited: ${third}\n`));
	assert.equal(readFileSync(join(root, "spec/quality/2026-10-21.md"), "utf8"), report, "the first report is left as it was");
});

test("no commit since the last audit's, or only the reports', makes no job; a commit elsewhere, or an audited commit Git lacks, makes one", async (t) => {
	const { night, printed, commit, root } = await load(t);
	const audited = commit("audited");
	mkdirSync(join(root, "spec/quality"));
	commit("the report", "spec/quality/2026-10-20.md");
	writeFileSync(join(root, "spec/quality/2026-10-20.md"), `# Audit 2026-10-20\n\n- Job: 2026-10-20-audit-0000000a\n- Commit audited: ${audited}\n\n## Final message\n\nNO PROPOSALS`);
	commit("the report filed", "spec/quality/notes.txt");
	assert.equal(await night(), undefined);
	assert.deepEqual(printed, [`manage: audit: no job, no commit since the last audit's ${audited.slice(0, 12)}`]);
	commit("new code");
	assert.notEqual(await night(), undefined);
	writeFileSync(join(root, "spec/quality/2026-10-20.md"), "# Audit\n\n- Commit audited: 0123456789abcdef0123456789abcdef01234567\n");
	commit("a commit Git lacks", "spec/quality/2026-10-20.md");
	assert.notEqual(await night(), undefined, "taken as no audit before");
});

test("a day not in audit.days makes no job, also when the schedule runs a missed slot late on such a day", async (t) => {
	const { night, printed, fake, commit } = await load(t, { audit: { at: "02:00", days: ["tue", "thu"] } });
	commit("new code");
	assert.equal(await night(), undefined, "a Wednesday");
	assert.deepEqual(printed, ["manage: audit: no job, wed is not in audit.days (tue, thu)"]);
	fake.setNow(new Date("2026-10-22T02:00:00Z"));
	assert.notEqual(await night(), undefined, "a Thursday");
});

test("an audit is resumed once when its budget runs out, doubled, then stopped; the failed audit is never filed", async (t) => {
	const stuck = { waitFor: join(temporaryFolder(), "never") };
	const { night, jobs, read, root } = await load(t, { audit: { at: "02:00", budgetUsd: 1 } }, { steps: [{ message: "## 1. Half a proposal", cost: 1, stopReason: "toolUse" }, stuck] });
	const job = await night();
	assert.ok(job !== undefined);
	for (const deadline = Date.now() + 20_000; !read(job.id, "reason").startsWith("limit: budget: its cost $2"); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out: ${read(job.id, "reason")}`);
	assert.deepEqual([read(job.id, "state"), read(job.id, "reason"), read(job.id, "budget")], ["ended", "limit: budget: its cost $2.0000 reached its budget of $2", "2"]);
	assert.equal(read(job.id, "log").match(/the kind resumes once, its budget doubled to \$2\n/g)?.length, 1, "resumed once, never twice");
	assert.throws(() => jobs.file(undefined, job.id), { message: `${job.id} ended ended (limit: budget: its cost $2.0000 reached its budget of $2), not finished: its result is unfinished and is never filed; prune it` });
	assert.equal(existsSync(join(root, "spec/quality")), false);
});

test("an audit whose task names a ticket is filed only with that ticket named, still as a report; the wake of an audit carries the procedure", async (t) => {
	const { jobs, ended, root, fake } = await load(t);
	const job = await jobs.spawn({ task: `Ticket: ${FOUND}/ticket.md\nLook at F1.`, kind: "audit" });
	await ended(job.id);
	assert.throws(() => jobs.file(undefined, job.id), { message: `${job.id}'s task names AC0001; file it in its ticket: arthur ticket file AC0001 ${job.id}` });
	assert.equal(jobs.file("AC0001", job.id), "spec/quality/2026-10-21.md");
	assert.deepEqual(readdirSync(join(root, FOUND)).sort(), ["findings.md", "ticket.md"]);
	assert.deepEqual(fake.collect("coordinator.wake", { id: job.id, kind: "audit" }), [PROCEDURE]);
	assert.deepEqual(fake.collect("coordinator.wake", { id: job.id, kind: "worker" }), [undefined]);
});
