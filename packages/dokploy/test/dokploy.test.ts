import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { type DokployOptions, dokploy } from "../src/dokploy.ts";
import { type FakeDeployment, fakeDokploy, readZip, SECRETS, type Seen, TOKEN, trpcError } from "./fake-dokploy.ts";

// The dokploy plugin on the fake host, against two fake Dokploy servers: the unnamed instance answering as Dokploy
// v0.30.10, `client` as the documentation's example. docs/commands/dokploy.md.

const CLIENT_TOKEN = "cl1entT0kenN3verPr1ntedcl1entT0kenN3verPr1ntedcl1entT0kenN3verPr1nt";
const USAGE = "usage: arthur dokploy apps|app [<app>]|status [<app>]|upload [<app>] <file or folder> [--replace-source]|deploy [<app>]|create <name> --dokploy-project <name> [--environment <name>]|setup <app> [--dockerfile <path>] [--context <path>] [--domain <host> --port <n>] [--volume <name>:<path>]|env <app> names|env <app> set <NAME> <value>|source <app> --repo <owner>/<name> --branch <branch> [--build-path <path>] [--github <name>] [--replace-source]|postgres create <app> <name> [--version <n>] [--env <NAME>]|postgres status <postgres>, each [--instance <name>]; --project <name> for another project than the main one";
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
	const wrong = [[], ["apps", "x"], ["app", "a", "b"], ["status", "a", "b"], ["app", "--instance"], ["app", "--instance", "--project"], ["app", "--instance", "client", "--instance", "client"], ["app", "--all"], ["status", "-x"]];
	// The writes: upload without a path or with a word too many, deploy with a word too many; --replace-source only on upload,
	// once; a verb an object has by its prototype.
	wrong.push(["upload"], ["upload", "a", "b", "c"], ["deploy", "a", "b"], ["deploy", "--replace-source"], ["app", "--replace-source"], ["upload", "dist", "--replace-source", "--replace-source"], ["toString"], ["constructor", "x"]);
	// AR0654: create without its name or --dokploy-project, or with a word too many; setup without its app or any of its flags,
	// --domain without --port or the other way round, a flag twice or another verb's; env without names or set, or with a word
	// too many or too few; a setup or create flag on another verb.
	wrong.push(["create"], ["create", "--dokploy-project", "Shop"], ["create", "Web"], ["create", "Web", "x", "--dokploy-project", "Shop"], ["create", "Web", "--dokploy-project", "-x"], ["create", "Web", "--dokploy-project", "Shop", "--dokploy-project", "Shop"]);
	wrong.push(["setup"], ["setup", "kXx3"], ["setup", "kXx3", "--instance", "client"], ["setup", "kXx3", "--domain", "a.example"], ["setup", "kXx3", "--port", "80"], ["setup", "kXx3", "--volume", "a:/a", "--volume", "b:/b"], ["setup", "kXx3", "--environment", "x"], ["setup", "--context", "."]);
	wrong.push(["env", "kXx3"], ["env", "kXx3", "names", "x"], ["env", "kXx3", "set", "A"], ["env", "kXx3", "set", "A", "1", "2"], ["env", "kXx3", "get", "A"], ["env", "-x", "names"], ["env", "kXx3", "set", "-A", "1"], ["app", "--dockerfile", "Dockerfile"], ["deploy", "--dokploy-project", "Shop"], ["upload", "dist", "--volume", "a:/a"]);
	// AR0681: env with another word where names or set goes, as many words as either takes.
	wrong.push(["env", "kXx3", "get"], ["env", "kXx3", "get", "A", "1"]);
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

// The writes (AR0603) against a fake of their own: SHOP_WEB deploys from drop with deployments, SHOP_API from GitHub
// without any, LIVE from GitHub with deployments, BUILT from drop under a build path the owner set.
const LIVE = { id: "kXx3liveApi04", name: "Live API", status: "done", project: "Shop", environment: "production", sourceType: "github", deployments: [deployed(27, "done")] } as const;
const BUILT = { id: "kXx3built05", name: "Built site", status: "done", project: "Shop", environment: "production", dropBuildPath: "apps/web" } as const;
async function writes(t: TestContext) {
	const main = await fakeDokploy(t, { apps: [SHOP_WEB, SHOP_API, LIVE, BUILT] });
	const client = await fakeDokploy(t, { apps: [CLIENT_SITE], form: "documented", token: CLIENT_TOKEN });
	const run = await load(t, { instances: [{ url: main.url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }, { name: "client", url: client.url, tokenEnv: "ARTHUR_DOKPLOY_CLIENT_TOKEN" }] });
	return { main, client, run };
}

// A folder of the test's own, removed at its end, holding `files` by their path in it.
function folder(t: TestContext, files: Readonly<Record<string, string | Buffer>> = {}) {
	const root = mkdtempSync(join(tmpdir(), "arthur-dokploy-test-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	for (const [name, data] of Object.entries(files)) {
		mkdirSync(dirname(join(root, name)), { recursive: true });
		writeFileSync(join(root, name), data);
	}
	return root;
}

// What a fake's last dropDeployment got: its form's fields, and its file, the zip.
function dropped(seen: readonly Seen[]) {
	const sent = seen.findLast(({ path }) => path === "/api/application.dropDeployment")?.sent;
	const file = sent?.files.zip;
	assert.ok(sent !== undefined && file !== undefined, "a dropDeployment with its zip");
	return { fields: sent.fields, name: file.name, type: file.type, zip: file.bytes };
}

test("upload zips a folder's regular files at the zip's root, sends the zip to dropDeployment as a form, and says what went where and how to follow it", async (t) => {
	const { main, run } = await writes(t);
	const noise = randomBytes(300);
	const site = folder(t, { "index.html": "<h1>Shop</h1>\n".repeat(40), "assets/app.js": "console.log('shop');\n", "assets/img/logo.bin": noise, "empty.txt": "", "é.txt": "é" });
	mkdirSync(join(site, "assets", "unused"));
	const { code, out, err } = await run(undefined, "upload", site);
	const { fields, name, type, zip } = dropped(main.seen);
	assert.deepEqual({ code, out, err }, { code: 0, out: `Shop web (kXx3shopWeb01) on instance (unnamed): sent 5 files, ${560 + 21 + 300 + 2} bytes, as a zip of ${zip.length} bytes; Dokploy queued a deployment; to follow it: arthur dokploy status`, err: "" });
	// A Content-Type only on what has a body: the read none, the form its multipart one.
	assert.deepEqual(main.seen.map(({ method, path, key, type }) => [method, path, key, type?.split(";")[0]]), [["GET", "/api/application.one", TOKEN, undefined], ["POST", "/api/application.dropDeployment", TOKEN, "multipart/form-data"]]);
	assert.match(main.seen[1]?.type ?? "", /^multipart\/form-data; boundary=/);
	assert.deepEqual([fields, name, type], [{ applicationId: SHOP_WEB.id }, "upload.zip", "application/zip"], "no dropBuildPath: the app has none");
	const entries = readZip(zip);
	assert.deepEqual(entries.map(({ name, method, mode }) => [name, method, mode]), [["assets/app.js", 0, 0o100644], ["assets/img/logo.bin", 0, 0o100644], ["empty.txt", 0, 0o100644], ["index.html", 8, 0o100644], ["é.txt", 0, 0o100644]], "deflated only when smaller; no folder entry");
	assert.deepEqual(entries.map(({ data }) => data), [Buffer.from("console.log('shop');\n"), noise, Buffer.alloc(0), Buffer.from("<h1>Shop</h1>\n".repeat(40)), Buffer.from("é")]);
	// One file: itself at the zip's root; the owner's build path sent back, so Dokploy keeps it.
	const page = join(folder(t, { "page.html": "<p>hi</p>" }), "page.html");
	assert.match((await run("shop", "upload", BUILT.id, page)).out, /^Built site \(kXx3built05\) on instance \(unnamed\): sent 1 file, 9 bytes, as a zip of \d+ bytes; Dokploy queued a deployment; to follow it: arthur dokploy status kXx3built05 --project shop$/);
	const built = dropped(main.seen);
	assert.deepEqual(built.fields, { applicationId: BUILT.id, dropBuildPath: "apps/web" });
	assert.deepEqual(readZip(built.zip).map(({ name, data }) => [name, data.toString()]), [["page.html", "<p>hi</p>"]]);
});

test("upload sends a ready .zip as it is; a .zip that is no zip, or a zip by another name, goes inside a zip as a file", async (t) => {
	const { main, client, run } = await writes(t);
	assert.equal((await run(undefined, "upload", folder(t, { "a.txt": "a" }))).code, 0);
	const { zip } = dropped(main.seen);
	const files = folder(t, { "site.ZIP": zip, "notes.zip": "not a zip", "bundle.jar": zip });
	assert.equal((await run("client", "upload", join(files, "site.ZIP"))).out, `Client site (cl1entSite) on instance client: sent site.ZIP as it is, ${zip.length} bytes; Dokploy queued a deployment; to follow it: arthur dokploy status --project client`);
	assert.deepEqual(dropped(client.seen).zip, zip);
	for (const name of ["notes.zip", "bundle.jar"]) {
		assert.equal((await run("client", "upload", join(files, name))).code, 0, name);
		assert.deepEqual(readZip(dropped(client.seen).zip).map((entry) => entry.name), [name]);
	}
	// A folder named .zip is a folder: zipped, its files at the root.
	mkdirSync(join(files, "dist.zip"));
	writeFileSync(join(files, "dist.zip", "index.html"), "<p>dist</p>");
	assert.equal((await run("client", "upload", join(files, "dist.zip"))).code, 0);
	assert.deepEqual(readZip(dropped(client.seen).zip).map((entry) => entry.name), ["index.html"]);
});

test("upload refuses before any request: a missing or unreadable path, a symlink, an empty folder, a symlink or special file inside, past 65535 files or 4 GiB", async (t) => {
	const { main, client, run } = await writes(t);
	const root = folder(t, { "site/index.html": "<h1>Shop</h1>", "secret.txt": "x", "site/sub/page.html": "p" });
	const refused = async (path: string, why: string) => assert.equal(await refusal(run(undefined, "upload", path)), `${path}: ${why}; ${NOTHING}`, path);
	await refused(join(root, "gone"), "cannot be read (ENOENT)");
	symlinkSync(join(root, "site"), join(root, "link"));
	await refused(join(root, "link"), "is a symlink; give the path it points to");
	mkdirSync(join(root, "hollow", "inner"), { recursive: true });
	await refused(join(root, "hollow"), "is a folder without any file");
	symlinkSync("../../secret.txt", join(root, "site", "sub", "leak.txt"));
	await refused(join(root, "site"), "sub/leak.txt is a symlink, not a regular file");
	rmSync(join(root, "site", "sub", "leak.txt"));
	symlinkSync(join(root, "nowhere"), join(root, "site", "dangling"));
	await refused(join(root, "site"), "dangling is a symlink, not a regular file");
	rmSync(join(root, "site", "dangling"));
	execFileSync("mkfifo", [join(root, "site", "sub", "pipe")]);
	await refused(join(root, "site"), "sub/pipe is a special file, not a regular file");
	await refused(join(root, "site", "sub", "pipe"), "is no file or folder");
	rmSync(join(root, "site", "sub", "pipe"));
	if (process.getuid?.() !== 0) {
		chmodSync(join(root, "secret.txt"), 0);
		await refused(join(root, "secret.txt"), "cannot be read (EACCES)");
		chmodSync(join(root, "site", "sub"), 0);
		await refused(join(root, "site"), "cannot be read (EACCES)");
		chmodSync(join(root, "site", "sub"), 0o700);
	}
	// The zip's size: every file stored as it is, a 30 and a 46 byte header and its name twice each, then 22 bytes.
	const big = folder(t, { "big.bin": "" });
	truncateSync(join(big, "big.bin"), 2 ** 32 - 112);
	await refused(big, "its files come to 4294967296 bytes as a zip, more than the 4 GiB a zip without zip64 holds");
	const halves = folder(t, { "a.bin": "", "b.bin": "" });
	for (const name of ["a.bin", "b.bin"]) truncateSync(join(halves, name), 2 ** 31);
	await refused(halves, `its files come to ${2 ** 32 + 2 * (76 + 10) + 22} bytes as a zip, more than the 4 GiB a zip without zip64 holds`);
	assert.deepEqual([main.seen, client.seen], [[], []]);
	// 65535 files go, one more is refused.
	const many = folder(t);
	for (let index = 0; index < 65536; index++) writeFileSync(join(many, `${index}`), "");
	await refused(many, "holds 65536 files, more than the 65535 a zip holds");
	assert.deepEqual([main.seen, client.seen], [[], []]);
	rmSync(join(many, "0"));
	assert.equal((await run(undefined, "upload", many)).code, 0);
	assert.equal(readZip(dropped(main.seen).zip).length, 65535);
});

test("upload refuses an app that deploys from another source and has deployments, after reading it and before sending, unless --replace-source", async (t) => {
	const { main, run } = await writes(t);
	const site = folder(t, { "index.html": "<h1>Live</h1>" });
	const switched = "deploys from github and has deployments; an upload makes it deploy from drop: add --replace-source for that; nothing was sent";
	assert.equal(await refusal(run("shop", "upload", LIVE.id, site)), `Live API (kXx3liveApi04) on instance (unnamed) ${switched}`);
	assert.deepEqual(main.seen.map(({ method, path }) => [method, path]), [["GET", "/api/application.one"]]);
	assert.equal((await run("shop", "upload", LIVE.id, site, "--replace-source")).code, 0);
	assert.equal(dropped(main.seen).fields.applicationId, LIVE.id);
	assert.equal((await run("shop", "upload", SHOP_API.id, site)).code, 0, "from GitHub but never deployed: Dokploy's default source of a new app");
	assert.equal(dropped(main.seen).fields.applicationId, SHOP_API.id);
	// A server that leaves out the source or the deployments is taken as one that would be switched.
	main.scripted.set("application.one", { status: 200, body: { applicationId: LIVE.id, name: "Odd" } });
	assert.equal(await refusal(run("shop", "upload", LIVE.id, site)), `Odd (kXx3liveApi04) on instance (unnamed) deploys from unknown and has deployments; an upload makes it deploy from drop: add --replace-source for that; nothing was sent`);
	assert.equal(main.seen.filter(({ path }) => path === "/api/application.dropDeployment").length, 2);
});

test("deploy posts the app's id to application.deploy as JSON, takes Dokploy's empty answer, and refuses as reads do", async (t) => {
	const { main, client, run } = await writes(t);
	assert.deepEqual(await run(undefined, "deploy"), { code: 0, out: "app kXx3shopWeb01 on instance (unnamed): Dokploy queued a deployment; to follow it: arthur dokploy status", err: "" });
	assert.deepEqual(main.seen.map(({ method, path, key, type, sent }) => [method, path, key, type, sent?.fields]), [["POST", "/api/application.deploy", TOKEN, "application/json", { applicationId: SHOP_WEB.id }]]);
	assert.equal((await run(undefined, "deploy", CLIENT_SITE.id, "--instance", "client")).out, "app cl1entSite on instance client: Dokploy queued a deployment; to follow it: arthur dokploy status cl1entSite --instance client");
	assert.equal(await refusal(run(undefined, "deploy", "kXx3gone", "--instance", "client")), "instance client: 404: app kXx3gone not found");
	main.scripted.set("application.deploy", trpcError(403, "FORBIDDEN", "You don't have access to this service", "application.deploy"));
	assert.equal(await refusal(run(undefined, "deploy")), "instance (unnamed): 403: the token's user may not change app kXx3shopWeb01: You don't have access to this service");
	main.scripted.set("application.deploy", "not-json");
	assert.equal(await refusal(run(undefined, "deploy")), "instance (unnamed): the answer for app kXx3shopWeb01 is not JSON");
	// Only a write's answer may be empty, and only when it succeeded.
	main.scripted.set("application.deploy", { empty: 502 });
	assert.equal(await refusal(run(undefined, "deploy")), "instance (unnamed): 502 for app kXx3shopWeb01: Bad Gateway");
	main.scripted.set("application.one", { empty: 200 });
	assert.equal(await refusal(run(undefined, "app")), "instance (unnamed): the answer for app kXx3shopWeb01 is not JSON");
	const before = [main.seen.length, client.seen.length];
	const ambiguous = `dokploy has 2 instances ((unnamed), client) and the call names none: add --instance <name>, or --project <name> of a project with dokploy.project(...); ${NOTHING}`;
	assert.equal(await refusal(run(undefined, "deploy", SHOP_API.id)), ambiguous);
	assert.equal(await refusal(run(undefined, "upload", SHOP_API.id, "/nowhere")), ambiguous);
	assert.deepEqual([main.seen.length, client.seen.length], before);
});
