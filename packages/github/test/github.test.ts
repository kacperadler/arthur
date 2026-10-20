import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type GithubOptions, github } from "../src/github.ts";

// The github plugin against the fake host and a fake GitHub REST API on a loopback port the OS picks, answering in the shape
// of GitHub's documentation ("List workflow runs for a workflow", "Rate limits for the REST API"). Each project is a real
// repository whose origin names its GitHub repository; polls run every second.

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

const user = (login: string, id: number) => ({
	...{ login, id, node_id: "MDQ6VXNlcjE=", avatar_url: `https://github.com/images/${login}.gif`, gravatar_id: "", url: `https://api.github.com/users/${login}`, html_url: `https://github.com/${login}` },
	...Object.fromEntries(["followers", "following{/other_user}", "gists{/gist_id}", "starred{/owner}{/repo}", "subscriptions", "organizations", "repos", "events{/privacy}", "received_events"].map((each) => [`${each.split("{")[0]}_url`, `https://api.github.com/users/${login}/${each}`])),
	...{ type: "User", site_admin: false },
});
const repo = (full: string) => ({
	...{ id: 1296269, node_id: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", name: full.split("/")[1], full_name: full, owner: user(full.split("/")[0] ?? "", 1), private: false },
	...{ html_url: `https://github.com/${full}`, description: "This your first repo!", fork: false, url: `https://api.github.com/repos/${full}` },
	...Object.fromEntries(
		["archive", "assignees", "blobs", "branches", "collaborators", "comments", "commits", "compare", "contents", "contributors", "deployments", "downloads", "events", "forks", "git_commits", "git_refs", "git_tags", "issue_comment", "issue_events", "issues", "keys", "labels", "languages", "merges", "milestones", "notifications", "pulls", "releases", "stargazers", "statuses", "subscribers", "subscription", "tags", "teams", "trees", "hooks"].map((each) => [`${each}_url`, `https://api.github.com/repos/${full}/${each}`]),
	),
});
type FakeRun = { readonly id: number; readonly sha: string; readonly branch: string; status: "queued" | "in_progress" | "completed"; conclusion: "success" | "failure" | null };
// A run as "List workflow runs for a workflow" shows it, every field.
const shaped = (full: string, workflow: string, { id, sha, branch, status, conclusion }: FakeRun) => ({
	...{ id, name: "CI", node_id: "MDEyOldvcmtmbG93IFJ1bjI2OTI4OQ==", check_suite_id: 42, check_suite_node_id: "MDEwOkNoZWNrU3VpdGU0Mg==", head_branch: branch, head_sha: sha, path: `.github/workflows/${workflow}@${branch}` },
	...{ run_number: id % 1000, event: "push", display_title: `on ${branch}`, status, conclusion, workflow_id: 159038, url: `https://api.github.com/repos/${full}/actions/runs/${id}`, html_url: `https://github.com/${full}/actions/runs/${id}` },
	...{ pull_requests: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:01:00Z", actor: user("octocat", 1), run_attempt: 1, referenced_workflows: [], run_started_at: "2026-01-01T00:00:00Z", triggering_actor: user("octocat", 1) },
	...Object.fromEntries(["jobs", "logs", "artifacts", "cancel", "rerun"].map((each) => [`${each}_url`, `https://api.github.com/repos/${full}/actions/runs/${id}/${each}`])),
	...{ check_suite_url: `https://api.github.com/repos/${full}/check-suites/414944374`, previous_attempt_url: null, workflow_url: `https://api.github.com/repos/${full}/actions/workflows/159038` },
	head_commit: { id: sha, tree_id: "d23f6eedb1e1b9610bbc754ddb5197bfe7271223", message: `on ${branch}`, timestamp: "2026-01-01T00:00:00Z", author: { name: "test", email: "test@example.com" }, committer: { name: "test", email: "test@example.com" } },
	...{ repository: repo(full), head_repository: repo(full) },
});
type Reply = { readonly status: number; readonly headers?: Readonly<Record<string, string>>; readonly body: unknown };
const RATE = { "x-ratelimit-limit": "5000", "x-ratelimit-used": "1", "x-ratelimit-resource": "core" };
const DOCS = "https://docs.github.com/rest";

// The fake API: `runs[<owner>/<repo>/<workflow>]` newest first; `next` replies once each, before anything else; `always` replies
// to every request while set. `seen` holds each request: its path, its time and its Authorization.
async function fakeGithub(t: TestContext) {
	const runs: Record<string, FakeRun[]> = {};
	const next: Reply[] = [];
	const state: { always?: Reply } = {};
	const seen: { readonly path: string; readonly at: number; readonly auth: string }[] = [];
	const http = createServer((request, response) => {
		seen.push({ path: request.url ?? "", at: Date.now(), auth: request.headers.authorization ?? "" });
		const match = /^\/repos\/([^/]+\/[^/]+)\/actions\/workflows\/([^/]+)\/runs\?per_page=100&exclude_pull_requests=true$/.exec(request.url ?? "");
		const list = match === null ? undefined : runs[`${match[1]}/${decodeURIComponent(match[2] ?? "")}`];
		const found: Reply | undefined = list === undefined || match === null ? undefined : { status: 200, body: { total_count: list.length, workflow_runs: list.map((run) => shaped(match[1] ?? "", match[2] ?? "", run)) } };
		const reply = next.shift() ?? state.always ?? found ?? { status: 404, body: { message: "Not Found", documentation_url: DOCS, status: "404" } };
		response.writeHead(reply.status, { "content-type": "application/json; charset=utf-8", ...RATE, "x-ratelimit-remaining": "4999", "x-ratelimit-reset": "1767225600", ...reply.headers }).end(JSON.stringify(reply.body));
	});
	await once(http.listen(0, "127.0.0.1"), "listening");
	t.after(() => {
		http.closeAllConnections();
		http.close();
	});
	const apiUrl = `http://127.0.0.1:${(http.address() as AddressInfo).port}/`;
	return { runs, next, state, seen, apiUrl, count: (path: string) => seen.filter((each) => each.path.startsWith(path)).length };
}

type Project = { readonly name: string; readonly path: string; readonly prefix: string; readonly ci?: { readonly workflow: string } };

// The plugin set up on a fake host with `projects` and started; stopped at the end. `record` writes a job's record as the core
// does, which the plugin reads through `host.jobs.list()`.
async function started(t: TestContext, projects: readonly Project[], options: GithubOptions, env: Readonly<Record<string, string>> = { ARTHUR_GITHUB_TOKEN: TOKEN }, fake?: FakeHost) {
	const errors: string[] = [];
	t.mock.method(console, "error", (text: string) => void errors.push(text));
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
	const finished = () => host.emitted.filter((event) => event.name === "ci-finished").map((event) => event.data as { readonly run: number; readonly branches: readonly string[] });
	const notices = () => host.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { readonly text: string }).text);
	return { fake: host, plugin, record, finished, notices, errors, home };
}

const PATH = "/repos/acme/shop/actions/workflows/ci.yml/runs";
const options = (apiUrl: string, more: Partial<GithubOptions> = {}): GithubOptions => ({ instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN", apiUrl }], poll: { everySeconds: 1 }, ...more });

test("a finished run is told once by its id, across polls and a restart; what finished before the first poll is not told; the token stays out", async (t) => {
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
		{ project: "shop", repo: "acme/shop", workflow: "ci.yml", run: 12, sha: branch, branch: "arthur/one", branches: ["arthur/one"], conclusion: "failure", url: "https://github.com/acme/shop/actions/runs/12" },
	]);
	const polls = api.count(PATH);
	await until("two more polls", () => api.count(PATH) >= polls + 2);
	assert.equal(first.finished().length, 1, "the same run seen on two more polls is not told again");
	await first.plugin.stop?.();
	const main = shop.commit();
	api.runs["acme/shop/ci.yml"]?.unshift({ id: 13, sha: main, branch: "main", status: "completed", conclusion: "success" });
	const restarted = await started(t, [project], options(api.apiUrl), undefined, first.fake);
	const before = api.count(PATH);
	await until("the run that finished while stopped", () => restarted.finished().length === 2);
	await until("two polls after the restart", () => api.count(PATH) >= before + 2);
	assert.deepEqual(
		restarted.finished().map((event) => [event.run, event.branches]),
		[
			[12, ["arthur/one"]],
			[13, ["main"]],
		],
		"run 12 is not told again after the restart",
	);
	assert.ok(api.seen.every((each) => each.auth === `Bearer ${TOKEN}`));
	const files = [join(first.home, "events.jsonl"), ...readdirSync(first.fake.host.folder).map((name) => join(first.fake.host.folder, name))];
	for (const file of files) assert.ok(!readFileSync(file, "utf8").includes(TOKEN), file);
	assert.ok(!JSON.stringify(first.errors).includes(TOKEN));
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
