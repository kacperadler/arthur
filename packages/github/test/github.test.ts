import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type GithubOptions, github } from "../src/github.ts";
import { DOCS, type FakePull, type FakeRun, fakeGithub } from "./fake-github.ts";

// The github plugin against the fake host and a fake GitHub REST API (fake-github.ts). Each project is a real repository whose
// origin names its GitHub repository; polls run every second.

const TOKEN = "github_pat_11ARTHUR0test0Never0Printed0abcdefghijklmnopqrstuvwxyz";
const ACME_TOKEN = "ghp_AcmeT0kenNeverPrinted0123456789abcdef";

async function until<T>(what: string, predicate: () => T | undefined | false): Promise<T> {
	for (const end = Date.now() + 20_000; Date.now() < end; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const git = (path: string, ...args: readonly string[]) => execFileSync("git", ["-C", path, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { encoding: "utf8" }).trim();

// A repository on branch main with one commit and `origin` set; `commit(branch?)` adds an empty commit (on `branch`, made from
// main when missing) and returns its sha.
function repository(origin: string | null = "git@github.com:acme/shop.git") {
	const path = temporaryFolder();
	git(path, "init", "--quiet", "--initial-branch=main");
	if (origin !== null) git(path, "remote", "add", "origin", origin);
	git(path, "commit", "--quiet", "--allow-empty", "-m", "first");
	const commit = (branch = "main") => {
		git(path, "checkout", "--quiet", ...(git(path, "branch", "--list", branch) === "" ? ["-b", branch, "main"] : [branch]));
		git(path, "commit", "--quiet", "--allow-empty", "-m", `on ${branch}`);
		const sha = git(path, "rev-parse", "HEAD");
		git(path, "checkout", "--quiet", "main");
		return sha;
	};
	return { path, commit, head: () => git(path, "rev-parse", "main") };
}

type Project = { readonly name: string; readonly path: string; readonly prefix: string; readonly ci?: { readonly workflow: string } };

// The plugin set up on a fake host with `projects` and started; stopped at the end. `record` writes a job's record as the core
// does, which the plugin reads through `host.jobs.list()`; `ci` runs `arthur ci` and gives its exit code and output.
async function started(t: TestContext, projects: readonly Project[], options: GithubOptions, env: Readonly<Record<string, string>> = { ARTHUR_GITHUB_TOKEN: TOKEN }, fake?: FakeHost) {
	const errors: string[] = [];
	const out: string[] = [];
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	t.mock.method(console, "log", (text: string) => void out.push(text));
	const host = fake ?? fakeHost({ name: "github", options, env });
	if (fake === undefined) host.provide("projects", () => projects);
	const plugin = github(options);
	await host.setup(plugin);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	const home = dirname(host.host.folder);
	const record = (id: string, project: string, branch: string) => {
		mkdirSync(join(home, "jobs", id), { recursive: true });
		for (const [key, value] of Object.entries({ kind: "worker", project, branch, state: "working" })) writeFileSync(join(home, "jobs", id, key), value);
	};
	const finished = () => host.emitted.filter((event) => event.name === "ci-finished").map((event) => event.data as { readonly run: number; readonly attempt: number; readonly branches: readonly string[] });
	const notices = () => host.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { readonly text: string }).text);
	const messages = () => host.emitted.filter((event) => event.name === "coordinator-message").map((event) => (event.data as { readonly text: string }).text);
	const ci = async (...args: string[]) => {
		const [said, failed] = [out.length, errors.length];
		const code = await host.commands.find((command) => command.name === "ci")?.run({ args, project: undefined });
		return { code: code ?? 0, out: out.slice(said).join("\n"), err: errors.slice(failed).join("\n") };
	};
	return { fake: host, plugin, record, finished, notices, messages, ci, errors, home };
}

const PATH = "/repos/acme/shop/actions/workflows/ci.yml/runs";
const options = (apiUrl: string, more: Partial<GithubOptions> = {}): GithubOptions => ({ instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN", apiUrl }], poll: { everySeconds: 1 }, ...more });

test("a finished run is told once per run attempt, across polls and a restart, and wakes the coordinator; a rerun's end is told once; what finished before the first poll is not told; the token stays out", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const project = { name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } };
	const branch = shop.commit("arthur/one");
	api.runs["acme/shop/ci.yml"] = [{ id: 11, sha: shop.head(), branch: "main", status: "completed", conclusion: "success" }];
	const first = await started(t, [project], options(api.apiUrl));
	first.record("2026-01-01-worker-0000000a", "shop", "arthur/one");
	await until("two polls", () => api.count(PATH) >= 2);
	assert.deepEqual(first.finished(), [], "main's run finished before the first poll");
	const one: FakeRun = { id: 12, sha: branch, branch: "arthur/one", status: "in_progress", conclusion: null };
	api.runs["acme/shop/ci.yml"]?.unshift(one);
	await until("a poll that sees it running", () => api.count(PATH) >= 4);
	[one.status, one.conclusion] = ["completed", "failure"];
	await until("ci-finished", () => first.finished().length === 1);
	assert.deepEqual(first.finished(), [
		{ project: "shop", repo: "acme/shop", workflow: "ci.yml", run: 12, attempt: 1, sha: branch, branch: "arthur/one", branches: ["arthur/one"], conclusion: "failure", url: "https://github.com/acme/shop/actions/runs/12" },
	]);
	const ci = "arthur ci arthur/one --project shop";
	assert.deepEqual(first.messages(), [`[github] CI run 12, attempt 1, of ci.yml in shop ended failure on arthur/one (${branch.slice(0, 7)}): https://github.com/acme/shop/actions/runs/12\nWhy: ${ci}; rerun it once: ${ci} --rerun`]);
	const polls = api.count(PATH);
	await until("two more polls", () => api.count(PATH) >= polls + 2);
	assert.equal(first.finished().length, 1, "the same run seen on two more polls is not told again");
	await first.plugin.stop?.();
	const main = shop.commit();
	api.runs["acme/shop/ci.yml"]?.unshift({ id: 13, sha: main, branch: "main", status: "completed", conclusion: "success" });
	// A restart is a new process: a new host on the state file the first one left.
	const again = fakeHost({ name: "github", options: options(api.apiUrl), env: { ARTHUR_GITHUB_TOKEN: TOKEN } });
	again.provide("projects", () => [project]);
	copyFileSync(join(first.fake.host.folder, "state.json"), join(again.host.folder, "state.json"));
	const restarted = await started(t, [project], options(api.apiUrl), undefined, again);
	restarted.record("2026-01-01-worker-0000000a", "shop", "arthur/one");
	const before = api.count(PATH);
	await until("the run that finished while stopped", () => restarted.finished().length === 1);
	await until("two polls after the restart", () => api.count(PATH) >= before + 2);
	assert.deepEqual(restarted.finished().map((event) => [event.run, event.attempt, event.branches]), [[13, 1, ["main"]]], "run 12 is not told again after the restart");
	assert.deepEqual(await restarted.ci("arthur/one", "--rerun"), {
		code: 0,
		out: `run 12, attempt 1, of ci.yml on ${branch.slice(0, 7)} (arthur/one's tip): failure\nhttps://github.com/acme/shop/actions/runs/12\nrerun of run 12 asked: its attempt 2 is told as ci-finished when it ends`,
		err: "",
	});
	assert.deepEqual([one.attempt, one.status], [2, "queued"]);
	const queued = api.count(PATH);
	await until("a poll that sees the rerun queued", () => api.count(PATH) >= queued + 1);
	[one.status, one.conclusion] = ["completed", "failure"];
	await until("the rerun's end", () => restarted.finished().length === 2);
	const after = api.count(PATH);
	await until("two polls after the rerun's end", () => api.count(PATH) >= after + 2);
	assert.deepEqual(
		restarted.finished().map((event) => [event.run, event.attempt]),
		[
			[13, 1],
			[12, 2],
		],
		"the rerun's end is told once, with its attempt",
	);
	assert.deepEqual(JSON.parse(readFileSync(join(again.host.folder, "state.json"), "utf8")).runs, { shop: ["13/1", "12/2", "11/1"] });
	const second = await restarted.ci("arthur/one", "--rerun");
	assert.deepEqual([second.code, second.err], [1, "arthur ci: run 12 was rerun before (attempt 2); arthur ci reruns a run once, and a further rerun is the owner's, on GitHub"]);
	assert.equal(api.seen.filter((each) => each.method === "POST").length, 1, "the second --rerun asks GitHub nothing");
	assert.ok(api.seen.every((each) => each.auth === `Bearer ${TOKEN}`));
	const files = [join(first.home, "events.jsonl"), ...[first.fake, again].flatMap(({ host }) => readdirSync(host.folder).map((name) => join(host.folder, name)))];
	for (const file of files) assert.ok(!readFileSync(file, "utf8").includes(TOKEN), file);
	assert.ok(!JSON.stringify([first.errors, restarted.errors]).includes(TOKEN));
});

test("a commit with no run of its own has the run of the nearest commit before it, for the poll and arthur ci; two branches on one run are one event; wakeOn [] wakes nobody", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const built = shop.commit("arthur/two");
	const docs = shop.commit("arthur/two");
	const run: FakeRun = { id: 21, sha: built, branch: "arthur/two", status: "in_progress", conclusion: null };
	const main: FakeRun = { id: 20, sha: shop.head(), branch: "main", status: "queued", conclusion: null };
	api.runs["acme/shop/ci.yml"] = [run, main];
	const box = await started(t, [{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } }], options(api.apiUrl, { wakeOn: [] }));
	box.record("2026-01-01-worker-0000000b", "shop", "arthur/two");
	box.record("2026-01-01-worker-0000000c", "shop", "arthur/fresh");
	git(shop.path, "branch", "arthur/fresh", "main");
	box.record("2026-01-01-worker-0000000d", "other", "arthur/elsewhere");
	await until("a poll", () => api.count(PATH) >= 2);
	[run.status, run.conclusion, main.status, main.conclusion] = ["completed", "success", "completed", "success"];
	await until("both runs told", () => box.finished().length === 2);
	assert.deepEqual(
		box.finished().map((event) => [event.run, event.branches]),
		[
			[20, ["main", "arthur/fresh"]],
			[21, ["arthur/two"]],
		],
	);
	assert.notEqual(docs, built, "arthur/two's tip has no run");
	assert.deepEqual(box.messages(), [], "wakeOn [] wakes the coordinator on nothing");
	assert.deepEqual(await box.ci("arthur/two"), {
		code: 0,
		out: `run 21, attempt 1, of ci.yml on ${built.slice(0, 7)} (arthur/two, 1 commit below its tip): success\nhttps://github.com/acme/shop/actions/runs/21`,
		err: "",
	});
});

test("a branch deleted while in play leaves it: its run is not told, nothing is said, the others go on", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const gone: FakeRun = { id: 31, sha: shop.commit("arthur/gone"), branch: "arthur/gone", status: "in_progress", conclusion: null };
	const kept: FakeRun = { id: 32, sha: shop.commit("arthur/kept"), branch: "arthur/kept", status: "in_progress", conclusion: null };
	api.runs["acme/shop/ci.yml"] = [kept, gone];
	const box = await started(t, [{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } }], options(api.apiUrl));
	box.record("2026-01-01-worker-0000000e", "shop", "arthur/gone");
	box.record("2026-01-01-worker-0000000f", "shop", "arthur/kept");
	await until("a poll", () => api.count(PATH) >= 2);
	git(shop.path, "branch", "--quiet", "-D", "arthur/gone");
	[gone.status, gone.conclusion, kept.status, kept.conclusion] = ["completed", "success", "completed", "success"];
	await until("the kept branch's run", () => box.finished().length === 1);
	const polls = api.count(PATH);
	await until("two more polls", () => api.count(PATH) >= polls + 2);
	assert.deepEqual(
		box.finished().map((event) => event.run),
		[32],
	);
	assert.deepEqual([box.notices(), box.errors], [[], []]);
});

test("a 401 is said once, not every poll, for every project of the instance; once GitHub answers, a new 401 is said again", async (t) => {
	const api = await fakeGithub(t);
	const [shop, site] = [repository(), repository("https://github.com/acme/site")];
	api.runs["acme/shop/ci.yml"] = [];
	api.runs["acme/site/build.yml"] = [];
	api.state.always = { status: 401, body: { message: "Bad credentials", documentation_url: DOCS, status: "401" } };
	const projects = [
		{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } },
		{ name: "site", path: site.path, prefix: "SI", ci: { workflow: "build.yml" } },
		{ name: "plain", path: repository(null).path, prefix: "PL" },
	];
	const box = await started(t, projects, options(api.apiUrl));
	await until("three polls", () => api.count(PATH) >= 3 && api.count("/repos/acme/site/") >= 3);
	const said = "github: instance (unnamed): 401: the token in ARTHUR_GITHUB_TOKEN was refused: Bad credentials; polling goes on and says this again only after GitHub answered";
	assert.deepEqual(box.notices(), [said]);
	api.state.always = undefined;
	const polls = api.count(PATH);
	// Rounds ask the projects in turn: shop asked twice more means site was answered in between.
	await until("a round that GitHub answers", () => api.count(PATH) >= polls + 2);
	api.state.always = { status: 401, body: { message: "Bad credentials", documentation_url: DOCS, status: "401" } };
	await until("the second 401's notice", () => box.notices().length === 2);
	assert.deepEqual(box.notices(), [said, said]);
	assert.deepEqual(box.errors, []);
});

test("a rate limit stops the instance's requests until the time GitHub says: x-ratelimit-reset, then retry-after", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	api.runs["acme/shop/ci.yml"] = [];
	const reset = Math.ceil(Date.now() / 1000) + 3;
	const limited = { message: "API rate limit exceeded for user ID 1.", documentation_url: "https://docs.github.com/rest/overview/rate-limits-for-the-rest-api", status: "403" };
	api.next.push({ status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) }, body: limited });
	const box = await started(t, [{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } }], options(api.apiUrl));
	await until("the request after the reset", () => api.count(PATH) >= 2);
	assert.ok((api.seen[1]?.at ?? 0) >= reset * 1000, "no request before x-ratelimit-reset");
	api.next.push({ status: 429, headers: { "retry-after": "2" }, body: { message: "You have exceeded a secondary rate limit.", documentation_url: DOCS, status: "429" } });
	await until("the request after retry-after", () => api.count(PATH) >= 4);
	const [limitedAt, resumed] = [api.seen[2]?.at ?? 0, api.seen[3]?.at ?? 0];
	assert.ok(resumed - limitedAt >= 2000, `${resumed - limitedAt} ms between the 429 and the next request`);
	assert.deepEqual(box.notices(), [], "a rate limit is no notice");
	assert.equal(box.errors.length, 2);
	assert.match(box.errors[0] ?? "", /^github: instance \(unnamed\): 403, rate limited: API rate limit exceeded for user ID 1\.; no request until /);
});

test("a project's instance is the one named after its repository's owner, else the unnamed one; setup refusals name the project", async (t) => {
	const api = await fakeGithub(t);
	const [shop, other] = [repository("git@github.com:Acme/shop.git"), repository("ssh://git@github.com/someone/tool.git")];
	api.runs["Acme/shop/ci.yml"] = [];
	api.runs["someone/tool/ci.yml"] = [];
	const instances = [
		{ tokenEnv: "ARTHUR_GITHUB_TOKEN", apiUrl: api.apiUrl },
		{ name: "acme", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN", apiUrl: api.apiUrl },
	];
	const projects = [
		{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } },
		{ name: "tool", path: other.path, prefix: "TO", ci: { workflow: "ci.yml" } },
	];
	await started(t, projects, { instances, poll: { everySeconds: 1 } }, { ARTHUR_GITHUB_TOKEN: TOKEN, ARTHUR_GITHUB_ACME_TOKEN: ACME_TOKEN });
	await until("both polled", () => api.count("/repos/Acme/") >= 1 && api.count("/repos/someone/") >= 1);
	assert.equal(api.seen.find((each) => each.path.startsWith("/repos/Acme/"))?.auth, `Bearer ${ACME_TOKEN}`);
	assert.equal(api.seen.find((each) => each.path.startsWith("/repos/someone/"))?.auth, `Bearer ${TOKEN}`);
	const refused = async (list: readonly Project[], named: GithubOptions["instances"], env: Readonly<Record<string, string>> = { ARTHUR_GITHUB_TOKEN: TOKEN }) => {
		const fake = fakeHost({ name: "github", options: { instances: named }, env });
		fake.provide("projects", () => list);
		return fake.setup(github({ instances: named })).then(
			() => "set up",
			(error: Error) => error.message,
		);
	};
	const acme = [{ name: "acme", tokenEnv: "ARTHUR_GITHUB_TOKEN" }];
	assert.equal(await refused(projects, acme), "project tool: no instance of github is named someone, the owner of someone/tool, and none is unnamed; github's instances: acme");
	assert.equal(await refused([{ ...projects[0], path: repository(null).path } as Project], acme), "project shop: ci.workflow is set, but its checkout has no origin remote to name its GitHub repository");
	assert.equal(await refused([{ ...projects[0], path: repository("https://user:secret@example.com/shop").path } as Project], acme), "project shop: its origin remote names no <owner>/<repository>");
	assert.equal(await refused(projects, [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }], {}), "instances[0].tokenEnv: ARTHUR_GITHUB_TOKEN is empty or holds a space or a character outside ASCII, which a header cannot carry");
	assert.equal(await refused([{ name: "plain", path: repository(null).path, prefix: "PL" }], [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }]), "set up", "a project without ci is not watched");
});

test("arthur ci tells why a run failed: each failed job and its step, and the end of the first one's log up to its last error; a long log its end only", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const sha = shop.commit("arthur/red");
	const red: FakeRun = { id: 41, sha, branch: "arthur/red", status: "completed", conclusion: "failure" };
	api.runs["acme/shop/ci.yml"] = [red];
	const stamp = (line: string) => `2026-01-01T00:00:01.1234567Z ${line}`;
	const tests = Array.from({ length: 500 }, (_, index) => `test ${index + 1} ok`);
	const long = `${[...tests, "##[error]Process completed with exit code 1.", "Post job cleanup.", "Cleaning up orphan processes"].map(stamp).join("\r\n")}\r\n`;
	api.jobs[41] = [
		{ id: 401, name: "build", conclusion: "success", steps: [{ name: "Run npm ci", conclusion: "success" }], log: "" },
		{ id: 402, name: "test", conclusion: "failure", steps: ["Set up job", "Run npm test", "Post Run actions/checkout@v4"].map((name, index) => ({ name, conclusion: index === 1 ? "failure" : "success" })), log: long },
		{ id: 403, name: "lint", conclusion: "failure", steps: [{ name: "Run npm run check", conclusion: "failure" }], log: stamp("x") },
	];
	const box = await started(t, [{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } }], options(api.apiUrl));
	const why = await box.ci("arthur/red");
	assert.deepEqual([why.code, why.err], [0, ""]);
	assert.deepEqual(why.out.split("\n"), [
		`run 41, attempt 1, of ci.yml on ${sha.slice(0, 7)} (arthur/red's tip): failure`,
		"https://github.com/acme/shop/actions/runs/41",
		"job test: failure, step 2, Run npm test, failed",
		"job lint: failure, step 1, Run npm run check, failed",
		"the log of job test, its 30 lines up to its last error of 503:",
		...tests.slice(-29),
		"##[error]Process completed with exit code 1.",
	]);
	assert.equal(api.count("/repos/acme/shop/actions/jobs/403/logs"), 0, "only the first failed job's log is asked");
	api.jobs[41] = [{ id: 404, name: "test", conclusion: "failure", steps: [], log: ["one", "two"].map(stamp).join("\n") }];
	assert.equal((await box.ci("arthur/red")).out.split("\n").slice(2).join("\n"), "job test: failure, no step failed\nthe log of job test:\none\ntwo", "a short log whole, with no error line");
	assert.equal(api.count("/repos/acme/shop/pulls"), 0, "pull requests are not polled while wakeOn does not name pull-request-review");
});

test("arthur ci refuses: a rerun of a passed run or one not finished, a project without ci, a missing branch, a branch no run built, GitHub's refusal; wrong usage", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const main: FakeRun = { id: 50, sha: shop.head(), branch: "main", status: "completed", conclusion: "success" };
	api.runs["acme/shop/ci.yml"] = [main];
	const projects = [
		{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } },
		{ name: "plain", path: repository(null).path, prefix: "PL" },
	];
	const box = await started(t, projects, options(api.apiUrl));
	const refused = async (...args: string[]) => {
		const ran = await box.ci(...args);
		return [ran.code, ran.err];
	};
	assert.deepEqual(await refused("main", "--rerun"), [1, "arthur ci: run 50 passed; only a run that failed or was cancelled is rerun"]);
	[main.status, main.conclusion] = ["in_progress", null];
	assert.deepEqual(await refused("main", "--rerun"), [1, "arthur ci: run 50 is in_progress, not finished; only a run that failed or was cancelled is rerun"]);
	assert.deepEqual(await box.ci("main"), { code: 0, out: `run 50, attempt 1, of ci.yml on ${main.sha.slice(0, 7)} (main's tip): in_progress\nhttps://github.com/acme/shop/actions/runs/50`, err: "" });
	[main.status, main.conclusion] = ["completed", "cancelled"];
	api.state.post = { status: 403, body: { message: "Resource not accessible by personal access token", documentation_url: DOCS, status: "403" } };
	assert.deepEqual(await refused("main", "--rerun"), [1, "arthur ci: instance (unnamed): 403 for run 50 of acme/shop: Resource not accessible by personal access token; the token in ARTHUR_GITHUB_TOKEN needs Actions: read and write on it"]);
	assert.deepEqual(await refused("arthur/none"), [1, `arthur ci: no branch arthur/none in ${shop.path}`]);
	api.runs["acme/shop/ci.yml"] = [];
	assert.deepEqual(await refused("main"), [1, "arthur ci: no run built main: none of its last 1000 commits has one among the 0 newest runs of ci.yml"]);
	const ci = box.fake.commands.find((command) => command.name === "ci");
	assert.equal(await ci?.run({ args: ["main"], project: "plain" }), 1);
	assert.equal(box.errors.at(-1), "arthur ci: project plain has no ci.workflow, so github watches no run of it");
	for (const [args, why] of [
		[[], "no branch"],
		[["main", "arthur/x"], "one branch; got 2"],
		[["main", "--force"], "unknown flag --force"],
	] as const)
		assert.deepEqual(await refused(...args), [2, `arthur ci: ${why}\nusage: arthur ci <branch> [--rerun] [--project <name>]`]);
});

test("github.push pushes a branch to origin, one line; a push rejected as non-fast-forward, no remote, or one that would ask for a credential is one warning line, never a prompt", async (t) => {
	const api = await fakeGithub(t);
	// An askpass program that notes it was asked, where git and ssh look for one, and git's terminal prompt left on: a push may
	// still never ask.
	const askpass = join(temporaryFolder(), "askpass");
	writeFileSync(askpass, `#!/bin/sh\ntouch "${askpass}.asked"\necho arthur\n`, { mode: 0o755 });
	const env: Readonly<Record<string, string | undefined>> = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_ASKPASS: askpass, SSH_ASKPASS: askpass, GIT_TERMINAL_PROMPT: undefined };
	for (const [name, value] of Object.entries(env)) {
		const was = process.env[name];
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
		t.after(() => (was === undefined ? delete process.env[name] : (process.env[name] = was)));
	}
	const origin = temporaryFolder();
	git(origin, "init", "--quiet", "--bare", "--initial-branch=main");
	const local = repository(origin);
	const asks = createServer((_, response) => response.writeHead(401, { "www-authenticate": 'Basic realm="GitHub"' }).end());
	await once(asks.listen(0, "127.0.0.1"), "listening");
	t.after(() => asks.close());
	const port = (asks.address() as AddressInfo).port;
	const projects = [
		{ name: "local", path: local.path, prefix: "LO" },
		{ name: "alone", path: repository(null).path, prefix: "AL" },
		{ name: "asks", path: repository(`http://127.0.0.1:${port}/acme/shop.git`).path, prefix: "AS" },
		{ name: "secret", path: repository(`http://arthur:s3cr3t@127.0.0.1:${port}/acme/shop.git`).path, prefix: "SE" },
	];
	const box = await started(t, projects, options(api.apiUrl));
	const push = (project: string, branch = "main") => box.fake.call<Promise<string>>("github.push", { project, branch });
	assert.equal(await push("local"), "github: pushed main to origin: [new branch]");
	const sha = local.commit("arthur/ok");
	assert.equal(await push("local", "arthur/ok"), "github: pushed arthur/ok to origin: [new branch]");
	assert.equal(git(origin, "rev-parse", "arthur/ok"), sha);
	local.commit();
	assert.match(await push("local"), /^github: pushed main to origin: [0-9a-f]{7,}\.\.[0-9a-f]{7,}$/);
	assert.equal(await push("local"), "github: pushed main to origin: [up to date]");
	const other = temporaryFolder();
	execFileSync("git", ["clone", "--quiet", origin, other]);
	git(other, "commit", "--quiet", "--allow-empty", "-m", "elsewhere");
	git(other, "push", "--quiet", "origin", "main");
	local.commit();
	git(local.path, "fetch", "--quiet", "origin");
	assert.equal(await push("local"), "github: main not pushed to origin: [rejected] (non-fast-forward)");
	assert.equal(git(origin, "rev-parse", "main"), git(other, "rev-parse", "main"), "origin's main as the other clone left it");
	assert.equal(await push("alone"), `github: main not pushed to origin: ${projects[1]?.path} has no origin remote`);
	assert.equal(await push("nope"), "github: main not pushed to origin: no project nope");
	assert.equal(await push("local", "arthur/missing"), "github: arthur/missing not pushed to origin: error: src refspec refs/heads/arthur/missing does not match any");
	assert.equal(await push("asks"), "github: main not pushed to origin: fatal: could not read Username for origin: terminal prompts disabled");
	assert.equal(await push("secret"), "github: main not pushed to origin: fatal: Authentication failed for origin", "the URL, and the credential in it, never said");
	assert.equal(existsSync(`${askpass}.asked`), false, "no askpass was run");
});

test("pull request reviews, polled when wakeOn names them: each told once and woken on; the first poll tells none; a pull request not updated is not asked again", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	api.runs["acme/shop/ci.yml"] = [];
	const cart: FakePull = { number: 7, title: "Add the cart", branch: "arthur/cart", updated: "2026-01-01T00:00:00Z", reviews: [{ id: 70, user: "kacper", state: "COMMENTED", body: "Before Arthur watched." }] };
	api.pulls["acme/shop"] = [cart];
	const box = await started(t, [{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } }], options(api.apiUrl, { wakeOn: ["pull-request-review"] }));
	const told = () => box.fake.emitted.filter((event) => event.name === "pull-request-review").map((event) => event.data);
	const LIST = "/repos/acme/shop/pulls?";
	await until("two polls", () => api.count(LIST) >= 2);
	assert.deepEqual([told(), api.count("/repos/acme/shop/pulls/7/reviews")], [[], 1], "the first poll tells none; not updated since, not asked again");
	cart.reviews.push({ id: 71, user: "kacper", state: "CHANGES_REQUESTED", body: "Test the empty cart." }, { id: 72, user: "kacper", state: "PENDING", body: "A draft." });
	cart.updated = "2026-01-01T00:05:00Z";
	await until("the review told", () => told().length === 1);
	const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
	api.pulls["acme/shop"].push({ number: 8, title: "Fix the logo", branch: "fix-logo", updated: "2026-01-01T00:06:00Z", reviews: [{ id: 80, user: "octo", state: "APPROVED", body: "", submitted: now }] });
	await until("the new pull request's review", () => told().length === 2);
	const polls = api.count(LIST);
	await until("two more polls", () => api.count(LIST) >= polls + 2);
	assert.deepEqual(told(), [
		{ project: "shop", repo: "acme/shop", pull: 7, title: "Add the cart", branch: "arthur/cart", review: 71, user: "kacper", state: "CHANGES_REQUESTED", body: "Test the empty cart.", url: "https://github.com/acme/shop/pull/7#pullrequestreview-71" },
		{ project: "shop", repo: "acme/shop", pull: 8, title: "Fix the logo", branch: "fix-logo", review: 80, user: "octo", state: "APPROVED", body: "", url: "https://github.com/acme/shop/pull/8#pullrequestreview-80" },
	]);
	assert.deepEqual(box.messages(), [
		"[github] kacper reviewed pull request #7 of acme/shop, Add the cart (branch arthur/cart): CHANGES_REQUESTED: https://github.com/acme/shop/pull/7#pullrequestreview-71\nTest the empty cart.",
		"[github] octo reviewed pull request #8 of acme/shop, Fix the logo (branch fix-logo): APPROVED: https://github.com/acme/shop/pull/8#pullrequestreview-80",
	]);
	assert.equal(api.count("/repos/acme/shop/pulls/7/reviews"), 2, "asked again only once it was updated");
});

test("a pull request closed and reopened, while polled or across a restart, has told only its reviews submitted since the poll before", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const project = { name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } };
	api.runs["acme/shop/ci.yml"] = [];
	// GitHub's `submitted_at`, in whole seconds.
	const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
	const cart: FakePull = { number: 7, title: "Add the cart", branch: "arthur/cart", updated: "2026-01-01T00:00:00Z", reviews: [{ id: 70, user: "kacper", state: "COMMENTED", body: "Before Arthur watched." }] };
	api.pulls["acme/shop"] = [cart];
	const first = await started(t, [project], options(api.apiUrl, { wakeOn: ["pull-request-review"] }));
	const told = (box: { readonly fake: FakeHost }) => box.fake.emitted.filter((event) => event.name === "pull-request-review").map((event) => (event.data as { readonly review: number }).review);
	const LIST = "/repos/acme/shop/pulls?";
	const polls = async (what: string) => {
		const before = api.count(LIST);
		// The list asked twice more: the poll that asked it first has ended.
		await until(what, () => api.count(LIST) >= before + 2);
	};
	await polls("the first poll");
	cart.reviews.push({ id: 71, user: "kacper", state: "CHANGES_REQUESTED", body: "Test the empty cart.", submitted: now() });
	cart.updated = "2026-01-01T00:05:00Z";
	await until("review 71", () => told(first).length === 1);
	api.pulls["acme/shop"] = [];
	await polls("a poll with pull request 7 closed");
	// Reopening updates the pull request; a review submitted while it was closed is new.
	cart.updated = "2026-01-01T00:10:00Z";
	cart.reviews.push({ id: 72, user: "octo", state: "COMMENTED", body: "Seen while closed.", submitted: now() });
	api.pulls["acme/shop"] = [cart];
	await until("review 72", () => told(first).length >= 2);
	await polls("a poll after the reopen");
	assert.deepEqual(told(first), [71, 72], "reviews 70 and 71 are not told again after the reopen");
	api.pulls["acme/shop"] = [];
	await polls("a poll with pull request 7 closed again");
	await first.plugin.stop?.();
	cart.updated = "2026-01-01T00:20:00Z";
	cart.reviews.push({ id: 73, user: "octo", state: "APPROVED", body: "", submitted: now() });
	api.pulls["acme/shop"] = [cart];
	// A restart is a new process: a new host on the state file the first one left.
	const again = fakeHost({ name: "github", options: options(api.apiUrl, { wakeOn: ["pull-request-review"] }), env: { ARTHUR_GITHUB_TOKEN: TOKEN } });
	again.provide("projects", () => [project]);
	copyFileSync(join(first.fake.host.folder, "state.json"), join(again.host.folder, "state.json"));
	const restarted = await started(t, [project], options(api.apiUrl, { wakeOn: ["pull-request-review"] }), undefined, again);
	await until("review 73", () => told(restarted).length === 1);
	await polls("a poll after the restart");
	assert.deepEqual(told(restarted), [73], "reopened while stopped: only the review submitted since the last poll before the stop");
});
