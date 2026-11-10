import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { dokploy } from "../src/dokploy.ts";
import { type FakeApp, type FakeGithub, fakeDokploy, SECRETS, type Seen, TOKEN, trpcError } from "./fake-dokploy.ts";

// `arthur dokploy source` (AR0680) on the fake host, against a fake Dokploy answering as v0.30.10 with GitHub's documented
// repositories and branches. docs/commands/dokploy.md.

const NOTHING = "nothing was asked of Dokploy";
const CHANGED = "nothing was changed";

// An app as `create` leaves it: Dokploy's default source `github`, with no repository.
const FRESH: FakeApp = { id: "kXx3fresh03", name: "Fresh", status: "idle", project: "Shop", environment: "production", sourceType: "github", watchPaths: ["apps/web/**"], enableSubmodules: true };
const DEPLOYED = [{ title: "Manual deployment", status: "done" as const, createdAt: "2026-11-09T09:00:00.000Z", finishedAt: "2026-11-09T09:02:00.000Z" }];
const DROP: FakeApp = { id: "kXx3drop04", name: "Drop", status: "done", project: "Shop", environment: "production", sourceType: "drop", deployments: DEPLOYED };
// Already from acme/web-shop's main, deployed, auto-deploy off.
const LINKED: FakeApp = { ...{ id: "kXx3linked05", name: "Linked", status: "done", project: "Shop", environment: "production", sourceType: "github", deployments: DEPLOYED }, ...{ githubId: "gh-acme01", owner: "acme", repository: "web-shop", branch: "main", autoDeploy: false } };
const ACME: FakeGithub = {
	id: "gh-acme01",
	name: "acme",
	repositories: [
		...[{ owner: "acme", name: "web-shop", branches: ["main", "release/1.2", "feat-x_y#1"] }, { owner: "acme", name: "docs", branches: ["main"] }],
		...[{ owner: "studio-9", name: "site_2.0", branches: ["v9"] }, { owner: "acme-labs", name: "web-shop", branches: ["main"] }],
	],
};
const OTHER: FakeGithub = { id: "gh-other02", name: "acme-two", repositories: [{ owner: "acme-two", name: "site", branches: ["main"] }] };
// Another GitHub app that sees acme/web-shop too.
const MIRROR: FakeGithub = { id: "gh-mirror03", name: "mirror", repositories: [{ owner: "acme", name: "web-shop", branches: ["main"] }] };
// Switched to a Docker image in the panel after it deployed from acme/web-shop: Dokploy's saveDockerProvider and dropDeployment
// change only sourceType, so the GitHub columns stay (routers/application.ts:650, :934 at v0.30.10).
const SWITCHED: FakeApp = { ...LINKED, id: "kXx3switched06", name: "Switched", sourceType: "docker", autoDeploy: true };

// The fake with these GitHub apps, and `run`, which runs `arthur dokploy` for the project `shop` and returns its exit code and
// what it printed, or rejects with its refusal.
async function load(t: TestContext, githubs: readonly FakeGithub[] = [ACME]) {
	const main = await fakeDokploy(t, { apps: [FRESH, DROP, LINKED, SWITCHED], githubs });
	const plugin = dokploy({ instances: [{ url: main.url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }] });
	const fake = fakeHost({ name: "dokploy", options: plugin.options, env: { ARTHUR_DOKPLOY_TOKEN: TOKEN } });
	fake.provide("projects", () => [{ name: "shop", pieces: dokploy.project({ app: FRESH.id }) }]);
	await fake.setup(plugin);
	const command = fake.commands.find((each) => each.name === "dokploy");
	const run = async (...args: string[]) => {
		const [logs, errors] = [[] as string[], [] as string[]];
		const log = t.mock.method(console, "log", (text: string) => void logs.push(text));
		const error = t.mock.method(console, "error", (text: string) => void errors.push(text));
		try {
			return { code: await command?.run({ args, project: "shop" }), out: logs.join("\n"), err: errors.join("\n") };
		} finally {
			log.mock.restore();
			error.mock.restore();
		}
	};
	const refusal = async (...args: string[]) => {
		const error = await run(...args).then(
			() => assert.fail("expected a refusal"),
			(error: Error) => error,
		);
		assert.doesNotMatch(error.message, /\n/);
		return error.message;
	};
	return { main, run, refusal };
}

// The writes the fake saw: each POST's procedure and body.
const posts = (seen: readonly Seen[]) => seen.filter(({ method }) => method === "POST").map(({ path, sent }) => [path.replace("/api/", ""), sent?.fields]);
const SAVE = { applicationId: FRESH.id, githubId: "gh-acme01", owner: "acme", repository: "web-shop", branch: "main", buildPath: "/", triggerType: "push", watchPaths: ["apps/web/**"], enableSubmodules: true };
const SET = "Fresh (kXx3fresh03) on instance (unnamed): source github acme/web-shop, branch main, build path /, GitHub app acme";

test("source connects the app to its repository and branch through the only GitHub app, with push; run again, it writes nothing", async (t) => {
	const { main, run } = await load(t);
	const done = await run("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main");
	assert.deepEqual(done, { code: 0, out: `${SET}: set\na push to main deploys it; the first deploy: arthur dokploy deploy kXx3fresh03 --project shop`, err: "" });
	const reads = [["GET", "/api/application.one", { applicationId: FRESH.id }], ["GET", "/api/github.githubProviders", {}], ["GET", "/api/github.getGithubRepositories", { githubId: "gh-acme01" }]];
	const branches = ["GET", "/api/github.getGithubBranches", { repo: "web-shop", owner: "acme", githubId: "gh-acme01" }];
	assert.deepEqual(main.seen.map(({ method, path, query }) => [method, path, query]), [...reads, branches, ["POST", "/api/application.saveGithubProvider", {}]]);
	// The watch paths and submodules go back as the app has them; auto-deploy is on already, so no update.
	assert.deepEqual(posts(main.seen), [["application.saveGithubProvider", SAVE]]);
	for (const secret of SECRETS) assert.ok(!done.out.includes(secret), `${secret} printed`);
	main.seen.length = 0;
	assert.deepEqual(await run("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main"), { code: 0, out: `${SET}: already set`, err: "" });
	assert.deepEqual(posts(main.seen), []);
	assert.match((await run("app", FRESH.id)).out, /source: github/);
	// GitHub's names ignore case: the owner and name go as GitHub writes them, since the push webhook compares them so.
	assert.equal((await run("source", FRESH.id, "--repo", "ACME/Web-Shop", "--branch", "main")).out, `${SET}: already set`);
	// Digits in the owner, digits, _ and . in the name, given in another case: saved as GitHub writes them, which no push would
	// match otherwise.
	assert.equal((await run("source", DROP.id, "--repo", "Studio-9/Site_2.0", "--branch", "v9", "--replace-source")).code, 0);
	assert.deepEqual(posts(main.seen).at(-1), ["application.saveGithubProvider", { ...SAVE, applicationId: DROP.id, owner: "studio-9", repository: "site_2.0", branch: "v9", watchPaths: [], enableSubmodules: false }]);
	// A branch with -, _ and #, each a character Dokploy's rule takes.
	assert.equal((await run("source", DROP.id, "--repo", "acme/web-shop", "--branch", "feat-x_y#1", "--replace-source")).code, 0);
	assert.deepEqual(posts(main.seen).at(-1)?.[1], { ...SAVE, applicationId: DROP.id, branch: "feat-x_y#1", watchPaths: [], enableSubmodules: false });
	// A build path, a branch with a slash: each saved again; a tag trigger set in the panel goes back to push.
	assert.equal((await run("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "release/1.2", "--build-path", "/apps/web")).code, 0);
	assert.deepEqual(posts(main.seen).at(-1), ["application.saveGithubProvider", { ...SAVE, branch: "release/1.2", buildPath: "/apps/web" }]);
	const index = main.live.findIndex((app) => app.id === FRESH.id);
	main.live[index] = { ...(main.live[index] as FakeApp), triggerType: "tag" };
	assert.match((await run("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "release/1.2", "--build-path", "/apps/web")).out, /: set\n/);
	assert.deepEqual(posts(main.seen).at(-1)?.[1], { ...SAVE, branch: "release/1.2", buildPath: "/apps/web" });
	// The same repository and branch with only the build path changed: saved, and without --build-path it goes back to /.
	const before = posts(main.seen).length;
	assert.match((await run("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "release/1.2")).out, /build path \/, GitHub app acme: set\n/);
	assert.deepEqual(posts(main.seen).slice(before), [["application.saveGithubProvider", { ...SAVE, branch: "release/1.2" }]]);
});

test("source turns auto-deploy on when it is off or unset, and only then; an app with nothing else to change gets the update alone", async (t) => {
	const { main, run } = await load(t);
	// LINKED already has the source: switching off nothing, only auto-deploy.
	const linked = await run("source", LINKED.id, "--repo", "acme/web-shop", "--branch", "main");
	assert.equal(linked.out, "Linked (kXx3linked05) on instance (unnamed): source github acme/web-shop, branch main, build path /, GitHub app acme: set\na push to main deploys it; the first deploy: arthur dokploy deploy kXx3linked05 --project shop");
	assert.deepEqual(posts(main.seen), [["application.update", { applicationId: LINKED.id, autoDeploy: true }]]);
	assert.equal(main.live.find((app) => app.id === LINKED.id)?.autoDeploy, true);
	main.seen.length = 0;
	const index = main.live.findIndex((app) => app.id === FRESH.id);
	main.live[index] = { ...FRESH, autoDeploy: null };
	assert.equal((await run("source", FRESH.id, "--repo", "acme/docs", "--branch", "main")).code, 0);
	assert.deepEqual(posts(main.seen).map(([procedure]) => procedure), ["application.saveGithubProvider", "application.update"], "a null autoDeploy deploys nothing on a push");
});

test("source refuses a --repo, --branch or --build-path Dokploy or GitHub would not take before any request", async (t) => {
	const { main, refusal } = await load(t);
	const source = (repo: string, branch: string, ...more: string[]) => refusal("source", FRESH.id, "--repo", repo, "--branch", branch, ...more);
	const repo = (given: string) => `--repo ${given} is not <owner>/<name>: an owner of letters, digits and -, a name of letters, digits, ., _ and -; ${NOTHING}`;
	for (const given of ["acme", "acme/", "/web-shop", "acme/web/shop", "ac_me/web-shop", "acme/web shop", "acme/web-shop\n"]) assert.equal(await source(given, "main"), repo(given.trim()));
	const branch = (given: string) => `--branch ${given} is not a branch Dokploy takes: letters, digits, ., _, -, / and #; ${NOTHING}`;
	for (const given of ["main;id", "feat branch", "ma$in", "ma\nin", "mäin"]) assert.equal(await source("acme/web-shop", given), branch(given.replace("\n", "")));
	const path = (given: string) => `--build-path ${given} is not a folder of the repository: a path from /, without a .. part; ${NOTHING}`;
	for (const given of ["apps/web", "/apps/../..", "/.."]) assert.equal(await source("acme/web-shop", "main", "--build-path", given), path(given));
	assert.deepEqual(main.seen, []);
});

test("source refuses after its reads and before any write: no GitHub app, several without --github, an unknown one, an app without an id", async (t) => {
	const none = await load(t, []);
	const add = "the owner adds one in Dokploy's panel, Settings, Git providers, and installs it on acme/web-shop";
	assert.equal(await none.refusal("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main"), `instance (unnamed) has no GitHub app the token's user may use: ${add}; ${CHANGED}`);
	const two = await load(t, [ACME, OTHER]);
	const source = (...more: string[]) => two.refusal("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main", ...more);
	assert.equal(await source(), `instance (unnamed) has 2 GitHub apps: add --github <name>; its GitHub apps: acme, acme-two; ${CHANGED}`);
	assert.equal(await source("--github", "acme-three"), `instance (unnamed) has no GitHub app acme-three; its GitHub apps: acme, acme-two; ${CHANGED}`);
	// --github picks among several; the other app does not see the repository.
	assert.equal((await two.run("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main", "--github", "acme")).code, 0);
	assert.match(await source("--github", "acme-two"), /^GitHub app acme-two cannot see acme\/web-shop: /);
	two.main.scripted.set("github.githubProviders", { status: 200, body: [{ githubId: "gh 1", githubUrl: "https://github.com", gitProvider: { name: "acme" } }] });
	assert.equal(await source(), `instance (unnamed): GitHub app acme has no Dokploy id; ${CHANGED}`);
	two.main.scripted.set("github.githubProviders", { status: 200, body: [{ githubUrl: "https://github.com", gitProvider: { name: "acme" } }] });
	assert.equal(await source(), `instance (unnamed): GitHub app acme has no Dokploy id; ${CHANGED}`);
	assert.deepEqual([posts(none.main.seen), posts(two.main.seen).map(([procedure]) => procedure)], [[], ["application.saveGithubProvider"]]);
});

test("source refuses a repository the GitHub app cannot see and a branch it does not have, before any write", async (t) => {
	const { main, refusal } = await load(t);
	const install = "install the GitHub app on it (GitHub, Settings, GitHub Apps, Configure), then run this again";
	assert.equal(await refusal("source", FRESH.id, "--repo", "acme/shop", "--branch", "main"), `GitHub app acme cannot see acme/shop: ${install}; ${CHANGED}`);
	assert.equal(await refusal("source", FRESH.id, "--repo", "other/web-shop", "--branch", "main"), `GitHub app acme cannot see other/web-shop: ${install}; ${CHANGED}`);
	assert.equal(await refusal("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "develop"), `acme/web-shop has no branch develop; ${CHANGED}`);
	// A branch is case-sensitive in Git: Main is not main.
	assert.equal(await refusal("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "Main"), `acme/web-shop has no branch Main; ${CHANGED}`);
	assert.deepEqual(posts(main.seen), []);
	main.scripted.set("github.getGithubBranches", trpcError(500, "INTERNAL_SERVER_ERROR", "Bad credentials", "github.getGithubBranches"));
	assert.equal(await refusal("source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main"), "instance (unnamed): 500 for the branches of acme/web-shop: Bad credentials");
});

test("source refuses an app with deployments from another source or repository without --replace-source, and switches it with it", async (t) => {
	const { main, run, refusal } = await load(t);
	const replace = (from: string, to: string) => `deploys from ${from} and has deployments; this makes it deploy from github ${to}: add --replace-source for that; ${CHANGED}`;
	assert.equal(await refusal("source", DROP.id, "--repo", "acme/web-shop", "--branch", "main"), `Drop (kXx3drop04) on instance (unnamed) ${replace("drop", "acme/web-shop, branch main")}`);
	const linked = `Linked (kXx3linked05) on instance (unnamed) ${replace("github acme/web-shop, branch main", "acme/web-shop, branch release/1.2")}`;
	assert.equal(await refusal("source", LINKED.id, "--repo", "acme/web-shop", "--branch", "release/1.2"), linked);
	assert.match(await refusal("source", LINKED.id, "--repo", "acme/docs", "--branch", "main"), /deploys from github acme\/web-shop, branch main and has deployments/);
	// Another owner of a repository of the same name is another source.
	assert.match(await refusal("source", LINKED.id, "--repo", "acme-labs/web-shop", "--branch", "main"), /deploys from github acme\/web-shop, branch main and has deployments; this makes it deploy from github acme-labs\/web-shop/);
	// A Docker app that kept its GitHub columns does not deploy from GitHub: not already set, and refused.
	assert.equal(await refusal("source", SWITCHED.id, "--repo", "acme/web-shop", "--branch", "main"), `Switched (kXx3switched06) on instance (unnamed) ${replace("docker", "acme/web-shop, branch main")}`);
	assert.deepEqual(posts(main.seen), []);
	assert.equal((await run("source", DROP.id, "--repo", "acme/web-shop", "--branch", "main", "--replace-source")).code, 0);
	// An app without watch paths sends none, and its submodules off.
	assert.deepEqual(posts(main.seen), [["application.saveGithubProvider", { ...SAVE, applicationId: DROP.id, watchPaths: [], enableSubmodules: false }]]);
	// The same repository and branch with another build path is no other source.
	assert.equal((await run("source", LINKED.id, "--repo", "acme/web-shop", "--branch", "main", "--build-path", "/web")).code, 0);
	assert.equal(main.live.find((app) => app.id === DROP.id)?.sourceType, "github");
});

test("source counts the same repository and branch through another GitHub app as another source", async (t) => {
	const { main, run, refusal } = await load(t, [ACME, MIRROR]);
	const switched = await refusal("source", LINKED.id, "--repo", "acme/web-shop", "--branch", "main", "--github", "mirror");
	assert.match(switched, /^Linked \(kXx3linked05\) on instance \(unnamed\) deploys from github acme\/web-shop, branch main and has deployments; /);
	assert.deepEqual(posts(main.seen), []);
	assert.equal((await run("source", LINKED.id, "--repo", "acme/web-shop", "--branch", "main", "--github", "mirror", "--replace-source")).code, 0);
	assert.deepEqual(posts(main.seen)[0]?.[1], { ...SAVE, applicationId: LINKED.id, githubId: "gh-mirror03", watchPaths: [], enableSubmodules: false });
	// The docker app with --replace-source is saved, not already set.
	assert.match((await run("source", SWITCHED.id, "--repo", "acme/web-shop", "--branch", "main", "--github", "acme", "--replace-source")).out, /GitHub app acme: set\n/);
	assert.equal(main.live.find((app) => app.id === SWITCHED.id)?.sourceType, "github");
});

test("source without --repo or --branch, with a word too many, or a flag of another verb, prints the usage line and exits 2", async (t) => {
	const { main, run } = await load(t);
	for (const args of [
		["source", FRESH.id, "--branch", "main"],
		["source", FRESH.id, "--repo", "acme/web-shop"],
		["source", "--repo", "acme/web-shop", "--branch", "main"],
		["source", FRESH.id, "extra", "--repo", "acme/web-shop", "--branch", "main"],
		["source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main", "--port", "3000"],
		["source", FRESH.id, "--repo", "acme/web-shop", "--branch", "main", "--repo", "acme/docs"],
		["source", FRESH.id, "--repo", "acme/web-shop", "--branch", "--github"],
		["setup", FRESH.id, "--github", "acme"],
	]) {
		const wrong = await run(...args);
		assert.deepEqual([wrong.code, wrong.out], [2, ""], args.join(" "));
		assert.match(wrong.err, /\|source <app> --repo <owner>\/<name> --branch <branch> \[--build-path <path>\] \[--github <name>\] \[--replace-source\]/);
	}
	assert.deepEqual(main.seen, []);
});
