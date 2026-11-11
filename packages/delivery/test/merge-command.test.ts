import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

// AR0665: who `arthur merge` asks for the owner's decision, held without its checks on main (merge-steps.test.ts holds those).
const PATH = process.env.PATH ?? "";
const TICKET = "spec/features/AC0001-shop/ticket.md";
const USAGE = "usage: arthur merge <job> (--auto | [--unreviewed] [--no-ci] --decision <id>)";

// The repository `acme` (AC) with AC0001 planned and no checks; `decision.owner` passing AC-D1 for every merge, AC-D2 for
// --unreviewed alone and AC-D3 for --no-ci alone, each request noted in `asked`; `merge(...args)` as the CLI runs it.
async function load(t: TestContext) {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(dirname(join(root, TICKET)), { recursive: true });
	writeFileSync(join(root, TICKET), '# AC0001 - Shop\n\n```json\n{ "id": "AC0001" }\n```\n');
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "Shop", status: "planned", path: TICKET, updated: "2026-01-01T00:00:00Z" }]));
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8" }).trim();
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "config", "user.name", "t");
	git(root, "config", "user.email", "t@example.com");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	// A merge, so no commit has code since one (`arthur merge --help`, AR0361).
	git(root, "merge", "--quiet", "--no-ff", "-m", "Take main as it is", git(root, "commit-tree", "-p", "HEAD", "-m", "main as it is", "HEAD^{tree}"));
	process.env.PATH = [dirname(fakeAgent({ steps: [{ message: "Done." }] })), PATH].join(delimiter);
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "delivery", root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	fake.provide("projects.install", () => "");
	const asked: { readonly id: string; readonly what: string }[] = [];
	const passes: Readonly<Record<string, readonly string[]>> = { "AC-D2": ["--unreviewed"], "AC-D3": ["--no-ci"] };
	fake.provide("decision.owner", (request: { readonly id: string; readonly what: string }) => {
		asked.push(request);
		if (request.id === "") return `${request.what} needs the owner's decision`;
		return request.id === "AC-D1" || passes[request.id]?.includes(request.what) ? "" : `${request.id} does not let ${request.what} through`;
	});
	await fake.setup(delivery());
	const run = async (name: string, args: readonly string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => void out.push(text));
		t.mock.method(console, "error", (text: string) => void err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })).catch((error: Error) => (err.push(`arthur ${name}: ${error.message}`), 1));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n") };
	};
	// A worker on AC0001 whose tip changes docs alone, so `arthur review-needed` answers no review: its PASS.
	const passed = async () => {
		const job = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}` });
		const state = join(dirname(fake.host.folder), "jobs", job.id, "state");
		await until(`${job.id} to end`, () => existsSync(state) && readFileSync(state, "utf8") === "ended");
		fake.emit("job-ended", { id: job.id, state: "ended" });
		writeFileSync(join(job.worktree, "docs.md"), "# Docs\n");
		git(job.worktree, "add", "--all");
		git(job.worktree, "commit", "--quiet", "-m", "docs");
		assert.match((await run("review-needed", [job.id])).out, /^no review: /);
		return job.id;
	};
	return { asked, passed, merge: (...args: string[]) => run("merge", args), head: () => git(root, "rev-parse", "HEAD") };
}

test("wrong usage: no job, --auto with --unreviewed, --no-ci or --decision, a --decision without a value; any merge but --auto may name --decision", async (t) => {
	const { merge, asked } = await load(t);
	for (const [args, problem] of [
		[[], "no job"],
		[["a", "b"], "one job; got 2"],
		[["a", "--auto", "--unreviewed"], "--auto merges only with a PASS, --unreviewed without one: one or the other"],
		[["a", "--auto", "--no-ci"], "--auto merges only with CI passed, --no-ci without it on the owner's decision: one or the other"],
		[["a", "--auto", "--decision", "AC-D1"], "--auto merges by policy, --decision on the owner's word: one or the other"],
		[["a", "--decision"], "--decision needs a value"],
		[["a", "--unreviewed", "--decision", ""], "--decision needs a value"],
		[["a", "--no-ci", "--decision", "--unreviewed"], "--decision needs a value"],
	] as const)
		assert.deepEqual(await merge(...args), { code: 2, out: "", err: `arthur merge: ${problem}\n${USAGE}` }, args.join(" "));
	for (const args of [["--decision", "AC-D1"], ["--auto"], ["--unreviewed", "--decision", "AC-D1"], ["--no-ci", "--decision", "AC-D1"]])
		assert.deepEqual(await merge("a", ...args), { code: 1, out: "", err: "arthur merge: no job a; arthur jobs lists them" }, args.join(" "));
	assert.deepEqual(asked, []);
});

test("after a PASS, a merge asks the owner's decision for itself, a flagged one for each flag until one refuses, --auto for none; each refusal leaves main", async (t) => {
	const { merge, asked, passed, head } = await load(t);
	const job = await passed();
	const start = head();
	const refused = (why: string) => ({ code: 1, out: "", err: `arthur merge: ${why}; main is unchanged` });
	assert.deepEqual(await merge(job), refused(`arthur merge ${job} needs the owner's decision`));
	assert.deepEqual(await merge(job, "--decision", "AC-D9"), refused(`AC-D9 does not let arthur merge ${job} through`));
	assert.deepEqual(await merge(job, "--unreviewed", "--no-ci", "--decision", "AC-D2"), refused("AC-D2 does not let --no-ci through"));
	assert.deepEqual(await merge(job, "--unreviewed", "--no-ci", "--decision", "AC-D3"), refused("AC-D3 does not let --unreviewed through"));
	assert.equal((await merge(job, "--auto")).code, 1, "autoMerge is off here");
	assert.equal(head(), start);
	const of = (id: string, what: string) => ({ id, what, kind: "merge", ticket: "AC0001", job, use: `merge ${job}` });
	assert.deepEqual(asked, [of("", `arthur merge ${job}`), of("AC-D9", `arthur merge ${job}`), of("AC-D2", "--unreviewed"), of("AC-D2", "--no-ci"), of("AC-D3", "--unreviewed")]);
});
