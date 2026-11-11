import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { call, field, ID, type Instance, NOTHING, text } from "./dokploy-api.ts";
import { setVariable } from "./dokploy-env.ts";

// `arthur dokploy postgres create|status|backup` (AR0681, AR0682): a Postgres beside an app, in its environment and on its
// server, its internal URL written into the app's env and never printed, then deployed; what Dokploy holds of it, never its
// password; and its backups to an S3 destination: docs/commands/dokploy.md. Each part already in place is left as it is, so
// a call may be run again.

export type Database = { readonly version?: string; readonly env?: string };
export type Backup = { readonly destination: string; readonly schedule: string; readonly keep?: string };

// A list in Dokploy's answer, or none.
const listed = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// The internal URL as Dokploy's panel builds it (show-internal-postgres-credentials.tsx), from `postgres.create`'s or
// `postgres.one`'s answer; the user and password percent-encoded, which leaves the generated hex password as it is.
function urlOf(record: unknown, what: string): { readonly url: string; readonly password: string } {
	const [user, password, host, database] = ["databaseUser", "databasePassword", "appName", "databaseName"].map((key) => field(record, key));
	if (![user, password, host, database].every((each) => typeof each === "string" && each !== "")) throw new Error(`${what}: Dokploy's answer lacks its user, password, host or database`);
	const url = `postgresql://${encodeURIComponent(String(user))}:${encodeURIComponent(String(password))}@${String(host)}:5432/${String(database)}`;
	return { url, password: String(password) };
}

// `create <app> <name> [--version <n>] [--env <NAME>]`: the database named `<name>` in the app's environment, unless it is
// there; `<NAME>` (default DATABASE_URL) set to its URL in the app's env; a deploy of a database new or still idle.
export async function createPostgres(instance: Instance, id: string, name: string, { version = "18", env = "DATABASE_URL" }: Database, next: (then: string, target: string) => string): Promise<number> {
	if (!/^[1-9][0-9]?$/.test(version)) throw new Error(`--version ${text(version)} is not a Postgres major version: 1 to 99; ${NOTHING}`);
	// The rule env set holds a variable's name to.
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(env)) throw new Error(`--env ${text(env)} is not a variable name: a letter or _, then letters, digits and _; ${NOTHING}`);
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
	if (had !== undefined && (record === undefined || had !== urlOf(record, `instance ${instance.label}: Postgres ${text(foundId)}`).url)) throw new Error(`${heading} already sets ${env} to another value: give --env <NAME> for another name; ${nothing}`);
	const generated = randomBytes(32).toString("hex");
	const server = field(item, "serverId");
	const body = { name, environmentId, ...(typeof server === "string" ? { serverId: server } : {}), dockerImage: `postgres:${version}`, databaseName: "postgres", databaseUser: "postgres", databasePassword: generated };
	const made = record ?? (await call(instance, "postgres.create", {}, `a Postgres beside app ${id}`, body, [generated]));
	const postgresId = text(field(made, "postgresId"));
	const where = `Postgres ${text(name)} (${postgresId}) beside ${heading}, internal host ${text(field(made, "appName"))}:5432`;
	console.log(record === undefined ? `created ${where}, image postgres:${version}` : `${where}: already there`);
	const { url, password } = urlOf(made, `instance ${instance.label}: Postgres ${postgresId}`);
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
	const backups = listed(field(item, "backups")).map(backupLine);
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

// A backup as `postgres.one` lists it: `backup <id>: <schedule> to <destination>, keeps the latest <n>, enabled`.
function backupLine(each: unknown): string {
	const keep = field(each, "keepLatestCount");
	const kept = typeof keep === "number" ? `keeps the latest ${keep}` : "keeps all";
	return `backup ${text(field(each, "backupId"))}: ${text(field(each, "schedule"))} to ${text(field(field(each, "destination"), "name"))}, ${kept}, ${field(each, "enabled") === true ? "enabled" : "disabled"}`;
}

// `backup <postgres> --destination <name> --schedule <cron> [--keep <n>]`: Dokploy dumps the database to the S3 destination of
// that name on that schedule, keeping the latest <n>, else all; a backup of that destination and schedule is left as it is.
export async function backupPostgres(instance: Instance, id: string, { destination, schedule, keep }: Backup, next: (then: string, target: string) => string): Promise<number> {
	if (!ID.test(id)) throw new Error(`the Postgres is not a Dokploy id: 1 to 64 letters, digits, _ and -; ${NOTHING}`);
	// Five fields, as the panel's presets: node-schedule, which runs Dokploy's backups, reads a sixth as seconds, first.
	if (!/^[0-9A-Za-z*,/?#-]+( [0-9A-Za-z*,/?#-]+){4}$/.test(schedule)) throw new Error(`--schedule ${text(schedule)} is not a cron schedule of five fields, minute, hour, day of month, month and day of week, as "0 3 * * *"; ${NOTHING}`);
	if (keep !== undefined && !/^[1-9][0-9]{0,3}$/.test(keep)) throw new Error(`--keep ${text(keep)} is not how many backups to keep: 1 to 9999; ${NOTHING}`);
	const item = await call(instance, "postgres.one", { postgresId: id }, `Postgres ${id}`);
	const heading = `Postgres ${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	const nothing = "nothing was changed";
	const database = field(item, "databaseName");
	if (typeof database !== "string" || database === "") throw new Error(`instance ${instance.label}: Postgres ${id}: Dokploy's answer lacks its database; ${nothing}`);
	// Only a destination's name and id are read: the answer holds its S3 keys too.
	const all = listed(await call(instance, "destination.all", {}, "the destinations"));
	const named = all.filter((each) => field(each, "name") === destination);
	const names = all.map((each) => text(field(each, "name"))).join(", ") || "none";
	if (named.length === 0) throw new Error(`instance ${instance.label} has no destination ${text(destination)}; its destinations: ${names} (Dokploy's panel, Settings, Destinations); ${nothing}`);
	if (named.length > 1) throw new Error(`instance ${instance.label} has ${named.length} destinations named ${text(destination)}: rename one in Dokploy's panel; ${nothing}`);
	const destinationId = field(named[0], "destinationId");
	if (typeof destinationId !== "string" || destinationId === "") throw new Error(`instance ${instance.label}: destination ${text(destination)} has no Dokploy id; ${nothing}`);
	const kept = keep === undefined ? null : Number(keep);
	const same = (record: unknown) => listed(field(record, "backups")).filter((each) => field(each, "destinationId") === destinationId && field(each, "schedule") === schedule);
	const [had] = same(item);
	if (had !== undefined) {
		if (field(had, "keepLatestCount") !== kept || field(had, "enabled") !== true) throw new Error(`${heading} already has ${backupLine(had)}: change it in Dokploy's panel; ${nothing}`);
		console.log(`${heading}: ${backupLine(had)}: already set; nothing was sent`);
		return 0;
	}
	// Dokploy schedules only a backup whose `enabled` is true, a column without a default; `prefix` "/" as its panel sends it.
	const body = { postgresId: id, destinationId, schedule, ...(kept === null ? {} : { keepLatestCount: kept }), enabled: true, prefix: "/", database, databaseType: "postgres", backupType: "database" };
	await call(instance, "backup.create", {}, `a backup of Postgres ${id}`, body);
	const status = next("postgres status", id);
	// `backup.create` answers nothing: the backup is the one Dokploy lists now.
	const [made] = same(await call(instance, "postgres.one", { postgresId: id }, `Postgres ${id}`));
	if (made === undefined) throw new Error(`instance ${instance.label}: Dokploy took the backup of Postgres ${id} but does not list it; to see it: ${status}`);
	console.log(`${heading}: added ${backupLine(made)}; to see it: ${status}`);
	return 0;
}
