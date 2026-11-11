import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { call, field, ID, type Instance, NOTHING, text } from "./dokploy-api.ts";
import { setVariable, VARIABLE } from "./dokploy-env.ts";

// `arthur dokploy postgres create|status` (AR0681): a Postgres beside an app, in its environment and on its server, its
// internal URL written into the app's env and never printed, then deployed; and what Dokploy holds of it, never its
// password: docs/commands/dokploy.md. Each part already in place is left as it is, so a call may be run again.

export type Database = { readonly version?: string; readonly env?: string };

// A list in Dokploy's answer, or none.
const listed = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// The internal URL as Dokploy's panel builds it (show-internal-postgres-credentials.tsx), from `postgres.create`'s or
// `postgres.one`'s answer; the user and password percent-encoded, which leaves the generated hex password as it is.
function urlOf(record: unknown, what: string): { readonly url: string; readonly password: string } {
	const [user, password, host, database] = ["databaseUser", "databasePassword", "appName", "databaseName"].map((key) => field(record, key));
	if (![user, password, host, database].every((each) => typeof each === "string" && each !== "")) throw new Error(`the answer for ${what} lacks its user, password, host or database`);
	const url = `postgresql://${encodeURIComponent(String(user))}:${encodeURIComponent(String(password))}@${String(host)}:5432/${String(database)}`;
	return { url, password: String(password) };
}

// `create <app> <name> [--version <n>] [--env <NAME>]`: the database named `<name>` in the app's environment, unless it is
// there; `<NAME>` (default DATABASE_URL) set to its URL in the app's env; a deploy of a database new or still idle.
export async function createPostgres(instance: Instance, id: string, name: string, { version = "18", env = "DATABASE_URL" }: Database, next: (then: string, target: string) => string): Promise<number> {
	if (!/^[1-9][0-9]?$/.test(version)) throw new Error(`--version ${text(version)} is not a Postgres major version: 1 to 99; ${NOTHING}`);
	if (!VARIABLE.test(env)) throw new Error(`--env ${text(env)} is not a variable name: a letter or _, then letters, digits and _; ${NOTHING}`);
	const item = await call(instance, "application.one", { applicationId: id }, `app ${id}`);
	const heading = `${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	const nothing = "nothing was changed";
	// Dokploy puts a service on dokploy-network unless it is detached or its own networkSwarm leaves it out (resolveServiceNetworks).
	const swarm = field(item, "networkSwarm");
	const cut = Array.isArray(swarm) ? !swarm.some((each) => field(each, "Target") === "dokploy-network") : field(item, "detachDokployNetwork") === true;
	if (cut) throw new Error(`${heading} is not on dokploy-network, so it cannot reach a database by its internal name: attach it to dokploy-network in Dokploy's panel; ${nothing}`);
	const environmentId = field(item, "environmentId");
	if (typeof environmentId !== "string" || !ID.test(environmentId)) throw new Error(`instance ${instance.label}: app ${id} has no Dokploy environment id; ${nothing}`);
	const place = await call(instance, "environment.one", { environmentId }, `the environment of app ${id}`);
	const found = listed(field(place, "postgres")).find((each) => field(each, "name") === name);
	const foundId = field(found, "postgresId");
	if (found !== undefined && (typeof foundId !== "string" || !ID.test(foundId))) throw new Error(`instance ${instance.label}: Postgres ${text(name)} has no Dokploy id; ${nothing}`);
	const record = found === undefined ? undefined : await call(instance, "postgres.one", { postgresId: String(foundId) }, `Postgres ${text(foundId)}`);
	const had = parseEnv(typeof field(item, "env") === "string" ? String(field(item, "env")) : "")[env];
	// A database not made yet has no URL: any value the app has for the name is another one, and the owner's.
	if (had !== undefined && (record === undefined || had !== urlOf(record, `Postgres ${text(foundId)}`).url)) throw new Error(`${heading} already sets ${env} to another value: give --env <NAME> for another name; ${nothing}`);
	const generated = randomBytes(32).toString("hex");
	const server = field(item, "serverId");
	const body = { name, environmentId, ...(typeof server === "string" ? { serverId: server } : {}), dockerImage: `postgres:${version}`, databaseName: "postgres", databaseUser: "postgres", databasePassword: generated };
	const made = record ?? (await call(instance, "postgres.create", {}, `a Postgres beside app ${id}`, body, [generated]));
	const postgresId = text(field(made, "postgresId"));
	const where = `Postgres ${text(name)} (${postgresId}) beside ${heading}, internal host ${text(field(made, "appName"))}:5432`;
	console.log(record === undefined ? `created ${where}, image postgres:${version}` : `${where}: already there`);
	const { url, password } = urlOf(made, `Postgres ${postgresId}`);
	// The env first: a deploy that outlasts the timeout still leaves the app connected.
	await setVariable(instance, item, id, env, url, [password], (then) => next(then, id));
	const status = next("postgres status", postgresId);
	const state = field(found, "applicationStatus");
	if (found !== undefined && state !== "idle") {
		console.log(`Postgres ${text(name)} (${postgresId}) is ${text(state)}: not deployed again; to see it: ${status}`);
		return 0;
	}
	try {
		await call(instance, "postgres.deploy", {}, `the deploy of Postgres ${postgresId}`, { postgresId }, [url, password]);
	} catch (error) {
		throw new Error(`${(error as Error).message}; to see whether it runs: ${status}`);
	}
	console.log(`Postgres ${text(name)} (${postgresId}): deployed; to see it: ${status}`);
	return 0;
}

// `status <postgres>`: its name, status, image, internal host, database and user, volumes and backups; never its password.
export async function postgresStatus(instance: Instance, id: string): Promise<number> {
	if (!ID.test(id)) throw new Error(`the Postgres is not a Dokploy id: 1 to 64 letters, digits, _ and -; ${NOTHING}`);
	const item = await call(instance, "postgres.one", { postgresId: id }, `Postgres ${id}`);
	const mounts = listed(field(item, "mounts")).map((each) => `${text(field(each, "type"))} ${text(field(each, "volumeName") ?? field(each, "hostPath") ?? field(each, "filePath"))} at ${text(field(each, "mountPath"))}`);
	const backups = listed(field(item, "backups")).map((each) => {
		const keep = field(each, "keepLatestCount");
		const kept = typeof keep === "number" ? `keeps the latest ${keep}` : "keeps all";
		return `backup ${text(field(each, "backupId"))}: ${text(field(each, "schedule"))} to ${text(field(field(each, "destination"), "name"))}, ${kept}, ${field(each, "enabled") === true ? "enabled" : "disabled"}`;
	});
	console.log(
		[
			`Postgres ${text(field(item, "name"))} (${id}) on instance ${instance.label}: ${text(field(item, "applicationStatus"))}`,
			`image ${text(field(item, "dockerImage"))}, internal host ${text(field(item, "appName"))}:5432, database ${text(field(item, "databaseName"))}, user ${text(field(item, "databaseUser"))}`,
			...(mounts.length === 0 ? ["no volume"] : mounts),
			...(backups.length === 0 ? ["no backups"] : backups),
		].join("\n"),
	);
	return 0;
}
