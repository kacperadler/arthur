import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { type DokployOptions, dokploy } from "../src/dokploy.ts";
import { type FakeApp, fakeDokploy, SECRETS, type Seen, TOKEN, trpcError } from "./fake-dokploy.ts";

// `arthur dokploy create|setup|env` (AR0654) on the fake host, against two fake Dokploy servers: the unnamed instance answering
// as Dokploy v0.30.10, `client` as the documentation's example. docs/commands/dokploy.md.

const CLIENT_TOKEN = "cl1entT0kenN3verPr1ntedcl1entT0kenN3verPr1ntedcl1entT0kenN3verPr1nt";
const NOTHING = "nothing was asked of Dokploy";
const ENV = { ARTHUR_DOKPLOY_TOKEN: TOKEN, ARTHUR_DOKPLOY_CLIENT_TOKEN: CLIENT_TOKEN };

const WEB: FakeApp = { id: "kXx3shopWeb01", name: "Shop web", status: "done", project: "Shop", environment: "production", domains: [{ host: "shop.example", https: true }] };
const API: FakeApp = { id: "kXx3shopApi02", name: "Shop API", status: "done", project: "Shop", environment: "staging", mounts: [{ type: "bind", mountPath: "/var/data" }] };
// An app as `create` leaves it: Dokploy's defaults.
const FRESH: FakeApp = { id: "kXx3fresh03", name: "Fresh", status: "idle", project: "Shop", environment: "production", sourceType: "github", dockerfile: "Dockerfile", env: null };
// An env with a comment, an `export`, and a value over three lines holding what looks like a variable.
const KEPT = '# shop\nDATABASE_URL=postgres://shop:s3cr3t-db@db/shop\nexport API_KEY=s3cr3tApiKey\nCERT="-----BEGIN\nTLS_KEY=s3cr3tInCert\n-----END"\n';
const ENVED: FakeApp = { id: "kXx3env04", name: "Env app", status: "done", project: "Shop", environment: "production", env: KEPT };
const CLIENT_SITE: FakeApp = { id: "cl1entSite", name: "Client site", status: "idle", project: "Random", environment: "production" };

// Both fakes, and `run`, which runs `arthur dokploy` for a project (`shop`'s app is on the unnamed instance) and returns its
// exit code and what it printed, or rejects with its refusal.
async function load(t: TestContext, options: Partial<DokployOptions> = {}) {
	const main = await fakeDokploy(t, { apps: [WEB, API, FRESH, ENVED], empty: ["Archive"] });
	const client = await fakeDokploy(t, { apps: [CLIENT_SITE], form: "documented", token: CLIENT_TOKEN });
	const instances = [{ url: main.url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }, { name: "client", url: client.url, tokenEnv: "ARTHUR_DOKPLOY_CLIENT_TOKEN" }];
	const plugin = dokploy({ instances, ...options });
	const fake = fakeHost({ name: "dokploy", options: plugin.options, env: ENV });
	fake.provide("projects", () => [{ name: "shop", pieces: dokploy.project({ app: WEB.id }) }]);
	await fake.setup(plugin);
	const command = fake.commands.find((each) => each.name === "dokploy");
	const run = async (project: string | undefined, ...args: string[]) => {
		const [logs, errors] = [[] as string[], [] as string[]];
		const log = t.mock.method(console, "log", (text: string) => void logs.push(text));
		const error = t.mock.method(console, "error", (text: string) => void errors.push(text));
		try {
			return { code: await command?.run({ args, project }), out: logs.join("\n"), err: errors.join("\n") };
		} finally {
			log.mock.restore();
			error.mock.restore();
		}
	};
	return { main, client, run };
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

// The writes a fake saw: each POST's procedure and body.
const posts = (seen: readonly Seen[]) => seen.filter(({ method }) => method === "POST").map(({ path, sent }) => [path.replace("/api/", ""), sent?.fields]);

test("create makes the app in the project's default environment, or the one --environment names, and says how to set it up", async (t) => {
	const { main, client, run } = await load(t);
	assert.deepEqual(await run("shop", "create", "Shop admin", "--dokploy-project", "Shop"), { code: 0, out: "created Shop admin (kXx3new4) in project Shop, environment production on instance (unnamed); to set it up: arthur dokploy setup kXx3new4 --project shop", err: "" });
	assert.deepEqual(main.seen.map(({ method, path, type }) => [method, path, type]), [["GET", "/api/project.all", undefined], ["POST", "/api/application.create", "application/json"]]);
	assert.match((await run("shop", "apps")).out, /kXx3new4 Shop admin \(idle\)/);
	// A name is taken only in its own environment: Shop web is in production.
	assert.equal((await run("shop", "create", "Shop web", "--dokploy-project", "Shop", "--environment", "staging")).out, "created Shop web (kXx3new5) in project Shop, environment staging on instance (unnamed); to set it up: arthur dokploy setup kXx3new5 --project shop");
	assert.equal(main.live.find((app) => app.id === "kXx3new5")?.environment, "staging");
	// A project without apps has the production environment Dokploy makes with it.
	assert.equal((await run("shop", "create", "Old", "--dokploy-project", "Archive")).code, 0);
	assert.deepEqual(posts(client.seen), []);
});

test("create refuses before any write: a project or environment the instance lacks, no default environment, a name the environment has", async (t) => {
	const { main, client, run } = await load(t);
	const create = (...args: string[]) => refusal(run("shop", "create", ...args));
	assert.equal(await create("Web", "--dokploy-project", "Shp"), "instance (unnamed) has no project Shp; its projects: Shop, Archive; nothing was created");
	assert.equal(await create("Web", "--dokploy-project", "Shop", "--environment", "preview"), "project Shop has no environment preview; its environments: production, staging; nothing was created");
	assert.equal(await create("Shop web", "--dokploy-project", "Shop"), "project Shop, environment production already has an app named Shop web (kXx3shopWeb01); nothing was created");
	assert.equal(await create("Shop API", "--dokploy-project", "Shop", "--environment", "staging"), "project Shop, environment staging already has an app named Shop API (kXx3shopApi02); nothing was created");
	// The documentation's older answer has no environments, so no default one.
	assert.equal(await refusal(run(undefined, "create", "Web", "--dokploy-project", "Random", "--instance", "client")), "project Random has no default environment: add --environment <name>; its environments: none; nothing was created");
	// A server whose environments name none the default.
	main.scripted.set("project.all", { status: 200, body: [{ name: "Shop", environments: [{ name: "production", environmentId: "env-1", isDefault: false, applications: [] }] }] });
	assert.equal(await create("Web", "--dokploy-project", "Shop"), "project Shop has no default environment: add --environment <name>; its environments: production; nothing was created");
	assert.deepEqual([posts(main.seen), posts(client.seen)], [[], []]);
	main.scripted.delete("project.all");
	const ambiguous = `dokploy has 2 instances ((unnamed), client) and the call names none: add --instance <name>, or --project <name> of a project with dokploy.project(...); ${NOTHING}`;
	const before = [main.seen.length, client.seen.length];
	assert.equal(await refusal(run(undefined, "create", "Web", "--dokploy-project", "Shop")), ambiguous);
	assert.deepEqual([main.seen.length, client.seen.length], before);
	main.scripted.set("application.create", trpcError(401, "UNAUTHORIZED", "You need to use a server to create an application", "application.create"));
	assert.equal(await create("Web", "--dokploy-project", "Shop"), "instance (unnamed): 401: the token in ARTHUR_DOKPLOY_TOKEN was refused: You need to use a server to create an application");
});

const SET_UP = [
	"Fresh (kXx3fresh03) on instance (unnamed)",
	"build type: dockerfile docker/Web.Dockerfile, context apps/web: set",
	"domain https://fresh.shop.example/ to port 8080: added, its certificate from Let's Encrypt",
	"volume uploads at /app/uploads: added",
	"a deploy applies the build type and the volume: arthur dokploy deploy kXx3fresh03 --project shop",
];
const SETUP_ARGS = ["setup", FRESH.id, "--dockerfile", "docker/Web.Dockerfile", "--context", "apps/web", "--domain", "fresh.shop.example", "--port", "8080", "--volume", "uploads:/app/uploads"];

test("setup sets the build type, adds the domain on https with Let's Encrypt and the volume; run again, it leaves each as it is", async (t) => {
	const { main, run } = await load(t);
	assert.deepEqual(await run("shop", ...SETUP_ARGS), { code: 0, out: SET_UP.join("\n"), err: "" });
	assert.deepEqual(posts(main.seen), [
		["domain.validateDomain", { domain: "fresh.shop.example" }],
		["application.saveBuildType", { applicationId: FRESH.id, buildType: "dockerfile", dockerfile: "docker/Web.Dockerfile", dockerContextPath: "apps/web", dockerBuildStage: null, herokuVersion: "24", railpackVersion: "0.2.2" }],
		["domain.create", { host: "fresh.shop.example", port: 8080, https: true, certificateType: "letsencrypt", applicationId: FRESH.id, domainType: "application" }],
		["mounts.create", { type: "volume", volumeName: "uploads", mountPath: "/app/uploads", serviceType: "application", serviceId: FRESH.id }],
	]);
	main.seen.length = 0;
	const again = await run("shop", ...SETUP_ARGS.slice(0, 7), "FRESH.shop.example", "--port", "9090", "--volume", "uploads:/app/uploads");
	assert.deepEqual(again.out.split("\n").slice(1), ["build type: dockerfile docker/Web.Dockerfile, context apps/web: already set", "domain FRESH.shop.example: already set, to port 8080", "volume uploads at /app/uploads: already set"], "nothing written, so no deploy to apply it");
	assert.deepEqual(posts(main.seen).map(([procedure]) => procedure), ["domain.validateDomain"], "a host in other case is the same domain; nothing written");
	// One flag alone: the other build field stays as the app has it; an app without a dockerfile gets Dokploy's default.
	assert.equal((await run("shop", "setup", FRESH.id, "--dockerfile", "Dockerfile")).out.split("\n")[1], "build type: dockerfile Dockerfile, context apps/web: set");
	assert.equal((await run("shop", "setup", WEB.id, "--context", "site")).out.split("\n")[1], "build type: dockerfile Dockerfile, context site: set");
	assert.deepEqual(posts(main.seen).at(-1), ["application.saveBuildType", { applicationId: WEB.id, buildType: "dockerfile", dockerfile: "Dockerfile", dockerContextPath: "site", dockerBuildStage: null, herokuVersion: "24", railpackVersion: "0.2.2" }]);
	// Only a dockerfile build with the same file and context is already set: nixpacks with Dokploy's default file is switched.
	assert.equal((await run("shop", "setup", ENVED.id, "--dockerfile", "Dockerfile", "--context", "apps/web")).out.split("\n")[1], "build type: dockerfile Dockerfile, context apps/web: set");
	assert.deepEqual(posts(main.seen).at(-1)?.[0], "application.saveBuildType");
});

test("setup warns of a domain Dokploy finds not pointing at the server, and still adds it", async (t) => {
	const { main, run } = await load(t);
	const elsewhere = await run("shop", "setup", FRESH.id, "--domain", "elsewhere.shop.example", "--port", "3000");
	assert.equal(elsewhere.err, "warning: elsewhere.shop.example does not resolve to the server of Fresh (kXx3fresh03) on instance (unnamed): Domain resolves to 198.51.100.7 but should point to 203.0.113.10");
	assert.deepEqual([elsewhere.code, elsewhere.out], [0, "Fresh (kXx3fresh03) on instance (unnamed)\ndomain https://elsewhere.shop.example/ to port 3000: added, its certificate from Let's Encrypt"], "a domain alone needs no deploy");
	const gone = await run("shop", "setup", FRESH.id, "--domain", "shop.invalid", "--port", "3000");
	assert.equal(gone.err, "warning: shop.invalid does not resolve to the server of Fresh (kXx3fresh03) on instance (unnamed): queryA ENOTFOUND shop.invalid");
	assert.deepEqual(main.live.find((app) => app.id === FRESH.id)?.domains?.map(({ host }) => host), ["elsewhere.shop.example", "shop.invalid"]);
	// An answer without isValid is no proof the host points at the server.
	main.scripted.set("domain.validateDomain", { status: 200, body: {} });
	assert.match((await run("shop", "setup", FRESH.id, "--domain", "x.shop.example", "--port", "3000")).err, /^warning: x\.shop\.example does not resolve to the server of Fresh \(kXx3fresh03\) on instance \(unnamed\): unknown$/);
});

test("setup refuses before any request a port or a volume it cannot send, and after the read a path another mount holds", async (t) => {
	const { main, run } = await load(t);
	for (const port of ["0", "65536", "80a", "123456", "1e3"]) assert.equal(await refusal(run("shop", "setup", FRESH.id, "--domain", "a.example", "--port", port)), `--port ${port} is not a port: 1 to 65535; ${NOTHING}`, port);
	for (const volume of ["data", "data:app", ":/app", "da ta:/app", "_x:/app"]) assert.equal(await refusal(run("shop", "setup", FRESH.id, "--volume", volume)), `--volume ${volume} is not <name>:<path>: a name of letters, digits, _, . and -, then a path from /; ${NOTHING}`, volume);
	assert.deepEqual(main.seen, []);
	assert.equal((await run("shop", "setup", FRESH.id, "--domain", "a.example", "--port", "65535")).code, 0, "the highest port");
	assert.equal((await run("shop", "setup", FRESH.id, "--domain", "b.example", "--port", "1")).code, 0, "the lowest port");
	main.seen.length = 0;
	assert.equal(await refusal(run("shop", "setup", API.id, "--volume", "data:/var/data", "--dockerfile", "Dockerfile")), "Shop API (kXx3shopApi02) on instance (unnamed) already mounts bind unknown at /var/data; nothing was changed");
	assert.equal((await run("shop", "setup", FRESH.id, "--volume", "uploads:/app/uploads")).code, 0);
	assert.equal(await refusal(run("shop", "setup", FRESH.id, "--volume", "files:/app/uploads")), "Fresh (kXx3fresh03) on instance (unnamed) already mounts volume uploads at /app/uploads; nothing was changed");
	assert.deepEqual(posts(main.seen).map(([procedure]) => procedure), ["mounts.create"]);
	main.scripted.set("application.saveBuildType", trpcError(400, "BAD_REQUEST", "Input validation failed", "application.saveBuildType"));
	assert.equal(await refusal(run("shop", "setup", FRESH.id, "--context", ".")), "instance (unnamed): 400 for the build type of app kXx3fresh03: Input validation failed");
});

test("env names prints the names of the app's env in name order, never a value: a comment, export and a value over several lines are no names", async (t) => {
	const { main, run } = await load(t);
	assert.deepEqual(await run("shop", "env", ENVED.id, "names"), { code: 0, out: "Env app (kXx3env04) on instance (unnamed)\nAPI_KEY\nCERT\nDATABASE_URL", err: "" });
	assert.deepEqual(await run("shop", "env", FRESH.id, "names"), { code: 0, out: "Fresh (kXx3fresh03) on instance (unnamed): no variables", err: "" });
	assert.deepEqual(main.seen.map(({ method, path }) => [method, path]), [["GET", "/api/application.one"], ["GET", "/api/application.one"]]);
});

test("env set adds or replaces one variable, sends every other line and the build args and secrets back as they were, and never prints the value", async (t) => {
	const { main, run } = await load(t);
	const said: string[] = [];
	const set = async (app: string, name: string, value: string) => {
		const { code, out, err } = await run("shop", "env", app, "set", name, value);
		said.push(out, err);
		assert.equal(code, 0);
		return out;
	};
	const kept = { buildArgs: "NPM_TOKEN=npm_s3cr3tBuildArg", buildSecrets: "SENTRY_AUTH=s3cr3tBuildSecret", createEnvFile: true };
	assert.equal(await set(ENVED.id, "SESSION_SECRET", "s3cr3tSession"), "Env app (kXx3env04) on instance (unnamed): SESSION_SECRET added; every other line kept; a deploy applies it: arthur dokploy deploy kXx3env04 --project shop");
	assert.deepEqual(posts(main.seen), [["application.saveEnvironment", { applicationId: ENVED.id, env: `${KEPT}SESSION_SECRET=s3cr3tSession`, ...kept }]]);
	assert.equal(await set(ENVED.id, "API_KEY", "s3cr3tNewKey"), "Env app (kXx3env04) on instance (unnamed): API_KEY replaced, on 1 line; every other line kept; a deploy applies it: arthur dokploy deploy kXx3env04 --project shop");
	assert.equal(main.live.find((app) => app.id === ENVED.id)?.env, `${KEPT.replace("export API_KEY=s3cr3tApiKey", "API_KEY=s3cr3tNewKey")}SESSION_SECRET=s3cr3tSession`);
	// A value as the panel would hold it, else quoted; empty, or starting with -, as given.
	assert.match(await set(FRESH.id, "NOTE", "a #b"), /NOTE added/);
	assert.equal(main.live.find((app) => app.id === FRESH.id)?.env, "NOTE='a #b'");
	await set(FRESH.id, "DASH", "-x");
	await set(FRESH.id, "EMPTY", "");
	assert.equal(main.live.find((app) => app.id === FRESH.id)?.env, "NOTE='a #b'\nDASH=-x\nEMPTY=");
	main.seen.length = 0;
	assert.equal(await set(FRESH.id, "DASH", "-x"), "Fresh (kXx3fresh03) on instance (unnamed): DASH already holds that value; nothing was sent");
	assert.deepEqual(posts(main.seen), []);
	assert.match((await run("shop", "env", ENVED.id, "names")).out, /\nSESSION_SECRET$/);
	for (const secret of [...SECRETS, "s3cr3tSession", "s3cr3tNewKey", "s3cr3tApiKey", "s3cr3tInCert", "a #b"]) assert.ok(!said.join("\n").includes(secret), `printed: ${secret}`);
});

test("env set refuses a name that is none before any request, and after the read a value no line can hold or a name inside another value", async (t) => {
	const { main, run } = await load(t);
	for (const name of ["1A", "A-B", "A B", "A=B"]) assert.equal(await refusal(run("shop", "env", FRESH.id, "set", name, "v")), `${name} is not a variable name: a letter or _, then letters, digits and _; ${NOTHING}`, name);
	assert.deepEqual(main.seen, []);
	assert.equal(await refusal(run("shop", "env", FRESH.id, "set", "A", "x' \"#y")), "Fresh (kXx3fresh03) on instance (unnamed): the value of A cannot be written as a line that reads back as given, as it is or in either quotes; set it in Dokploy's panel; nothing was sent");
	const inside = "the env holds TLS_KEY over several lines or inside another value, so a line set here would change another; set it in Dokploy's panel; nothing was sent";
	assert.equal(await refusal(run("shop", "env", ENVED.id, "set", "TLS_KEY", "new")), `Env app (kXx3env04) on instance (unnamed): ${inside}`);
	assert.equal(await refusal(run("shop", "env", ENVED.id, "set", "CERT", "short")), `Env app (kXx3env04) on instance (unnamed): ${inside.replace("TLS_KEY", "CERT")}`);
	assert.deepEqual(posts(main.seen), []);
});

test("env set hides from Dokploy's error every value it sent; a read error is as any other", async (t) => {
	const { main, run } = await load(t);
	// A database error quotes the query's parameters: the whole env, a value of it, and the build secrets.
	main.scripted.set("application.saveEnvironment", trpcError(500, "INTERNAL_SERVER_ERROR", `Failed query: update "application" params: ${KEPT}NEW=s3cr3tNew,s3cr3tApiKey,SENTRY_AUTH=s3cr3tBuildSecret`, "application.saveEnvironment"));
	const said = await refusal(run("shop", "env", ENVED.id, "set", "NEW", "s3cr3tNew"));
	assert.equal(said, 'instance (unnamed): 500 for the env of app kXx3env04: Failed query: update "application" params: [hidden],[hidden],[hidden]');
	main.scripted.set("application.one", trpcError(403, "FORBIDDEN", "You don't have access to this service", "application.one"));
	assert.equal(await refusal(run("shop", "env", ENVED.id, "names")), "instance (unnamed): 403: the token's user may not read app kXx3env04: You don't have access to this service");
});
