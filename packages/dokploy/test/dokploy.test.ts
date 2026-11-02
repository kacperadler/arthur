import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { type DokployOptions, dokploy } from "../src/dokploy.ts";
import { type FakeDeployment, fakeDokploy, SECRETS, TOKEN, trpcError } from "./fake-dokploy.ts";

// The dokploy plugin on the fake host, against two fake Dokploy servers: the unnamed instance answering as Dokploy
// v0.30.10, `client` as the documentation's example. docs/commands/dokploy.md.

const CLIENT_TOKEN = "cl1entT0kenN3verPr1ntedcl1entT0kenN3verPr1ntedcl1entT0kenN3verPr1nt";
const USAGE = "usage: arthur dokploy apps [--instance <name>]|app [<app>] [--instance <name>]|status [<app>] [--instance <name>]; --project <name> for another project than the main one";
const NOTHING = "nothing was asked of Dokploy";
const ENV = { ARTHUR_DOKPLOY_TOKEN: TOKEN, ARTHUR_DOKPLOY_CLIENT_TOKEN: CLIENT_TOKEN };

const deployed = (day: number, status: FakeDeployment["status"], more: Partial<FakeDeployment> = {}): FakeDeployment => ({
	...{ title: `Deploy ${day}`, status, createdAt: `2026-10-${day}T09:00:00.000Z` },
	...(status === "running" ? {} : { finishedAt: `2026-10-${day}T09:02:00.000Z` }),
	...more,
});
// Seven deployments in the order Dokploy stored them, which is not their order in time.
const DEPLOYMENTS = [deployed(26, "done"), deployed(30, "running"), deployed(24, "done"), deployed(28, "done"), deployed(25, "cancelled"), deployed(29, "error", { title: "Fix\u001b[31m checkout", errorMessage: "Build failed\nnpm ERR! \u0007missing script: build\n" }), deployed(27, "done")];
const SHOP_WEB = { id: "kXx3shopWeb01", name: "Shop web", status: "done", project: "Shop", environment: "production", domains: [{ host: "shop.example", https: true }, { host: "shop.example", https: true, path: "/admin" }], deployments: DEPLOYMENTS } as const;
const SHOP_API = { id: "kXx3shopApi02", name: "Shop API", status: "running", project: "Shop", environment: "staging", sourceType: "github", domains: [{ host: "api.shop.internal", https: false }] } as const;
const CLIENT_SITE = { id: "cl1entSite", name: "Client site", status: "idle", project: "Random", environment: "production" } as const;

const PROJECTS = [
	{ name: "shop", prefix: "SH", pieces: dokploy.project({ app: SHOP_WEB.id }) },
	{ name: "client", prefix: "CL", pieces: dokploy.project({ instance: "client", app: CLIENT_SITE.id }) },
	{ name: "blog", prefix: "BL", pieces: {} },
];

// The two fake servers, the unnamed instance's and client's.
async function servers(t: TestContext) {
	const main = await fakeDokploy(t, { apps: [SHOP_WEB, SHOP_API], empty: ["Archive"] });
	const client = await fakeDokploy(t, { apps: [CLIENT_SITE], form: "documented", token: CLIENT_TOKEN });
	return { main, client, instances: [{ url: main.url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }, { name: "client", url: client.url, tokenEnv: "ARTHUR_DOKPLOY_CLIENT_TOKEN" }] };
}

// The plugin set up on a fake host with `options` and the project list `projects`; `run` runs `arthur dokploy` and returns
// its exit code and what it printed, or rejects with its refusal.
async function load(t: TestContext, options: DokployOptions, { projects = PROJECTS as readonly unknown[], env = ENV as Readonly<Record<string, string>> } = {}) {
	const plugin = dokploy(options);
	const fake = fakeHost({ name: "dokploy", options: plugin.options, env });
	fake.provide("projects", () => projects);
	await fake.setup(plugin);
	const command = fake.commands.find((each) => each.name === "dokploy");
	return async (project: string | undefined, ...args: string[]) => {
		const [logs, errors] = [[] as string[], [] as string[]];
		const log = t.mock.method(console, "log", (text: string) => void logs.push(text));
		const error = t.mock.method(console, "error", (text: string) => void errors.push(text));
		try {
			const code = await command?.run({ args, project });
			return { code, out: logs.join("\n"), err: errors.join("\n") };
		} finally {
			log.mock.restore();
			error.mock.restore();
		}
	};
}

// A refusal: one line, never a token.
async function refusal(run: Promise<unknown>): Promise<string> {
	const error = await run.then(
		() => assert.fail("expected a refusal"),
		(error: Error) => error,
	);
	assert.doesNotMatch(error.message, /\n/);
	for (const token of [TOKEN, CLIENT_TOKEN]) assert.ok(!error.message.includes(token), `a token appears in: ${error.message}`);
	return error.message;
}

const APPS = [
	"instance (unnamed)",
	"project Shop",
	"  environment production",
	"    kXx3shopWeb01 Shop web (done)",
	"  environment staging",
	"    kXx3shopApi02 Shop API (running)",
	"project Archive",
	"  environment production: no applications",
].join("\n");
const CLIENT_APPS = "instance client\nproject Random\n  cl1entSite Client site (idle)";

test("apps lists each instance's projects under its name, Dokploy's environments and the documentation's older form both; --instance only the one it names", async (t) => {
	const { main, client, instances } = await servers(t);
	const run = await load(t, { instances });
	assert.deepEqual(await run(undefined, "apps"), { code: 0, out: `${APPS}\n\n${CLIENT_APPS}`, err: "" });
	assert.deepEqual(await run(undefined, "apps", "--instance", "client"), { code: 0, out: CLIENT_APPS, err: "" });
	assert.deepEqual(main.seen.map(({ method, path, key }) => [method, path, key]), [["GET", "/api/project.all", TOKEN]]);
	assert.deepEqual(client.seen.map(({ method, path, key }) => [method, path, key]), [["GET", "/api/project.all", CLIENT_TOKEN], ["GET", "/api/project.all", CLIENT_TOKEN]]);
	const bare = await fakeDokploy(t);
	const none = await load(t, { instances: [{ url: bare.url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }] }, { projects: [] });
	assert.deepEqual(await none(undefined, "apps"), { code: 0, out: "instance (unnamed)\nno projects", err: "" });
	// A member's project.all leaves out the environments the member may not see, all of them here.
	bare.scripted.set("project.all", { status: 200, body: [{ projectId: "prj-hidden", name: "Hidden", environments: [] }] });
	assert.deepEqual(await none(undefined, "apps"), { code: 0, out: "instance (unnamed)\nproject Hidden: no applications", err: "" });
});

test("apps goes on past an instance that fails, printing its error line, and exits 1", async (t) => {
	const { instances } = await servers(t);
	const run = await load(t, { instances }, { env: { ...ENV, ARTHUR_DOKPLOY_CLIENT_TOKEN: TOKEN } });
	assert.deepEqual(await run(undefined, "apps"), { code: 1, out: `${APPS}\n\ninstance client`, err: "instance client: 401: the token in ARTHUR_DOKPLOY_CLIENT_TOKEN was refused: Unauthorized" });
});

test("app prints the project's app: its project and environment, source, status, domains as URLs and its newest deployment; never a secret", async (t) => {
	const { main, client, instances } = await servers(t);
	const run = await load(t, { instances });
	const web = [
		"Shop web (kXx3shopWeb01) on instance (unnamed)",
		"project: Shop, environment: production",
		"source: drop, status: done",
		"domains: https://shop.example/, https://shop.example/admin",
		"last deployment: running: Deploy 30, started 2026-10-30T09:00:00.000Z, finished not yet",
	].join("\n");
	assert.deepEqual(await run(undefined, "app"), { code: 0, out: web, err: "" });
	assert.deepEqual(main.seen.map(({ path, query, key }) => [path, query, key]), [["/api/application.one", { applicationId: SHOP_WEB.id }, TOKEN]]);
	const api = "Shop API (kXx3shopApi02) on instance (unnamed)\nproject: Shop, environment: staging\nsource: github, status: running\ndomains: http://api.shop.internal/\nlast deployment: none";
	assert.deepEqual(await run("shop", "app", SHOP_API.id), { code: 0, out: api, err: "" });
	const site = "Client site (cl1entSite) on instance client\nproject: Random, environment: production\nsource: drop, status: idle\ndomains: none\nlast deployment: none";
	assert.deepEqual(await run("client", "app"), { code: 0, out: site, err: "" });
	assert.deepEqual(client.seen.map(({ path, key }) => [path, key]), [["/api/application.one", CLIENT_TOKEN]]);
	const said = [await run(undefined, "app"), await run(undefined, "status"), await run(undefined, "apps")].map(({ out, err }) => `${out}\n${err}`).join("\n");
	for (const secret of [...SECRETS, TOKEN, CLIENT_TOKEN]) assert.ok(!said.includes(secret), `printed: ${secret}`);
});

test("status prints the app's status, then its 5 newest deployments by createdAt, Dokploy's error message after > with control characters dropped", async (t) => {
	const { main, instances } = await servers(t);
	const run = await load(t, { instances });
	const finished = (day: number) => `started 2026-10-${day}T09:00:00.000Z, finished 2026-10-${day}T09:02:00.000Z`;
	const status = [
		"Shop web (kXx3shopWeb01) on instance (unnamed): done",
		"running: Deploy 30, started 2026-10-30T09:00:00.000Z, finished not yet",
		`error: Fix[31m checkout, ${finished(29)}`,
		"  > Build failed",
		"  > npm ERR! missing script: build",
		`done: Deploy 28, ${finished(28)}`,
		`done: Deploy 27, ${finished(27)}`,
		`done: Deploy 26, ${finished(26)}`,
	].join("\n");
	assert.deepEqual(await run(undefined, "status"), { code: 0, out: status, err: "" });
	assert.deepEqual(main.seen.map(({ path, query }) => [path, query]), [["/api/application.one", { applicationId: SHOP_WEB.id }], ["/api/deployment.all", { applicationId: SHOP_WEB.id }]]);
	assert.deepEqual(await run(undefined, "status", SHOP_API.id, "--instance", "client").catch((error: Error) => error.message), "instance client: 404: app kXx3shopApi02 not found");
	assert.deepEqual(await run("shop", "status", SHOP_API.id), { code: 0, out: "Shop API (kXx3shopApi02) on instance (unnamed): running\nno deployments", err: "" });
});

test("which instance: the project's, the unnamed one when it names none, --project's for an id, the only one; an ambiguous or contradicting call is refused before any request", async (t) => {
	const { main, client, instances } = await servers(t);
	const run = await load(t, { instances });
	const ambiguous = `dokploy has 2 instances ((unnamed), client) and the call names none: add --instance <name>, or --project <name> of a project with dokploy.project(...); ${NOTHING}`;
	assert.equal(await refusal(run(undefined, "app", SHOP_API.id)), ambiguous);
	assert.equal(await refusal(run("blog", "status", SHOP_API.id)), ambiguous, "blog has no dokploy.project(...), so no instance");
	assert.equal(await refusal(run(undefined, "app", "--instance", "client")), `--instance client is not instance (unnamed), which project shop's dokploy.project(...) names; ${NOTHING}`);
	assert.equal(await refusal(run(undefined, "apps", "--instance", "acme\u001b")), `--instance acme is not an instance of dokploy; its instances: (unnamed), client; ${NOTHING}`);
	assert.equal(await refusal(run(undefined, "app", SHOP_API.id, "--instance", "acme")), `--instance acme is not an instance of dokploy; its instances: (unnamed), client; ${NOTHING}`);
	assert.equal(await refusal(run("blog", "app")), `project blog has no dokploy.project(...): give the app's id, or --project <name>; projects with one: shop, client; ${NOTHING}`);
	assert.equal(await refusal(run("nope", "app")), `unknown project nope; ${NOTHING}`);
	for (const id of ["kXx3/../x", "a b", "kXx3?x=1", "x".repeat(65), "é"]) assert.equal(await refusal(run(undefined, "status", id, "--instance", "client")), `the app is not a Dokploy application id: 1 to 64 letters, digits, _ and -; ${NOTHING}`, id);
	assert.deepEqual([main.seen, client.seen], [[], []], "nothing was asked of either server");
	assert.equal((await run("client", "app", "--instance", "client")).code, 0, "--instance may name the project's own");
	assert.equal((await run("blog", "app", SHOP_API.id, "--instance", "(unnamed)").catch((error: Error) => error.message)), `--instance (unnamed) is not an instance of dokploy; its instances: (unnamed), client; ${NOTHING}`);
	const only = await load(t, { instances: instances.slice(0, 1) }, { projects: [] });
	assert.equal((await only(undefined, "app", SHOP_API.id)).code, 0, "the only instance, with no project at all");
	assert.equal(await refusal(only(undefined, "status")), `there is no project: give the app's id, or --project <name>; no project has one; ${NOTHING}`);
	assert.deepEqual(main.seen.map(({ query }) => query.applicationId), [SHOP_API.id]);
	assert.deepEqual(client.seen.map(({ query }) => query.applicationId), [CLIENT_SITE.id]);
});

test("wrong usage prints the usage line and exits 2, asking nothing", async (t) => {
	const { main, client, instances } = await servers(t);
	const run = await load(t, { instances });
	const wrong = [[], ["upload"], ["deploy"], ["apps", "x"], ["app", "a", "b"], ["status", "a", "b"], ["app", "--instance"], ["app", "--instance", "--project"], ["app", "--instance", "client", "--instance", "client"], ["app", "--all"], ["status", "-x"]];
	for (const args of wrong) assert.deepEqual(await run(undefined, ...args), { code: 2, out: "", err: USAGE }, args.join(" "));
	assert.deepEqual([main.seen, client.seen], [[], []]);
});

test("each Dokploy error is one line naming the instance, the token never in it: 401, 403, 404, 400, 500, no answer in time, no server, a redirect, not JSON", async (t) => {
	const { main, instances } = await servers(t);
	const second = await fakeDokploy(t, { apps: [SHOP_WEB] });
	const run = await load(t, { instances, timeoutSeconds: 0.3 });
	const wrong = await load(t, { instances }, { env: { ...ENV, ARTHUR_DOKPLOY_TOKEN: CLIENT_TOKEN } });
	assert.equal(await refusal(wrong(undefined, "app")), "instance (unnamed): 401: the token in ARTHUR_DOKPLOY_TOKEN was refused: Unauthorized");
	assert.equal(await refusal(run(undefined, "app", "kXx3gone", "--instance", "client")), "instance client: 404: app kXx3gone not found");
	main.scripted.set("application.one", trpcError(403, "FORBIDDEN", `You don't have access to this service (key ${TOKEN})`, "application.one"));
	assert.equal(await refusal(run(undefined, "app")), "instance (unnamed): 403: the token's user may not read app kXx3shopWeb01: You don't have access to this service (key [token])");
	main.scripted.delete("application.one");
	main.scripted.set("deployment.all", trpcError(400, "BAD_REQUEST", "Input validation failed", "deployment.all"));
	assert.equal(await refusal(run(undefined, "status")), "instance (unnamed): 400 for the deployments of app kXx3shopWeb01: Input validation failed");
	main.scripted.set("deployment.all", trpcError(500, "INTERNAL_SERVER_ERROR", "connect ECONNREFUSED\u0007 db:5432\nat pg", "deployment.all"));
	assert.equal(await refusal(run(undefined, "status")), "instance (unnamed): 500 for the deployments of app kXx3shopWeb01: connect ECONNREFUSED db:5432 at pg");
	main.scripted.set("deployment.all", { status: 502, body: "Bad Gateway" });
	assert.equal(await refusal(run(undefined, "status")), "instance (unnamed): 502 for the deployments of app kXx3shopWeb01: Bad Gateway");
	main.scripted.set("application.one", "not-json");
	assert.equal(await refusal(run(undefined, "app")), "instance (unnamed): the answer for app kXx3shopWeb01 is not JSON");
	main.scripted.set("application.one", "hang");
	assert.equal(await refusal(run(undefined, "app")), `instance (unnamed): no answer in 0.3 s from ${main.url} for app kXx3shopWeb01`);
	main.scripted.set("application.one", { redirect: `${second.url}/api/application.one?applicationId=${SHOP_WEB.id}` });
	assert.equal(await refusal(run(undefined, "app")), `instance (unnamed): ${main.url} answered app kXx3shopWeb01 with a redirect, which is not followed: the token goes only to the configured url`);
	assert.deepEqual(second.seen, [], "the server the redirect points to saw no request, so never the token");
	const closed = createServer();
	closed.listen(0, "127.0.0.1");
	await once(closed, "listening");
	const gone = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
	closed.close();
	await once(closed, "close");
	const away = await load(t, { instances: [{ url: gone, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }] }, { projects: PROJECTS.slice(0, 1) });
	assert.equal(await refusal(away(undefined, "app")), `instance (unnamed): cannot reach ${gone} for app kXx3shopWeb01 (ECONNREFUSED)`);
});

test("a url under a path is called at <url>/api/<procedure>, a trailing slash or not", async (t) => {
	const { main } = await servers(t);
	for (const url of [`${main.url}/dokploy`, `${main.url}/dokploy/`]) assert.equal((await (await load(t, { instances: [{ url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }] }, { projects: PROJECTS.slice(0, 1) }))(undefined, "app")).code, 0);
	assert.deepEqual(main.seen.map(({ path }) => path), ["/dokploy/api/application.one", "/dokploy/api/application.one"]);
});

test("refused before the setup, naming the project and the helper, never the value: an instance dokploy does not have, no unnamed one to fall back on, an app that is no id, another shape", async (t) => {
	const { instances } = await servers(t);
	const loadWith = (piece: unknown, options: DokployOptions = { instances }) => load(t, options, { projects: [{ name: "shop", pieces: { dokploy: piece } }] });
	const refused = (problem: string) => `project shop: dokploy.project(...): ${problem}`;
	assert.equal(await refusal(loadWith({ instance: "main-secret", app: SHOP_WEB.id })), refused("its instance is not an instance of dokploy; dokploy's instances: (unnamed), client"));
	assert.equal(await refusal(loadWith({ app: SHOP_WEB.id }, { instances: instances.slice(1) })), refused("it names no instance and dokploy has no unnamed one; dokploy's instances: client"));
	for (const app of ["kXx3/../x", "", "x".repeat(65), "a b"]) assert.equal(await refusal(loadWith({ app })), refused("app is not a Dokploy application id: 1 to 64 letters, digits, _ and -"), app);
	for (const piece of ["kXx3", null, { app: 1 }, { instance: 2, app: "kXx3" }, { app: "kXx3", url: "https://x" }]) assert.equal(await refusal(loadWith(piece)), refused("expected { instance?, app }, each a string"), JSON.stringify(piece));
	await loadWith({ instance: "client", app: "x".repeat(64) });
});

test("refused at load, naming the option and the variable but never its value: a token a header cannot carry", async (t) => {
	const { instances } = await servers(t);
	for (const token of ["", `${TOKEN} `, `${TOKEN}\n`, `${TOKEN}é`])
		assert.equal(await refusal(load(t, { instances }, { env: { ...ENV, ARTHUR_DOKPLOY_TOKEN: token } })), "instances[0].tokenEnv: ARTHUR_DOKPLOY_TOKEN is empty or holds a space or a character outside ASCII, which a header cannot carry");
	assert.equal(await refusal(load(t, { instances }, { env: { ARTHUR_DOKPLOY_TOKEN: TOKEN } })), "instances[1].tokenEnv: ARTHUR_DOKPLOY_CLIENT_TOKEN is empty or holds a space or a character outside ASCII, which a header cannot carry", "a variable not set");
});
