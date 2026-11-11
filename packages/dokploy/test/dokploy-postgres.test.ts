import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { dokploy } from "../src/dokploy.ts";
import { type FakeApp, type FakePostgres, fakeDokploy, SECRETS, type Seen, type Sent, TOKEN, trpcError } from "./fake-dokploy.ts";

// `arthur dokploy postgres create|status` (AR0681) on the fake host, against a fake Dokploy answering as v0.30.10.
// docs/commands/dokploy.md.

const NOTHING = "nothing was asked of Dokploy";
const CHANGED = "nothing was changed";
// Dokploy's DATABASE_PASSWORD_REGEX (schema/utils.ts at v0.30.10).
const DOKPLOY_PASSWORD = /^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/;

const WEB: FakeApp = { id: "kXx3web07", name: "Web", status: "done", project: "Shop", environment: "production", env: "PORT=3000\n# the web app\nNODE_ENV=production" };
// On a remote server, without any env.
const REMOTE: FakeApp = { id: "kXx3remote11", name: "Remote", status: "done", project: "Shop", environment: "production", env: null, serverId: "srv-remote1" };
// The fake's default env, which sets DATABASE_URL already.
const TAKEN: FakeApp = { id: "kXx3taken09", name: "Taken", status: "done", project: "Shop", environment: "production" };
const STAGED: FakeApp = { id: "kXx3staged08", name: "Staged", status: "done", project: "Shop", environment: "staging", env: "PORT=3000" };
const DETACHED: FakeApp = { ...WEB, id: "kXx3detached10", name: "Detached", detachDokployNetwork: true };
// Its own networks leave dokploy-network out, which Dokploy then does not add (resolveServiceNetworks).
const SWARM: FakeApp = { ...WEB, id: "kXx3swarm12", name: "Swarm", networkSwarm: [{ Target: "shop-net" }] };
const SWARMED: FakeApp = { ...WEB, id: "kXx3swarmed13", name: "Swarmed", networkSwarm: [{ Target: "shop-net" }, { Target: "dokploy-network" }] };
// Deployed already, in staging, with two backups.
const KEPT: FakePostgres = {
	...{ id: "pgKept02", name: "db", project: "Shop", environment: "staging", appName: "shop-db-x1y2z3", status: "done" },
	backups: [{ id: "bk1", schedule: "0 3 * * *", destination: "s3-main", keep: 7, enabled: true }, { id: "bk2", schedule: "0 * * * *", destination: "s3-cold", keep: null, enabled: null }],
};
// Made by hand in the panel, never deployed: its own user and database, a password with characters a URL encodes.
const IDLE: FakePostgres = { id: "pgIdle03", name: "cache", project: "Shop", environment: "staging", appName: "shop-cache-a1b2c3", status: "idle", user: "shop", database: "shopdb", password: "p@ss#w0rd%1" };
// What a run printed, and its exit code or its refusal.
type Ran = { readonly code?: number | void; readonly refused?: string; readonly out: string; readonly err: string };

// The fake and `run`, which runs `arthur dokploy` for the project `shop`.
async function load(t: TestContext, timeoutSeconds?: number) {
	const main = await fakeDokploy(t, { apps: [WEB, REMOTE, TAKEN, STAGED, DETACHED, SWARM, SWARMED], databases: [KEPT, IDLE] });
	const plugin = dokploy({ instances: [{ url: main.url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }], ...(timeoutSeconds === undefined ? {} : { timeoutSeconds }) });
	const fake = fakeHost({ name: "dokploy", options: plugin.options, env: { ARTHUR_DOKPLOY_TOKEN: TOKEN } });
	fake.provide("projects", () => [{ name: "shop", pieces: dokploy.project({ app: WEB.id }) }]);
	await fake.setup(plugin);
	const command = fake.commands.find((each) => each.name === "dokploy");
	const run = async (...args: string[]): Promise<Ran> => {
		const [logs, errors] = [[] as string[], [] as string[]];
		const log = t.mock.method(console, "log", (text: string) => void logs.push(text));
		const error = t.mock.method(console, "error", (text: string) => void errors.push(text));
		try {
			const code = await command?.run({ args, project: "shop" });
			return { code, out: logs.join("\n"), err: errors.join("\n") };
		} catch (refused) {
			return { refused: (refused as Error).message, out: logs.join("\n"), err: errors.join("\n") };
		} finally {
			log.mock.restore();
			error.mock.restore();
		}
	};
	return { main, run };
}

// The requests the fake saw: each method and procedure; and each POST's procedure and body.
const calls = (seen: readonly Seen[]) => seen.map(({ method, path }) => `${method} ${path.replace("/api/", "")}`);
const posts = (seen: readonly Seen[]) => seen.filter(({ method }) => method === "POST").map(({ path, sent }) => [path.replace("/api/", ""), sent?.fields] as const);
const sentPassword = (seen: readonly Seen[]) => String(seen.find(({ path }) => path === "/api/postgres.create")?.sent?.fields.databasePassword);
const leaks = (printed: string, ...more: string[]) => [...SECRETS, ...more].filter((secret) => printed.includes(secret));

test("postgres create makes a Postgres in the app's environment, writes its internal URL into the app's env, then deploys it; run again, it writes nothing", async (t) => {
	const { main, run } = await load(t);
	const done = await run("postgres", "create", WEB.id, "db");
	const password = sentPassword(main.seen);
	assert.match(password, /^[0-9a-f]{64}$/);
	assert.match(password, DOKPLOY_PASSWORD);
	const host = "postgres-parse-online-pixel-k7m2q3";
	const created = `created Postgres db (pgNew2) beside Web (${WEB.id}) on instance (unnamed), internal host ${host}:5432, image postgres:18`;
	const env = `Web (${WEB.id}) on instance (unnamed): DATABASE_URL added; every other line kept; a deploy applies it: arthur dokploy deploy ${WEB.id} --project shop`;
	assert.deepEqual(done, { code: 0, out: `${created}\n${env}\nPostgres db (pgNew2): deployed; to see it: arthur dokploy postgres status pgNew2 --project shop`, err: "" });
	assert.deepEqual(calls(main.seen), ["GET application.one", "GET environment.one", "POST postgres.create", "POST application.saveEnvironment", "POST postgres.deploy"]);
	assert.deepEqual(main.seen[1]?.query, { environmentId: "env-shop-production" });
	const url = `postgresql://postgres:${password}@${host}:5432/postgres`;
	const body = { name: "db", environmentId: "env-shop-production", dockerImage: "postgres:18", databaseName: "postgres", databaseUser: "postgres", databasePassword: password };
	const saved = { applicationId: WEB.id, env: `${WEB.env}\nDATABASE_URL=${url}`, buildArgs: "NPM_TOKEN=npm_s3cr3tBuildArg", buildSecrets: "SENTRY_AUTH=s3cr3tBuildSecret", createEnvFile: true };
	assert.deepEqual(posts(main.seen), [["postgres.create", body], ["application.saveEnvironment", saved], ["postgres.deploy", { postgresId: "pgNew2" }]]);
	assert.deepEqual(leaks(done.out + done.err, password, url), []);
	assert.equal(main.postgres.at(-1)?.status, "done");
	main.seen.length = 0;
	const again = await run("postgres", "create", WEB.id, "db");
	assert.deepEqual(calls(main.seen), ["GET application.one", "GET environment.one", "GET postgres.one"]);
	const kept = `Postgres db (pgNew2) beside Web (${WEB.id}) on instance (unnamed), internal host ${host}:5432: already there`;
	const held = `Web (${WEB.id}) on instance (unnamed): DATABASE_URL already holds that value; nothing was sent`;
	assert.deepEqual(again, { code: 0, out: `${kept}\n${held}\nPostgres db (pgNew2) is done: not deployed again; to see it: arthur dokploy postgres status pgNew2 --project shop`, err: "" });
	const status = await run("postgres", "status", "pgNew2");
	const lines = [`Postgres db (pgNew2) on instance (unnamed): done`, `image postgres:18, internal host ${host}:5432, database postgres, user postgres`, `volume ${host}-data at /var/lib/postgresql/18/docker`, "no backups"];
	assert.deepEqual(status, { code: 0, out: lines.join("\n"), err: "" });
	assert.deepEqual(leaks(status.out, password), []);
});

test("postgres create takes the app's server, --version and --env, and a new password each time", async (t) => {
	const { main, run } = await load(t);
	assert.equal((await run("postgres", "create", REMOTE.id, "db", "--version", "16", "--env", "SHOP_DB")).code, 0);
	const [first] = posts(main.seen);
	assert.deepEqual({ ...first?.[1], databasePassword: "" }, { name: "db", environmentId: "env-shop-production", serverId: "srv-remote1", dockerImage: "postgres:16", databaseName: "postgres", databaseUser: "postgres", databasePassword: "" });
	const password = sentPassword(main.seen);
	assert.equal(main.live.find((app) => app.id === REMOTE.id)?.env, `SHOP_DB=postgresql://postgres:${password}@postgres-parse-online-pixel-k7m2q3:5432/postgres`);
	// Postgres before 18 keeps its data in /var/lib/postgresql/data.
	assert.match((await run("postgres", "status", "pgNew2")).out, /^volume postgres-parse-online-pixel-k7m2q3-data at \/var\/lib\/postgresql\/data$/m);
	main.seen.length = 0;
	assert.equal((await run("postgres", "create", WEB.id, "other", "--version", "99")).code, 0);
	assert.equal(posts(main.seen)[0]?.[1]?.dockerImage, "postgres:99");
	assert.notEqual(sentPassword(main.seen), password);
	main.seen.length = 0;
	assert.equal((await run("postgres", "create", WEB.id, "third", "--version", "1", "--env", "_X9")).code, 0);
	assert.equal(posts(main.seen)[0]?.[1]?.dockerImage, "postgres:1");
});

test("postgres create finds a database of that name in the app's environment, writes its URL from postgres.one, and deploys it only while idle", async (t) => {
	const { main, run } = await load(t);
	const done = await run("postgres", "create", STAGED.id, "db");
	assert.deepEqual(calls(main.seen), ["GET application.one", "GET environment.one", "GET postgres.one", "POST application.saveEnvironment"]);
	assert.deepEqual(main.seen[2]?.query, { postgresId: KEPT.id });
	assert.equal(main.live.find((app) => app.id === STAGED.id)?.env, "PORT=3000\nDATABASE_URL=postgresql://postgres:pgS3cr3tKeptPassw0rd@shop-db-x1y2z3:5432/postgres");
	assert.match(done.out, /^Postgres db \(pgKept02\) beside Staged \(kXx3staged08\) on instance \(unnamed\), internal host shop-db-x1y2z3:5432: already there\n.*DATABASE_URL added;.*\nPostgres db \(pgKept02\) is done: not deployed again; /);
	assert.deepEqual(leaks(done.out + done.err), []);
	main.seen.length = 0;
	// Its own user and database, the user and password percent-encoded; idle, so deployed.
	const idle = await run("postgres", "create", STAGED.id, "cache", "--env", "CACHE_URL");
	assert.deepEqual(posts(main.seen).map(([procedure]) => procedure), ["application.saveEnvironment", "postgres.deploy"]);
	assert.match(String(main.live.find((app) => app.id === STAGED.id)?.env), /\nCACHE_URL=postgresql:\/\/shop:p%40ss%23w0rd%251@shop-cache-a1b2c3:5432\/shopdb$/);
	assert.match(idle.out, /\nPostgres cache \(pgIdle03\): deployed; to see it: arthur dokploy postgres status pgIdle03 --project shop$/);
	assert.deepEqual(leaks(idle.out + idle.err, "p@ss#w0rd%1", "p%40ss%23w0rd%251"), []);
	// The same name in another environment is another database.
	main.seen.length = 0;
	assert.equal((await run("postgres", "create", WEB.id, "db")).code, 0);
	assert.ok(calls(main.seen).includes("POST postgres.create"));
});

test("postgres create and status refuse a --version, --env or Postgres id they would not take before any request", async (t) => {
	const { main, run } = await load(t);
	const version = (given: string) => `--version ${given} is not a Postgres major version: 1 to 99; ${NOTHING}`;
	for (const given of ["0", "100", "016", "1.5", "x", "18a", "1e1"]) assert.equal((await run("postgres", "create", WEB.id, "db", "--version", given)).refused, version(given));
	const env = (given: string) => `--env ${given} is not a variable name: a letter or _, then letters, digits and _; ${NOTHING}`;
	for (const given of ["A-B", "1X", "DATABASE URL", "Ä"]) assert.equal((await run("postgres", "create", WEB.id, "db", "--env", given)).refused, env(given));
	for (const given of ["pg/1", "pg 1", "a".repeat(65)]) assert.equal((await run("postgres", "status", given)).refused, `the Postgres is not a Dokploy id: 1 to 64 letters, digits, _ and -; ${NOTHING}`);
	assert.equal((await run("postgres", "create", "kXx3/web", "db")).refused, `the app is not a Dokploy application id: 1 to 64 letters, digits, _ and -; ${NOTHING}`);
	assert.deepEqual(main.seen, []);
});

test("postgres create refuses after its reads and before any write: an app that sets the name to another value, an app off dokploy-network", async (t) => {
	const { main, run } = await load(t);
	const taken = await run("postgres", "create", TAKEN.id, "db");
	assert.equal(taken.refused, `Taken (${TAKEN.id}) on instance (unnamed) already sets DATABASE_URL to another value: give --env <NAME> for another name; ${CHANGED}`);
	assert.deepEqual(leaks(taken.refused ?? ""), []);
	// A database already there whose URL the app's value is not.
	const index = main.live.findIndex((app) => app.id === STAGED.id);
	main.live[index] = { ...STAGED, env: "DATABASE_URL=postgresql://postgres:old@elsewhere:5432/postgres" };
	assert.equal((await run("postgres", "create", STAGED.id, "db")).refused, `Staged (${STAGED.id}) on instance (unnamed) already sets DATABASE_URL to another value: give --env <NAME> for another name; ${CHANGED}`);
	for (const app of [DETACHED, SWARM]) {
		const said = `${app.name} (${app.id}) on instance (unnamed) is not on dokploy-network, so it cannot reach a database by its internal name: attach it to dokploy-network in Dokploy's panel; ${CHANGED}`;
		assert.equal((await run("postgres", "create", app.id, "db")).refused, said);
	}
	assert.deepEqual(posts(main.seen), []);
	assert.equal((await run("postgres", "create", TAKEN.id, "db", "--env", "MAIN_DB")).code, 0, "another name is free");
	assert.equal((await run("postgres", "create", SWARMED.id, "db2")).code, 0, "its own networks hold dokploy-network");
});

test("postgres create writes the env before the deploy, so a deploy that gives no answer in time leaves the app connected and names postgres status", async (t) => {
	const { main, run } = await load(t, 0.3);
	main.scripted.set("postgres.deploy", "hang");
	const done = await run("postgres", "create", WEB.id, "db");
	assert.equal(done.refused, `instance (unnamed): no answer in 0.3 s from ${main.url} for the deploy of Postgres pgNew2; to see whether it runs: arthur dokploy postgres status pgNew2 --project shop`);
	assert.match(done.out, /^created Postgres db \(pgNew2\) beside Web .*\nWeb \(kXx3web07\) on instance \(unnamed\): DATABASE_URL added;/);
	assert.deepEqual(posts(main.seen).map(([procedure]) => procedure), ["postgres.create", "application.saveEnvironment", "postgres.deploy"]);
	assert.match(String(main.live.find((app) => app.id === WEB.id)?.env), /\nDATABASE_URL=postgresql:\/\/postgres:[0-9a-f]{64}@/);
});

test("postgres create never shows the password or the URL in Dokploy's error text", async (t) => {
	const { main, run } = await load(t);
	main.scripted.set("postgres.create", (sent) => trpcError(400, "BAD_REQUEST", `Failed query: insert into "postgres" params: db,postgres,${String(sent?.fields.databasePassword)},postgres:18`, "postgres.create"));
	const created = await run("postgres", "create", WEB.id, "db");
	assert.equal(created.refused, `instance (unnamed): 400 for a Postgres beside app ${WEB.id}: Failed query: insert into "postgres" params: db,postgres,[hidden],postgres:18`);
	main.scripted.delete("postgres.create");
	// A database error quotes the query's parameters: here the whole env sent.
	main.scripted.set("application.saveEnvironment", (sent: Sent | undefined) => trpcError(500, "INTERNAL_SERVER_ERROR", `failed: ${String(sent?.fields.env)}`, "application.saveEnvironment"));
	const saved = await run("postgres", "create", WEB.id, "db");
	assert.equal(saved.refused, `instance (unnamed): 500 for the env of app ${WEB.id}: failed: [hidden]`);
	const password = sentPassword(main.seen.toReversed());
	assert.deepEqual(leaks(String(saved.refused) + saved.out, password), []);
	main.scripted.delete("application.saveEnvironment");
	main.scripted.set("postgres.deploy", () => trpcError(500, "INTERNAL_SERVER_ERROR", `Error on deploy postgres: POSTGRES_PASSWORD=${password}`, "postgres.deploy"));
	// The database the last run made is there now, idle: this run finds it, writes the env and deploys it.
	const deployed = await run("postgres", "create", WEB.id, "db");
	assert.equal(deployed.refused, `instance (unnamed): 500 for the deploy of Postgres pgNew2: Error on deploy postgres: POSTGRES_PASSWORD=[hidden]; to see whether it runs: arthur dokploy postgres status pgNew2 --project shop`);
});

test("postgres status prints the database, its volume and each backup, never its password; an unknown id is Dokploy's 404", async (t) => {
	const { run } = await load(t);
	const status = await run("postgres", "status", KEPT.id);
	const lines = ["Postgres db (pgKept02) on instance (unnamed): done", "image postgres:18, internal host shop-db-x1y2z3:5432, database postgres, user postgres", "volume shop-db-x1y2z3-data at /var/lib/postgresql/18/docker"];
	const backups = ["backup bk1: 0 3 * * * to s3-main, keeps the latest 7, enabled", "backup bk2: 0 * * * * to s3-cold, keeps all, disabled"];
	assert.deepEqual(status, { code: 0, out: [...lines, ...backups].join("\n"), err: "" });
	assert.deepEqual(leaks(status.out), []);
	assert.equal((await run("postgres", "status", "pgGone")).refused, "instance (unnamed): 404: Postgres pgGone not found");
});

test("postgres without create <app> <name> or status <postgres>, or with a flag status does not take, prints the usage line and exits 2", async (t) => {
	const { main, run } = await load(t);
	const wrong = [["postgres"], ["postgres", "create", WEB.id], ["postgres", "status"], ["postgres", "status", KEPT.id, "--version", "16"], ["postgres", "status", KEPT.id, "--env", "A"]];
	const more = [["postgres", "drop", KEPT.id], ["postgres", "create", WEB.id, "db", "extra"], ["postgres", "create", WEB.id, "db", "--env"], ["postgres", "create", WEB.id, "db", "--repo", "a/b"], ["status", "--version", "16"]];
	for (const args of [...wrong, ...more]) {
		const said = await run(...args);
		assert.equal(said.code, 2, args.join(" "));
		assert.match(said.err, /^usage: arthur dokploy .*\|postgres create <app> <name> \[--version <n>\] \[--env <NAME>\]\|postgres status <postgres>, /);
	}
	assert.deepEqual(main.seen, []);
});
