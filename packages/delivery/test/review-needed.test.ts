import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { checkOptions } from "../src/delivery-options.ts";
import { delivery } from "../src/delivery.ts";

const TICKET = "spec/features/AC0001-shop/ticket.md";
const PASSING = "check pass\ntest pass 3/3\n";
const SUMMARY = "✔ shop\nℹ tests 3\nℹ suites 0\nℹ pass 3\nℹ fail 0\nℹ duration_ms 5\n";
const FILES: Readonly<Record<string, string>> = {
	"package.json": `${JSON.stringify({ scripts: { check: "tsc", test: "node --test" } })}\n`,
	"src/env.ts": "export const env = 1;\n",
	"src/shop.ts": "export const shop = 1;\n",
	"README.md": "# acme\n",
	"docs/guide.md": "# Guide\n",
	"test/shop.test.ts": "// shop\n",
	[TICKET]: '# AC0001\n\n```json\n{ "id": "AC0001" }\n```\n',
	"spec/build.json": JSON.stringify([{ id: "AC0001", title: "Shop", status: "planned", path: TICKET, updated: "2026-01-01T00:00:00Z" }]),
};

// The repository `acme` (prefix AC) with FILES and ticket AC0001, delivery set up on the fake host with `options`, and a worker
// on AC0001 that ran the project's checks, ended. `branch(change)` makes the worker's branch the main checkout's HEAD and one
// commit of `change` in its worktree (none when it changes nothing); `decide(checks)` writes the job's `checks` (none when
// undefined) and runs `arthur review-needed` on it, as the CLI does: a throw is `arthur review-needed: <message>`, exit 1.
async function load(t: TestContext, options: Parameters<typeof delivery>[0] = {}) {
	const root = join(temporaryFolder(), "acme");
	for (const [path, text] of Object.entries(FILES)) {
		mkdirSync(join(root, dirname(path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8" }).trim();
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const base = git(root, "rev-parse", "HEAD");
	const path = process.env.PATH;
	t.after(() => void (process.env.PATH = path));
	const steps = [{ tool: "bash", args: { command: "npm run check && npm test 2>&1 | tail -6" }, output: SUMMARY }, { message: "Done." }];
	process.env.PATH = `${dirname(fakeAgent({ steps }))}${delimiter}${path}`;
	const fake = fakeHost({ name: "delivery", root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	await fake.setup(delivery(options));
	const home = dirname(fake.host.folder);
	const state = (id: string) => (existsSync(join(home, "jobs", id, "state")) ? readFileSync(join(home, "jobs", id, "state"), "utf8") : "");
	const ended = async (id: string) => {
		for (const deadline = Date.now() + 15_000; state(id) !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
	};
	const job = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}` });
	await ended(job.id);
	const checks = join(fake.host.folder, job.id, "checks");
	const recorded = readFileSync(checks, "utf8");
	const branch = (change: (at: (path: string) => string) => void) => {
		git(job.worktree, "reset", "--hard", "--quiet", base);
		change((path) => join(job.worktree, path));
		git(job.worktree, "add", "--all");
		if (git(job.worktree, "status", "--porcelain") !== "") git(job.worktree, "commit", "--quiet", "-m", "change");
	};
	const command = fake.commands.find((each) => each.name === "review-needed");
	const decide = async (written?: string, ...args: string[]) => {
		if (written === undefined) rmSync(checks, { force: true });
		else writeFileSync(checks, written);
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args: args.length > 0 ? args : [job.id], project: undefined })).catch((error: Error) => (err.push(`arthur review-needed: ${error.message}`), 1));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n") };
	};
	return { root, git, fake, job, base, recorded, branch, decide, ended, status: () => fake.host.board.get("AC0001")?.status };
}

type At = (path: string) => string;
const edit = (path: string, text: string) => (at: At) => writeFileSync(at(path), text);
const both = (...changes: ((at: At) => void)[]) => (at: At) => changes.forEach((change) => change(at));
const small = edit("src/shop.ts", "export const shop = 2;\n");
const lines = (count: number, first = "export const shop = 1;\n") => first + Array.from({ length: count }, (_, n) => `export const a${n} = ${n};\n`).join("");

// The table of branches: what each changes from the main checkout's HEAD, the job's checks, and the decision.
const BRANCHES: readonly (readonly [string, (at: At) => void, string | undefined, string])[] = [
	["a file on the always-review list", edit("src/env.ts", "export const env = 2;\n"), PASSING, "review: src/env.ts is on the always-review list"],
	["a renamed file on the list", (at) => renameSync(at("src/env.ts"), at("src/settings.ts")), PASSING, "review: src/env.ts is on the always-review list"],
	["a file renamed onto the list", (at) => renameSync(at("src/shop.ts"), at("src/ci-failure.ts")), PASSING, "review: src/ci-failure.ts is on the always-review list"],
	["a deleted file", (at) => rmSync(at("src/shop.ts")), PASSING, "review: deletes src/shop.ts"],
	["a renamed file off the list", (at) => renameSync(at("src/shop.ts"), at("src/store.ts")), PASSING, "review: deletes src/shop.ts"],
	["a docs-only branch that also deletes a file", both(edit("README.md", "# acme shop\n"), (at) => rmSync(at("docs/guide.md"))), PASSING, "review: deletes docs/guide.md"],
	["a .env file", edit(".env.example", "SHOP_KEY=\n"), PASSING, "review: changes .env.example"],
	[".env in a changed line of code", edit("src/shop.ts", 'export const shop = readFileSync(".env", "utf8");\n'), PASSING, "review: the diff mentions .env in src/shop.ts"],
	[
		".env as text in docs and tests only, process.env in code",
		both(edit("README.md", "# acme\n\nCopy .env.example to .env.\n"), edit("test/shop.test.ts", "// reads .env\n"), edit("src/shop.ts", "export const shop = process.env.SHOP;\n")),
		PASSING,
		"no review: 6 lines changed; the job's checks: check pass, test pass 3/3",
	],
	["docs only", both(edit("README.md", "# acme shop\n"), edit("docs/guide.md", "# The guide\n")), undefined, "no review: 2 files, all docs (*.md)"],
	["31 lines", edit("src/shop.ts", lines(30, "")), PASSING, "review: 31 lines changed, over 30"],
	["30 lines with passing checks", edit("src/shop.ts", lines(30)), PASSING, "no review: 30 lines changed; the job's checks: check pass, test pass 3/3"],
	["small, no checks recorded", small, undefined, "review: 2 lines changed; the job recorded no checks"],
	["small, a file changed after the checks", small, `${PASSING}stale\n`, "review: 2 lines changed; a file changed after the job's checks (stale)"],
	["small, two runs each made stale by a later edit", small, `${PASSING}stale\ncheck fail\ntest fail 1/3\nstale\n`, "review: 2 lines changed; a file changed after the job's checks (stale)"],
	["small, the checks run again after a change", small, `check fail\nstale\n${PASSING}`, "no review: 2 lines changed; the job's checks: check pass, test pass 3/3"],
	["small, a failing test", small, "check pass\ntest fail 2/3\n", "review: 2 lines changed; the job's checks: check pass, test fail 2/3"],
	["small, only the check ran", small, "check pass\n", "review: 2 lines changed; the job's checks: check pass, no test"],
	["small, the tip's package.json declares no script", edit("package.json", "{}\n"), PASSING, "review: 2 lines changed; the project's package.json declares no check or test script"],
	["small, a broken package.json", edit("package.json", "{ broken\n"), PASSING, "review: 2 lines changed; the project's package.json declares no check or test script"],
];

test("the table of branches: each decided by the first rule that holds", async (t) => {
	const { branch, decide, recorded } = await load(t);
	assert.equal(recorded, PASSING, "delivery's extension recorded the worker's own run of the checks");
	for (const [what, change, checks, answer] of BRANCHES) {
		branch(change);
		const decided = await decide(checks);
		assert.deepEqual([decided.code, decided.out.split("\n")[0], decided.err], [undefined, answer, ""], what);
	}
});

test("no review moves the ticket to done, keeps the answer and asks github.push to push the branch; review keeps it too and moves and pushes nothing; a branch with no commits is refused", async (t) => {
	const { root, fake, job, branch, decide, status, git } = await load(t);
	const name = job.branch ?? "";
	const pushes: unknown[] = [];
	fake.provide("github.push", (asked: unknown) => (pushes.push(asked), Promise.resolve(`github: pushed ${name} to origin: [new branch]`)));
	assert.equal(status(), "in-progress");
	branch(edit("README.md", "# acme shop\n"));
	const tip = git(root, "rev-parse", name);
	assert.deepEqual(await decide(undefined, job.id.slice(-8)), { code: undefined, out: `no review: 1 file, all docs (*.md)\nAC0001 moves to done.\ngithub: pushed ${name} to origin: [new branch]`, err: "" });
	assert.deepEqual(pushes, [{ project: "acme", branch: name }]);
	assert.equal(status(), "done");
	assert.deepEqual(fake.emitted.filter((event) => event.name === "ticket-moved").map((event) => event.data), [{ id: "AC0001", project: "acme", from: "in-progress", to: "done" }]);
	const kept = () => JSON.parse(readFileSync(join(fake.host.folder, job.id, "review-needed"), "utf8")) as { readonly answer: string; readonly at: number };
	assert.deepEqual({ ...kept(), at: 0 }, { answer: "no review: 1 file, all docs (*.md)", ticket: "AC0001", branch: name, commit: tip, at: 0 });
	branch(small);
	assert.deepEqual(await decide(), { code: undefined, out: "review: 2 lines changed; the job recorded no checks", err: "" });
	assert.equal(pushes.length, 1, "review pushes nothing: the review's PASS does");
	assert.equal(kept().answer, "review: 2 lines changed; the job recorded no checks", "the newest answer, for its tip");
	assert.equal(status(), "done", "a review's start moves it, not review-needed");
	branch(() => {});
	const short = git(root, "rev-parse", "--short", name);
	assert.deepEqual(await decide(), { code: 1, out: "", err: `arthur review-needed: ${name} at ${short} adds nothing to HEAD (${short}): nothing to review` });
	branch(edit("README.md", "# acme shop\n"));
	fake.host.board.move("AC0001", "merged");
	assert.deepEqual(await decide(), { code: 1, out: "", err: "arthur review-needed: AC0001: merged cannot move to done; from merged: none, it is final" });
	assert.equal(kept().answer, "review: 2 lines changed; the job recorded no checks", "a refused move keeps no answer");
	assert.equal(pushes.length, 1, "a refused move pushes nothing");
});

test("refused: wrong usage, no such job, a job with no ticket", async (t) => {
	const { decide, fake, ended } = await load(t);
	assert.deepEqual(await decide(undefined, "a", "b"), { code: 2, out: "", err: "arthur review-needed: one job; got 2\nusage: arthur review-needed <worker job>" });
	assert.equal((await decide(undefined, "--all")).err, "arthur review-needed: unknown flag --all\nusage: arthur review-needed <worker job>");
	assert.equal((await decide(undefined, "nope")).err, "arthur review-needed: no job nope; arthur jobs lists them");
	const loose = await fake.host.jobs.spawn({ task: "No ticket here." });
	await ended(loose.id);
	assert.equal((await decide(undefined, loose.id)).err, `arthur review-needed: ${loose.id}'s task names no ticket; a review is of one ticket's branch`);
});

test("the always-review list: review.alwaysReview replaces the default, and delivery.alwaysReview answers the paths on it", async (t) => {
	const { fake, branch, decide } = await load(t, { review: { alwaysReview: ["docs/**"] } });
	branch(edit("docs/guide.md", "# The guide\n"));
	assert.equal((await decide()).out, "review: docs/guide.md is on the always-review list");
	assert.deepEqual(fake.call("delivery.alwaysReview", { project: "acme", paths: ["docs/guide.md", "src/env.ts", "README.md"] }), ["docs/guide.md"]);
	const plain = fakeHost({ name: "delivery" });
	await plain.setup(delivery());
	const paths = ["src/env.ts", "packages/core/src/env-guard.ts", ".github/workflows/ci.yml", "packages/github/src/ci-failure.ts", "packages/delivery/roles/reviewer.md", "src/shop.ts", "src/environment.ts"];
	assert.deepEqual(plain.call("delivery.alwaysReview", { project: "acme", paths }), paths.slice(0, 5), "the default: what reads secrets, the CI-failure handling, the review rules");
});

const REPOSITORY = new URL("../../../", import.meta.url);
const CI_FAILURE_FILES = ["packages/github/src/github-ci.ts", "packages/delivery/src/auto-merge.ts", "packages/delivery/src/merge-command.ts", "packages/delivery/src/ci-wait.ts"];

test("the default always-review list holds every file of the CI-failure handling, entries 57 to 59, as this repository has them", async () => {
	assert.deepEqual(CI_FAILURE_FILES.filter((path) => !existsSync(new URL(path, REPOSITORY))), [], "each file is where the list expects it");
	const plain = fakeHost({ name: "delivery" });
	await plain.setup(delivery());
	assert.deepEqual(plain.call("delivery.alwaysReview", { project: "acme", paths: CI_FAILURE_FILES }), CI_FAILURE_FILES);
});

test("arthur.config.example.ts gives delivery only options it accepts, its list holding every file of the CI-failure handling", async () => {
	const example = readFileSync(new URL("arthur.config.example.ts", REPOSITORY), "utf8");
	const call = /\n\t\tdelivery\((\{[\s\S]*?\n\t\t\})\),\n/.exec(example);
	assert.ok(call, "the example calls delivery({ ... })");
	const options = Function(`return (${call[1]});`)();
	assert.deepEqual(checkOptions(options), []);
	const plain = fakeHost({ name: "delivery" });
	await plain.setup(delivery(options));
	assert.deepEqual(plain.call("delivery.alwaysReview", { project: "acme", paths: CI_FAILURE_FILES }), CI_FAILURE_FILES);
});

test("the options: only review.alwaysReview, a list of glob patterns from a project's root", () => {
	assert.deepEqual(checkOptions({ review: { alwaysReview: ["**/env.ts"] } }), []);
	const expected = 'expected a list of glob patterns from a project\'s root, such as "**/env.ts", got';
	assert.deepEqual(checkOptions({ merge: {}, review: { alwaysReview: ["", "/etc/x"], always: [] } }), [
		{ path: "merge", problem: "unknown option; options: review" },
		{ path: "review.alwaysReview", problem: `${expected} a list` },
		{ path: "review.always", problem: "unknown key; keys: alwaysReview" },
	]);
	assert.deepEqual(checkOptions({ review: ["**"] }), [{ path: "review", problem: "expected an object { alwaysReview? }, got a list" }]);
	assert.deepEqual(checkOptions({ review: { alwaysReview: "**/env.ts" } }), [{ path: "review.alwaysReview", problem: `${expected} "**/env.ts"` }]);
});
