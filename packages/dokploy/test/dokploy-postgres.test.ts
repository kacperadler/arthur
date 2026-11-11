import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { dokploy } from "../src/dokploy.ts";
import { type FakeApp, type FakePostgres, fakeDokploy, SECRETS, type Seen, type Sent, TOKEN, trpcError } from "./fake-dokploy.ts";

// `arthur dokploy postgres create|status|backup` (AR0681, AR0682) on the fake host, against a fake Dokploy answering as
// v0.30.10. docs/commands/dokploy.md.

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
	const main = await fakeDokploy(t, { apps: [WEB, REMOTE, TAKEN, STAGED, DETACHED, SWARM, SWARMED], databases: [KEPT, IDLE], destinations: ["s3-main", "s3-cold"] });
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
// What was printed of the values that must never be: the fake's secrets, its Postgres's own password, and `more`.
const leaks = (printed: string, ...more: string[]) => [...SECRETS, "pgS3cr3tKeptPassw0rd", ...more].filter((secret) => printed.includes(secret));

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
	// A name may start with a lowercase letter, as env set takes it; a version may hold a 0.
	main.seen.length = 0;
	assert.equal((await run("postgres", "create", WEB.id, "fourth", "--version", "10", "--env", "shop_db")).code, 0);
	assert.equal(posts(main.seen)[0]?.[1]?.dockerImage, "postgres:10");
	assert.match(String(main.live.find((app) => app.id === WEB.id)?.env), /\nshop_db=postgresql:\/\/postgres:[0-9a-f]{64}@/);
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

test("postgres create refuses an app, a database or a database record Dokploy answers without what it needs, before any write", async (t) => {
	const { main, run } = await load(t);
	const create = async (app = WEB.id) => (await run("postgres", "create", app, "db")).refused;
	for (const body of [{ applicationId: WEB.id, name: "Web" }, { applicationId: WEB.id, name: "Web", environmentId: "env 1" }]) {
		main.scripted.set("application.one", { status: 200, body });
		assert.equal(await create(), `instance (unnamed): app ${WEB.id} has no Dokploy environment id; ${CHANGED}`);
	}
	main.scripted.delete("application.one");
	for (const postgres of [[{ name: "db" }], [{ name: "db", postgresId: "pg 1" }]]) {
		main.scripted.set("environment.one", { status: 200, body: { postgres } });
		assert.equal(await create(), `instance (unnamed): Postgres db has no Dokploy id; ${CHANGED}`);
	}
	main.scripted.delete("environment.one");
	const record = { postgresId: KEPT.id, name: "db", appName: KEPT.appName, databaseUser: "postgres", databasePassword: "pgS3cr3tKeptPassw0rd", databaseName: "postgres" };
	for (const lacking of ["databaseUser", "databasePassword", "appName", "databaseName"]) {
		main.scripted.set("postgres.one", { status: 200, body: { ...record, [lacking]: lacking === "appName" ? "" : undefined } });
		assert.equal(await create(STAGED.id), `instance (unnamed): Postgres ${KEPT.id}: Dokploy's answer lacks its user, password, host or database`);
	}
	assert.deepEqual(posts(main.seen), []);
	main.scripted.delete("postgres.one");
	// An environment Dokploy does not find: at its read, or, when that read answers, at the create.
	main.scripted.set("application.one", { status: 200, body: { applicationId: WEB.id, name: "Web", environmentId: "env-gone" } });
	assert.equal(await create(), `instance (unnamed): 404: the environment of app ${WEB.id} not found`);
	main.scripted.set("environment.one", { status: 200, body: { postgres: [] } });
	assert.equal(await create(), `instance (unnamed): 404: a Postgres beside app ${WEB.id} not found`);
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
	// A database error quotes the query's parameters: here the whole env sent, the build args, and the password alone.
	const quoted = (sent: Sent | undefined) => `${String(sent?.fields.env)} | ${String(sent?.fields.buildArgs)} | ${/:([0-9a-f]{64})@/.exec(String(sent?.fields.env))?.[1]}`;
	main.scripted.set("application.saveEnvironment", (sent: Sent | undefined) => trpcError(500, "INTERNAL_SERVER_ERROR", `failed: ${quoted(sent)}`, "application.saveEnvironment"));
	const saved = await run("postgres", "create", WEB.id, "db");
	assert.equal(saved.refused, `instance (unnamed): 500 for the env of app ${WEB.id}: failed: [hidden] | [hidden] | [hidden]`);
	const password = sentPassword(main.seen.toReversed());
	assert.deepEqual(leaks(String(saved.refused) + saved.out, password), []);
	main.scripted.delete("application.saveEnvironment");
	main.scripted.set("postgres.deploy", () => trpcError(500, "INTERNAL_SERVER_ERROR", `Error on deploy postgres: POSTGRES_PASSWORD=${password}`, "postgres.deploy"));
	// The database the last run made is there now, idle: this run finds it, writes the env and deploys it.
	const deployed = await run("postgres", "create", WEB.id, "db");
	assert.equal(deployed.refused, `instance (unnamed): 500 for the deploy of Postgres pgNew2: Error on deploy postgres: POSTGRES_PASSWORD=[hidden]; to see whether it runs: arthur dokploy postgres status pgNew2 --project shop`);
});

test("postgres status prints the database, its volume and each backup, never its password; an unknown id is Dokploy's 404", async (t) => {
	const { main, run } = await load(t);
	const status = await run("postgres", "status", KEPT.id);
	const lines = ["Postgres db (pgKept02) on instance (unnamed): done", "image postgres:18, internal host shop-db-x1y2z3:5432, database postgres, user postgres", "volume shop-db-x1y2z3-data at /var/lib/postgresql/18/docker"];
	const backups = ["backup bk1: 0 3 * * * to s3-main, keeps the latest 7, enabled", "backup bk2: 0 * * * * to s3-cold, keeps all, disabled"];
	assert.deepEqual(status, { code: 0, out: [...lines, ...backups].join("\n"), err: "" });
	assert.deepEqual(leaks(status.out), []);
	assert.equal((await run("postgres", "status", "pgGone")).refused, "instance (unnamed): 404: Postgres pgGone not found");
	// A bind mount names its host path; a database without any mount says so.
	const bind = { type: "bind", hostPath: "/srv/pg", volumeName: null, filePath: null, mountPath: "/var/lib/postgresql/data" };
	main.scripted.set("postgres.one", { status: 200, body: { name: "db", applicationStatus: "done", mounts: [bind], backups: [] } });
	assert.match((await run("postgres", "status", KEPT.id)).out, /\nbind \/srv\/pg at \/var\/lib\/postgresql\/data\nno backups$/);
	main.scripted.set("postgres.one", { status: 200, body: { name: "db", applicationStatus: "done", mounts: [], backups: [] } });
	assert.match((await run("postgres", "status", KEPT.id)).out, /\nno volume\nno backups$/);
});

test("postgres without create <app> <name>, status <postgres> or backup <postgres> with its two flags, or with a flag its call does not take, prints the usage line and exits 2", async (t) => {
	const { main, run } = await load(t);
	const wrong = [["postgres"], ["postgres", "create", WEB.id], ["postgres", "status"], ["postgres", "status", KEPT.id, "--version", "16"], ["postgres", "status", KEPT.id, "--env", "A"]];
	const more = [["postgres", "drop", KEPT.id], ["postgres", "create", WEB.id, "db", "extra"], ["postgres", "create", WEB.id, "db", "--env"], ["postgres", "create", WEB.id, "db", "--repo", "a/b"], ["status", "--version", "16"]];
	const [to, at] = [["--destination", "s3-main"], ["--schedule", "0 3 * * *"]];
	const backup = [["postgres", "backup", KEPT.id], ["postgres", "backup", KEPT.id, ...to], ["postgres", "backup", KEPT.id, ...at], ["postgres", "backup", ...to, ...at], ["postgres", "backup", KEPT.id, "extra", ...to, ...at]];
	const flags = [["postgres", "backup", KEPT.id, ...to, ...at, "--env", "A"], ["postgres", "backup", KEPT.id, ...to, ...at, "--keep", "-1"], ["postgres", "backup", KEPT.id, ...to, ...to, ...at], ["postgres", "backup", KEPT.id, "--destination", "", ...at]];
	const others = [["postgres", "create", WEB.id, "db", ...to], ["postgres", "create", WEB.id, "db", "--keep", "7"], ["postgres", "status", KEPT.id, "--keep", "7"], ["postgres", "status", KEPT.id, ...at], ["create", "x", "--dokploy-project", "Shop", ...at]];
	for (const args of [...wrong, ...more, ...backup, ...flags, ...others]) {
		const said = await run(...args);
		assert.equal(said.code, 2, args.join(" "));
		const usage = /^usage: arthur dokploy .*\|postgres create <app> <name> \[--version <n>\] \[--env <NAME>\]\|postgres status <postgres>\|postgres backup <postgres> --destination <name> --schedule <cron> \[--keep <n>\], /;
		assert.match(said.err, usage);
	}
	assert.deepEqual(main.seen, []);
});

test("postgres backup schedules the database's backups to the destination of that name, enabled, and prints the one Dokploy lists; run again, it sends nothing", async (t) => {
	const { main, run } = await load(t);
	const done = await run("postgres", "backup", IDLE.id, "--destination", "s3-main", "--schedule", "0 3 * * *", "--keep", "7");
	const added = "Postgres cache (pgIdle03) on instance (unnamed): added backup bk3: 0 3 * * * to s3-main, keeps the latest 7, enabled; to see it: arthur dokploy postgres status pgIdle03 --project shop";
	assert.deepEqual(done, { code: 0, out: added, err: "" });
	assert.deepEqual(calls(main.seen), ["GET postgres.one", "GET destination.all", "POST backup.create", "GET postgres.one"]);
	assert.deepEqual([main.seen[0]?.query, main.seen[3]?.query], [{ postgresId: IDLE.id }, { postgresId: IDLE.id }]);
	const body = { postgresId: IDLE.id, destinationId: "dst-s3-main", schedule: "0 3 * * *", keepLatestCount: 7, enabled: true, prefix: "/", database: "shopdb", databaseType: "postgres", backupType: "database" };
	assert.deepEqual(posts(main.seen), [["backup.create", body]]);
	assert.deepEqual(leaks(done.out + done.err), []);
	// The leak check holds only if SECRETS has the S3 keys the destinations' answer carries.
	const answered = (await (await fetch(`${main.url}/api/destination.all`, { headers: { "x-api-key": TOKEN } })).json()) as { accessKey: string; secretAccessKey: string }[];
	assert.deepEqual(answered.flatMap((each) => [each.accessKey, each.secretAccessKey]).filter((key) => !SECRETS.includes(key)), []);
	main.seen.length = 0;
	const again = await run("postgres", "backup", IDLE.id, "--destination", "s3-main", "--schedule", "0 3 * * *", "--keep", "7");
	assert.deepEqual(again, { code: 0, out: "Postgres cache (pgIdle03) on instance (unnamed): backup bk3: 0 3 * * * to s3-main, keeps the latest 7, enabled: already set; nothing was sent", err: "" });
	assert.deepEqual(calls(main.seen), ["GET postgres.one", "GET destination.all"]);
	assert.match((await run("postgres", "status", IDLE.id)).out, /\nbackup bk3: 0 3 \* \* \* to s3-main, keeps the latest 7, enabled$/);
	// Without --keep Dokploy keeps every backup; the same schedule to another destination, or another schedule, is another backup.
	main.seen.length = 0;
	const all = await run("postgres", "backup", KEPT.id, "--destination", "s3-cold", "--schedule", "0 3 * * *");
	assert.equal(all.out, "Postgres db (pgKept02) on instance (unnamed): added backup bk4: 0 3 * * * to s3-cold, keeps all, enabled; to see it: arthur dokploy postgres status pgKept02 --project shop");
	assert.deepEqual(posts(main.seen), [["backup.create", { postgresId: KEPT.id, destinationId: "dst-s3-cold", schedule: "0 3 * * *", enabled: true, prefix: "/", database: "postgres", databaseType: "postgres", backupType: "database" }]]);
	const other = await run("postgres", "backup", KEPT.id, "--destination", "s3-main", "--schedule", "*/30 1-5 * JAN,jul MON-FRI", "--keep", "9999");
	assert.match(other.out, /: added backup bk5: \*\/30 1-5 \* JAN,jul MON-FRI to s3-main, keeps the latest 9999, enabled; /);
	assert.equal((await run("postgres", "backup", KEPT.id, "--destination", "s3-main", "--schedule", "0 0 1 * 0", "--keep", "1")).code, 0);
	assert.deepEqual(main.postgres.find((db) => db.id === KEPT.id)?.backups?.map((each) => each.id), ["bk1", "bk2", "bk4", "bk5", "bk6"]);
});

test("postgres backup refuses an id, a --schedule or a --keep it would not take before any request", async (t) => {
	const { main, run } = await load(t);
	const backup = (id: string, schedule: string, keep = "7") => run("postgres", "backup", id, "--destination", "s3-main", "--schedule", schedule, "--keep", keep);
	for (const given of ["pg/1", "pg 1", "a".repeat(65)]) assert.equal((await backup(given, "0 3 * * *")).refused, `the Postgres is not a Dokploy id: 1 to 64 letters, digits, _ and -; ${NOTHING}`);
	const cron = (given: string) => `--schedule ${given} is not a cron schedule of five fields, minute, hour, day of month, month and day of week, as "0 3 * * *"; ${NOTHING}`;
	for (const given of ["0 3 * *", "0 0 3 * * *", "0  3 * * *", " 0 3 * * *", "0 3 * * * ", "0 3 * * *;", "0 3 * * $(x)", "@daily", "0\t3 * * *"]) assert.equal((await backup(IDLE.id, given)).refused, cron(given.replace("\t", "")));
	const keep = (given: string) => `--keep ${given} is not how many backups to keep: 1 to 9999; ${NOTHING}`;
	for (const given of ["0", "10000", "07", "1.5", "x", "1e3", " 7"]) assert.equal((await backup(IDLE.id, "0 3 * * *", given)).refused, keep(given));
	assert.deepEqual(main.seen, []);
	const elsewhere = await run("postgres", "backup", IDLE.id, "--destination", "s3-main", "--schedule", "0 3 * * *", "--instance", "acme");
	assert.equal(elsewhere.refused, `--instance acme is not an instance of dokploy; its instances: (unnamed); ${NOTHING}`);
});

test("postgres backup refuses after its reads and before any write: an unknown or doubled destination, one without an id, and a backup of that destination and schedule set another way", async (t) => {
	const { main, run } = await load(t);
	const backup = (id: string, destination: string, schedule: string, ...more: string[]) => run("postgres", "backup", id, "--destination", destination, "--schedule", schedule, ...more);
	const unknown = await backup(IDLE.id, "s3-gone", "0 3 * * *");
	assert.equal(unknown.refused, `instance (unnamed) has no destination s3-gone; its destinations: s3-main, s3-cold (Dokploy's panel, Settings, Destinations); ${CHANGED}`);
	main.scripted.set("destination.all", { status: 200, body: [] });
	assert.equal((await backup(IDLE.id, "s3-main", "0 3 * * *")).refused, `instance (unnamed) has no destination s3-main; its destinations: none (Dokploy's panel, Settings, Destinations); ${CHANGED}`);
	const record = { destinationId: "dst-a", name: "s3-main", accessKey: "AKIAS3CR3TACCESSKEY7", secretAccessKey: "s3cr3tSecretAccessKey/wJalrXUtnFEMI" };
	main.scripted.set("destination.all", { status: 200, body: [record, { ...record, destinationId: "dst-b" }] });
	assert.equal((await backup(IDLE.id, "s3-main", "0 3 * * *")).refused, `instance (unnamed) has 2 destinations named s3-main: rename one in Dokploy's panel; ${CHANGED}`);
	for (const destinationId of [undefined, ""]) {
		main.scripted.set("destination.all", { status: 200, body: [{ ...record, destinationId }] });
		assert.equal((await backup(IDLE.id, "s3-main", "0 3 * * *")).refused, `instance (unnamed): destination s3-main has no Dokploy id; ${CHANGED}`);
	}
	main.scripted.delete("destination.all");
	const set = (backup: string) => `Postgres db (pgKept02) on instance (unnamed) already has ${backup}: change it in Dokploy's panel; ${CHANGED}`;
	assert.equal((await backup(KEPT.id, "s3-main", "0 3 * * *", "--keep", "8")).refused, set("backup bk1: 0 3 * * * to s3-main, keeps the latest 7, enabled"));
	assert.equal((await backup(KEPT.id, "s3-main", "0 3 * * *")).refused, set("backup bk1: 0 3 * * * to s3-main, keeps the latest 7, enabled"));
	assert.equal((await backup(KEPT.id, "s3-cold", "0 * * * *")).refused, set("backup bk2: 0 * * * * to s3-cold, keeps all, disabled"));
	assert.equal((await backup(KEPT.id, "s3-cold", "0 * * * *", "--keep", "7")).refused, set("backup bk2: 0 * * * * to s3-cold, keeps all, disabled"));
	for (const databaseName of [undefined, ""]) {
		main.scripted.set("postgres.one", { status: 200, body: { postgresId: KEPT.id, name: "db", databaseName, backups: [] } });
		assert.equal((await backup(KEPT.id, "s3-main", "0 3 * * *")).refused, `instance (unnamed): Postgres ${KEPT.id}: Dokploy's answer lacks its database; ${CHANGED}`);
	}
	main.scripted.delete("postgres.one");
	assert.equal((await backup("pgGone", "s3-main", "0 3 * * *")).refused, "instance (unnamed): 404: Postgres pgGone not found");
	assert.deepEqual(posts(main.seen), []);
	assert.deepEqual(leaks(String(unknown.refused) + unknown.out + unknown.err), []);
});

test("postgres backup names Dokploy's refusal of the backup, and a backup Dokploy took but does not list", async (t) => {
	const { main, run } = await load(t);
	const backup = () => run("postgres", "backup", IDLE.id, "--destination", "s3-main", "--schedule", "0 3 * * *", "--keep", "7");
	main.scripted.set("backup.create", trpcError(400, "BAD_REQUEST", "Server is inactive", "backup.create"));
	assert.equal((await backup()).refused, `instance (unnamed): 400 for a backup of Postgres ${IDLE.id}: Server is inactive`);
	main.scripted.set("backup.create", { empty: 200 });
	const lost = await backup();
	assert.equal(lost.refused, `instance (unnamed): Dokploy took the backup of Postgres ${IDLE.id} but does not list it; to see it: arthur dokploy postgres status ${IDLE.id} --project shop`);
	assert.deepEqual(calls(main.seen).slice(-2), ["POST backup.create", "GET postgres.one"]);
});
