import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type GithubOptions, github } from "../src/github.ts";
import { DOCS, type FakeRun, fakeGithub } from "./fake-github.ts";

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

test("a commit with no run of its own has the run of the nearest commit before it; two branches on one run are one event", async (t) => {
	const api = await fakeGithub(t);
	const shop = repository();
	const built = shop.commit("arthur/two");
	const docs = shop.commit("arthur/two");
	const run: FakeRun = { id: 21, sha: built, branch: "arthur/two", status: "in_progress", conclusion: null };
	const main: FakeRun = { id: 20, sha: shop.head(), branch: "main", status: "queued", conclusion: null };
	api.runs["acme/shop/ci.yml"] = [run, main];
	const box = await started(t, [{ name: "shop", path: shop.path, prefix: "SH", ci: { workflow: "ci.yml" } }], options(api.apiUrl));
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
