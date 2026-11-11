import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import { crc32, inflateRawSync } from "node:zlib";

// The fake Dokploy the dokploy tests share: a `node:http` server on a port the OS picks, answering as Dokploy v0.30.10
// does, every field of each answer that test/dokploy-shapes.json records, or `project.all` as the documentation's example.

export const TOKEN = "kdQ7uZ3sA0pT1mN2vB4xC6yD8eF9gH0iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aB0cD1e";

// Values Dokploy answers that `arthur dokploy` must never print: an app's env, build args and secrets, its git refresh token
// and registry password, a project's and an environment's env, and the documentation's database passwords.
export const SECRETS = ["DATABASE_URL=postgres://shop:s3cr3t-db@db/shop", "NPM_TOKEN=npm_s3cr3tBuildArg", "SENTRY_AUTH=s3cr3tBuildSecret", "PREVIEW_KEY=s3cr3tPreview", "ghr_s3cr3tRefresh", "s3cr3t-registry", "PROJECT_KEY=s3cr3tProject", "ENVIRONMENT_KEY=s3cr3tEnvironment", "h13BzO6y3KYSHaQg", "mM1b7JeoPA7jArxj", "Yvb8gqClfomjcue8"];

export type FakeDeployment = { readonly title: string; readonly status: "running" | "done" | "error" | "cancelled"; readonly createdAt: string; readonly finishedAt?: string; readonly errorMessage?: string };
// An app; the keys after `dropBuildPath` are what the setup and source writes change, each left out as Dokploy's default or the
// fake's; `githubId` one of the fake's `githubs`.
export type FakeApp = {
	readonly id: string;
	readonly name: string;
	readonly status: "idle" | "running" | "done" | "error";
	readonly project: string;
	readonly environment: string;
	readonly sourceType?: string;
	readonly domains?: readonly { readonly host: string; readonly https: boolean; readonly path?: string; readonly port?: number }[];
	readonly deployments?: readonly FakeDeployment[];
	readonly dropBuildPath?: string;
	readonly buildType?: string;
	readonly dockerfile?: string | null;
	readonly dockerContextPath?: string | null;
	readonly env?: string | null;
	readonly mounts?: readonly { readonly type: "volume" | "bind" | "file"; readonly volumeName?: string; readonly mountPath: string }[];
	readonly githubId?: string;
	readonly owner?: string;
	readonly repository?: string;
	readonly branch?: string;
	readonly buildPath?: string;
	readonly triggerType?: "push" | "tag";
	readonly autoDeploy?: boolean | null;
	readonly watchPaths?: readonly string[] | null;
	readonly enableSubmodules?: boolean;
	readonly serverId?: string;
	readonly detachDokployNetwork?: boolean;
	readonly networkSwarm?: readonly { readonly Target: string }[];
};
// A Postgres of Dokploy in an app's project and environment; left out: user and database `postgres`, image `postgres:18`, the
// password `pgS3cr3tKeptPassw0rd`, no server and no backup.
export type FakePostgres = {
	readonly id: string;
	readonly name: string;
	readonly project: string;
	readonly environment: string;
	readonly appName: string;
	readonly status: "idle" | "running" | "done" | "error";
	readonly password?: string;
	readonly user?: string;
	readonly database?: string;
	readonly image?: string;
	readonly serverId?: string;
	readonly backups?: readonly { readonly id: string; readonly schedule: string; readonly destination: string; readonly keep: number | null; readonly enabled: boolean | null }[];
};
// A GitHub app of Dokploy (Settings, Git providers): its id, its name, and the repositories its installation sees, each with
// its branches.
export type FakeGithub = { readonly id: string; readonly name: string; readonly repositories: readonly { readonly owner: string; readonly name: string; readonly branches: readonly string[] }[] };
// What a procedure answers in place of its own: a status and body, one made from the request's body, a redirect to `location`,
// no answer at all, text that is not JSON, or no body at all under the status `empty`.
export type Scripted = { readonly status: number; readonly body: unknown } | ((sent: Sent | undefined) => { readonly status: number; readonly body: unknown }) | { readonly redirect: string } | { readonly empty: number } | "hang" | "not-json";
// A request's body as Dokploy's REST handler reads it: JSON only under exactly `application/json` (co-body), a form under
// `multipart/form-data` (Request.formData), else nothing; `fields` its JSON keys or form fields, `files` a form's files.
export type Sent = { readonly fields: Readonly<Record<string, unknown>>; readonly files: Readonly<Record<string, { readonly name: string; readonly type: string; readonly bytes: Buffer }>> };
// A request: `type` the Content-Type it came with, and `sent` a POST's body.
export type Seen = { readonly method: string; readonly path: string; readonly query: Readonly<Record<string, string>>; readonly key: string | undefined; readonly type?: string; readonly sent?: Sent };

const DAY = "2026-10-30";
const environmentId = (project: string, environment: string) => `env-${project}-${environment}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
const projectId = (project: string) => `prj-${project}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

const projectRecord = (name: string) => ({ projectId: projectId(name), name, description: null, createdAt: `${DAY}T08:00:00.000Z`, organizationId: "org-1", env: "PROJECT_KEY=s3cr3tProject" });
const environmentRecord = (project: string, name: string) => ({ environmentId: environmentId(project, name), name, description: null, createdAt: `${DAY}T08:00:00.000Z`, env: "ENVIRONMENT_KEY=s3cr3tEnvironment", projectId: projectId(project), isDefault: name === "production" });

// A deployment as `deployment.all` and `application.one` answer it: every column of Dokploy's deployment table.
const deploymentRecord = (app: FakeApp, deployment: FakeDeployment, index: number) => ({
	...{ deploymentId: `dep-${app.id}-${index}`, title: deployment.title, description: "", status: deployment.status, logPath: `/etc/dokploy/logs/${app.id}/${index}.log`, pid: null },
	...{ applicationId: app.id, composeId: null, serverId: null, isPreviewDeployment: false, previewDeploymentId: null, createdAt: deployment.createdAt, startedAt: deployment.createdAt },
	...{ finishedAt: deployment.finishedAt ?? null, errorMessage: deployment.errorMessage ?? null, scheduleId: null, backupId: null, rollbackId: null, volumeBackupId: null, buildServerId: null },
});

// A domain and a mount as `domain.create` and `mounts.create` answer them, and `application.one` lists them: every column.
const domainRecord = (app: FakeApp, domain: NonNullable<FakeApp["domains"]>[number], index: number) => ({
	...{ domainId: `dom-${app.id}-${index}`, host: domain.host, https: domain.https, port: domain.port ?? 3000, customEntrypoint: null, path: domain.path ?? "/", serviceName: null, domainType: "application" },
	...{ uniqueConfigKey: index + 1, createdAt: `${DAY}T08:00:00.000Z`, composeId: null, customCertResolver: null, applicationId: app.id, previewDeploymentId: null, certificateType: domain.https ? "letsencrypt" : "none" },
	...{ internalPath: "/", stripPath: false, middlewares: null, forwardAuthEnabled: false, enabled: true },
});
const mountRecord = (app: FakeApp, mount: NonNullable<FakeApp["mounts"]>[number], index: number) => ({
	...{ mountId: `mnt-${app.id}-${index}`, type: mount.type, hostPath: null, volumeName: mount.volumeName ?? null, filePath: null, content: null, serviceType: "application", mountPath: mount.mountPath },
	...{ applicationId: app.id, composeId: null, libsqlId: null, mariadbId: null, mongoId: null, mysqlId: null, postgresId: null, redisId: null },
});

// A Postgres as `postgres.create` answers it: every column of the postgres table, its password included.
const postgresRecord = (db: FakePostgres) => ({
	...{ postgresId: db.id, name: db.name, appName: db.appName, databaseName: db.database ?? "postgres", databaseUser: db.user ?? "postgres", databasePassword: db.password ?? "pgS3cr3tKeptPassw0rd" },
	...{ description: null, dockerImage: db.image ?? "postgres:18", command: null, args: null, env: null, memoryReservation: null, externalPort: null, memoryLimit: null, cpuReservation: null, cpuLimit: null },
	...{ applicationStatus: db.status, healthCheckSwarm: null, restartPolicySwarm: null, placementSwarm: null, updateConfigSwarm: null, rollbackConfigSwarm: null, modeSwarm: null, labelsSwarm: null },
	...{ networkSwarm: null, stopGracePeriodSwarm: null, endpointSpecSwarm: null, ulimitsSwarm: null, replicas: 1, createdAt: `${DAY}T08:00:00.000Z`, environmentId: environmentId(db.project, db.environment) },
	...{ serverId: db.serverId ?? null, networkIds: [], detachDokployNetwork: false },
});
// Where Postgres keeps its data (getMountPath at v0.30.10): from version 18 under its version's folder.
const dataPath = (image: string) => ((version) => (version >= 18 ? `/var/lib/postgresql/${version}/docker` : "/var/lib/postgresql/data"))(Number(/postgres:(\d+)/.exec(image)?.[1] ?? 0));
// `postgres.one` (findPostgresById): the record, its environment with its project, the data volume `postgres.create` mounts,
// no server, and its backups, each with its destination minus its keys and its deployments.
function postgresOne(db: FakePostgres) {
	const record = postgresRecord(db);
	const mount = { mountId: `mnt-${db.id}`, type: "volume", hostPath: null, volumeName: `${db.appName}-data`, filePath: null, content: null, serviceType: "postgres", mountPath: dataPath(record.dockerImage) };
	const owners = { applicationId: null, composeId: null, libsqlId: null, mariadbId: null, mongoId: null, mysqlId: null, postgresId: db.id, redisId: null };
	const backups = (db.backups ?? []).map((backup) => ({
		...{ backupId: backup.id, appName: `backup-${backup.id}`, schedule: backup.schedule, enabled: backup.enabled, database: record.databaseName, prefix: "/", serviceName: null },
		...{ destinationId: `dst-${backup.destination}`, keepLatestCount: backup.keep, includeEncryptionKey: true, backupType: "database", databaseType: "postgres", composeId: null, postgresId: db.id },
		...{ mariadbId: null, mysqlId: null, mongoId: null, libsqlId: null, userId: "user-1", metadata: null, deployments: [] },
		destination: {
			...{ destinationId: `dst-${backup.destination}`, name: backup.destination, provider: "AWS", bucket: "acme-backups", region: "eu-central-1", endpoint: "https://s3.eu-central-1.amazonaws.com" },
			...{ additionalFlags: [], organizationId: "org-1", createdAt: `${DAY}T08:00:00.000Z` },
		},
	}));
	const environment = { ...environmentRecord(db.project, db.environment), project: projectRecord(db.project) };
	return { ...record, environment, mounts: [{ ...mount, ...owners }], server: null, backups };
}
// `environment.one` (findEnvironmentById) as an owner reads it: the environment's columns, its services' few columns and its
// project; the services of other kinds none.
function environmentOne(place: { readonly project: string; readonly environment: string }, apps: readonly FakeApp[], databases: readonly FakePostgres[]) {
	const here = (each: { readonly project: string; readonly environment: string }) => each.project === place.project && each.environment === place.environment;
	const { createdAt: _, ...columns } = environmentRecord(place.project, place.environment);
	const applications = apps.filter(here).map((app) => ({ name: app.name, applicationId: app.id, createdAt: `${DAY}T08:00:00.000Z`, applicationStatus: app.status, description: null, serverId: app.serverId ?? null, icon: null, server: null }));
	const postgres = databases.filter(here).map((db) => ({ postgresId: db.id, name: db.name, description: null, createdAt: `${DAY}T08:00:00.000Z`, applicationStatus: db.status, serverId: db.serverId ?? null, server: null }));
	return { ...columns, applications, mariadb: [], mongo: [], mysql: [], postgres, redis: [], compose: [], libsql: [], project: projectRecord(place.project) };
}

// GitHub's own repository and branch, as docs.github.com's examples show them (github-examples.json), named as the fake's.
const GITHUB = JSON.parse(readFileSync(new URL("github-examples.json", import.meta.url), "utf8")) as { repository: { owner: object }; branch: object };
const repositoryRecord = (owner: string, name: string) => ({ ...GITHUB.repository, name, full_name: `${owner}/${name}`, owner: { ...GITHUB.repository.owner, login: owner } });
// A GitHub app as the github table holds it, its git provider beside it as `github.githubProviders` answers.
const githubRecord = (github: FakeGithub) => ({
	...{ githubId: github.id, githubAppName: `${github.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-app`, githubAppId: 1234567, githubClientId: "Iv23liAbCdEf0123", githubInstallationId: "55501234" },
	...{ githubUrl: "https://github.com", gitProviderId: `gp-${github.id}` },
});
const providerRecord = (github: FakeGithub) => ({
	...{ githubId: github.id, githubUrl: "https://github.com" },
	gitProvider: { gitProviderId: `gp-${github.id}`, name: github.name, providerType: "github", createdAt: `${DAY}T08:00:00.000Z`, organizationId: "org-1", userId: "user-1", sharedWithOrganization: false },
});
// The related records findApplicationById adds to the application's own columns, which `application.create` answers alone.
const RELATED = ["environment", "domains", "deployments", "mounts", "redirects", "security", "ports", "gitlab", "github", "bitbucket", "gitea", "server", "previewDeployments", "registry", "buildRegistry", "rollbackRegistry", "hasGitProviderAccess", "unauthorizedProvider"];

// `application.one`: every column of the application table, its environment with its project, and the related records
// findApplicationById reads: its GitHub app without the three secrets when it has one, the other git providers, server and
// registries none, as for an app without them.
function applicationRecord(app: FakeApp, githubs: readonly FakeGithub[] = []) {
	const github = githubs.find((each) => each.id === app.githubId);
	return {
		...{ applicationId: app.id, name: app.name, appName: `${app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-a1b2c3`, description: null, env: app.env === undefined ? "DATABASE_URL=postgres://shop:s3cr3t-db@db/shop" : app.env, previewEnv: "PREVIEW_KEY=s3cr3tPreview" },
		...{ watchPaths: app.watchPaths ?? null, previewBuildArgs: null, previewBuildSecrets: null, previewLabels: null, previewWildcard: null, previewPort: 3000, previewHttps: false, previewPath: "/" },
		...{ previewCertificateType: "none" },
		...{ previewCustomCertResolver: null, previewLimit: 3, isPreviewDeploymentsActive: false, previewRequireCollaboratorPermissions: true, rollbackActive: false, buildArgs: "NPM_TOKEN=npm_s3cr3tBuildArg" },
		...{ buildSecrets: "SENTRY_AUTH=s3cr3tBuildSecret", memoryReservation: null, memoryLimit: null, cpuReservation: null, cpuLimit: null, title: null, enabled: null, subtitle: null, command: null, args: null, icon: null },
		...{ refreshToken: "ghr_s3cr3tRefresh", sourceType: app.sourceType ?? "drop", cleanCache: false, repository: app.repository ?? null, owner: app.owner ?? null, branch: app.branch ?? null },
		...{ buildPath: app.buildPath ?? "/", triggerType: app.triggerType ?? "push", autoDeploy: app.autoDeploy === undefined ? true : app.autoDeploy },
		...{ gitlabProjectId: null, gitlabRepository: null, gitlabOwner: null, gitlabBranch: null, gitlabBuildPath: "/", gitlabPathNamespace: null, giteaRepository: null, giteaOwner: null, giteaBranch: null },
		...{ giteaBuildPath: "/", bitbucketRepository: null, bitbucketRepositorySlug: null, bitbucketOwner: null, bitbucketBranch: null, bitbucketBuildPath: "/", username: "deploy", password: "s3cr3t-registry" },
		...{ dockerImage: null, registryUrl: null, customGitUrl: null, customGitBranch: null, customGitBuildPath: null, customGitSSHKeyId: null, enableSubmodules: app.enableSubmodules ?? false },
		...{ dockerfile: app.dockerfile ?? null },
		...{ dockerContextPath: app.dockerContextPath ?? null, dockerBuildStage: null, dropBuildPath: app.dropBuildPath ?? null, healthCheckSwarm: null, restartPolicySwarm: null, placementSwarm: null, updateConfigSwarm: null },
		...{ rollbackConfigSwarm: null, modeSwarm: null, labelsSwarm: null, networkSwarm: app.networkSwarm ?? null, stopGracePeriodSwarm: null, endpointSpecSwarm: null, ulimitsSwarm: null, replicas: 1, applicationStatus: app.status },
		...{ buildType: app.buildType ?? "nixpacks", railpackVersion: "0.2.2", herokuVersion: "24", publishDirectory: null, isStaticSpa: null, createEnvFile: true, createdAt: `${DAY}T08:00:00.000Z`, registryId: null },
		...{ rollbackRegistryId: null, environmentId: environmentId(app.project, app.environment), githubId: app.githubId ?? null, gitlabId: null, giteaId: null, bitbucketId: null, serverId: app.serverId ?? null },
		...{ buildServerId: null },
		...{ buildRegistryId: null, networkIds: [], detachDokployNetwork: app.detachDokployNetwork ?? false },
		environment: { ...environmentRecord(app.project, app.environment), project: projectRecord(app.project) },
		domains: (app.domains ?? []).map((domain, index) => domainRecord(app, domain, index)),
		deployments: (app.deployments ?? []).map((deployment, index) => deploymentRecord(app, deployment, index)),
		mounts: (app.mounts ?? []).map((mount, index) => mountRecord(app, mount, index)),
		...{ redirects: [], security: [], ports: [], gitlab: null, github: github === undefined ? null : githubRecord(github), bitbucket: null, gitea: null, server: null, previewDeployments: [] },
		...{ registry: null, buildRegistry: null, rollbackRegistry: null },
		...{ hasGitProviderAccess: true, unauthorizedProvider: null },
	};
}

// `project.all` as Dokploy v0.30.10 answers an owner: each project, its environments with their services' few columns, and
// its tags; a project without apps has the production environment Dokploy makes with it.
function projectsRecord(apps: readonly FakeApp[], empty: readonly string[]) {
	const names = [...new Set([...apps.map((app) => app.project), ...empty])];
	return names.map((name) => ({
		...projectRecord(name),
		environments: [...new Set(apps.filter((app) => app.project === name).map((app) => app.environment).concat(empty.includes(name) ? ["production"] : []))].map((environment) => ({
			...{ name: environment, environmentId: environmentId(name, environment), isDefault: environment === "production" },
			applications: apps.filter((app) => app.project === name && app.environment === environment).map((app) => ({ applicationId: app.id, name: app.name, applicationStatus: app.status })),
			...{ mariadb: [], mongo: [], mysql: [{ mysqlId: `mysql-${projectId(name)}` }], postgres: [], redis: [], compose: [{ composeId: `cmp-${projectId(name)}`, name: "worker", composeStatus: "done" }], libsql: [] },
		})),
		projectTags: [{ id: `pt-${projectId(name)}`, projectId: projectId(name), tagId: "tag-1", tag: { tagId: "tag-1", name: "client", color: "#3b82f6", createdAt: `${DAY}T08:00:00.000Z`, organizationId: "org-1" } }],
	}));
}

// `project.all` as https://docs.dokploy.com/docs/api shows it, verbatim, before environments came; `apps` added to its
// project's `applications` with the three keys the plugin reads.
function documentedRecord(apps: readonly FakeApp[]) {
	const database = { command: null, env: null, memoryReservation: null, memoryLimit: null, cpuReservation: null, cpuLimit: null };
	const mysql = { mysqlId: "N3cudwO46TiDXzBm4SaQ1", name: "mysql", appName: "random-mysql-924715", description: "", databaseName: "mysql", databaseUser: "mysql", databasePassword: "h13BzO6y3KYSHaQg", databaseRootPassword: "mM1b7JeoPA7jArxj", dockerImage: "mysql:8", ...database, externalPort: null, applicationStatus: "done", createdAt: "2024-06-24T01:55:40.378Z", projectId: "klZKsyw5g-QT_jrWJ5T-w" };
	const redis = { redisId: "TtFK5S4QFaIjaNGOb8Ku-", name: "redis", appName: "random-redis-7eec62", description: "", databasePassword: "Yvb8gqClfomjcue8", dockerImage: "redis:7", ...database, externalPort: 6379, createdAt: "2024-06-26T06:43:20.570Z", applicationStatus: "done", projectId: "klZKsyw5g-QT_jrWJ5T-w" };
	const applications = apps.map((app) => ({ applicationId: app.id, name: app.name, applicationStatus: app.status }));
	return [{ projectId: "klZKsyw5g-QT_jrWJ5T-w", name: "Random", description: "", createdAt: "2024-06-19T15:05:58.785Z", adminId: "_WrKZbs7iJAA3p4N2Yfyu", applications, mariadb: [], mongo: [], mysql: [mysql], postgres: [], redis: [redis], compose: [] }];
}

// tRPC's error as Dokploy's REST handler sends it (@dokploy/trpc-openapi): its shape, with Dokploy's errorFormatter's `zodError`.
export const trpcError = (status: number, code: string, message: string, path: string) => ({ status, body: { message, code, data: { code, httpStatus: status, path, zodError: null } } });
// The same for input zod refuses: `issues`, and errorFormatter's flattened `zodError`, naming each field and what zod said of it.
const inputError = (path: string, fields: readonly string[], message = "Required") => {
	const { body } = trpcError(400, "BAD_REQUEST", "Input validation failed", path);
	const fieldErrors = Object.fromEntries(fields.map((each) => [each, [message]]));
	return { ...body, data: { ...body.data, zodError: { formErrors: [], fieldErrors } }, issues: fields.map((each) => ({ code: "invalid_type", expected: "string", received: "undefined", path: [each], message })) };
};

// What each write's input requires (apiCreateApplication, apiSaveBuildType, apiSaveEnvironmentVariables, apiCreateDomain,
// apiCreateMount, apiSaveGithubProvider, apiUpdateApplication, apiCreatePostgres, apiDeployPostgres at v0.30.10); `applicationId`
// or `serviceId` names the app it changes.
const REQUIRED: Readonly<Record<string, readonly string[]>> = {
	"application.deploy": ["applicationId"],
	"application.dropDeployment": ["applicationId", "zip"],
	"application.create": ["name", "environmentId"],
	"application.saveBuildType": ["applicationId", "buildType", "dockerfile", "dockerContextPath", "dockerBuildStage", "herokuVersion", "railpackVersion"],
	"application.saveEnvironment": ["applicationId", "env", "buildArgs", "buildSecrets", "createEnvFile"],
	"domain.create": ["host", "applicationId"],
	"mounts.create": ["type", "mountPath", "serviceType", "serviceId"],
	"domain.validateDomain": ["domain"],
	"application.saveGithubProvider": ["applicationId", "repository", "owner", "buildPath", "githubId", "branch", "triggerType"],
	"application.update": ["applicationId"],
	"postgres.create": ["name", "databaseName", "databaseUser", "databasePassword", "environmentId"],
	"postgres.deploy": ["postgresId"],
};
// What `domain.validateDomain` answers (validateDomain at v0.30.10): a host under `.invalid` does not resolve, one starting
// `elsewhere.` resolves to another server, any other to this one.
function validated(host: string) {
	if (host.endsWith(".invalid")) return { isValid: false, error: `queryA ENOTFOUND ${host}` };
	if (host.startsWith("elsewhere.")) return { isValid: false, resolvedIp: "198.51.100.7", error: "Domain resolves to 198.51.100.7 but should point to 203.0.113.10" };
	return { isValid: true, resolvedIp: "203.0.113.10" };
}

async function bodyOf(request: IncomingMessage, type: string): Promise<Sent> {
	const raw = Buffer.concat(await request.toArray());
	// co-body refuses a body that is no JSON; its fields are then none, so zod refuses the input.
	if (type === "application/json") return { fields: ((text) => { try { return JSON.parse(text); } catch { return {}; } })(raw.toString("utf8")), files: {} };
	if (!type.startsWith("multipart/form-data")) return { fields: {}, files: {} };
	const form = [...(await new Response(raw, { headers: { "content-type": type } }).formData())];
	const files = await Promise.all(form.flatMap(([key, value]) => (typeof value === "string" ? [] : [(async () => [key, { name: value.name, type: value.type, bytes: Buffer.from(await value.arrayBuffer()) }] as const)()])));
	return { fields: Object.fromEntries(form.filter(([, value]) => typeof value === "string")), files: Object.fromEntries(files) };
}

// The entries of a zip read back the way an unzip does, from the end of central directory: each central header checked
// against its local header, the data inflated or stored, its CRC-32 and size checked; no byte left over between them.
export function readZip(zip: Buffer): { readonly name: string; readonly method: number; readonly mode: number; readonly data: Buffer }[] {
	const end = zip.length - 22;
	assert.equal(zip.readUInt32LE(end), 0x06054b50, "the end of central directory, with no comment");
	const [count, size, start] = [zip.readUInt16LE(end + 10), zip.readUInt32LE(end + 12), zip.readUInt32LE(end + 16)];
	assert.equal(zip.readUInt16LE(end + 8), count, "the entries on this disk are all of them");
	assert.equal(start + size, end, "the central directory ends where its end record starts");
	const entries = [];
	let [at, next] = [start, 0];
	for (let index = 0; index < count; index++) {
		assert.equal(zip.readUInt32LE(at), 0x02014b50, `central header ${index}`);
		const [flags, method, crc, packed, length, nameLength] = [zip.readUInt16LE(at + 8), zip.readUInt16LE(at + 10), zip.readUInt32LE(at + 16), zip.readUInt32LE(at + 20), zip.readUInt32LE(at + 24), zip.readUInt16LE(at + 28)];
		const [extra, comment, local] = [zip.readUInt16LE(at + 30), zip.readUInt16LE(at + 32), zip.readUInt32LE(at + 42)];
		const name = zip.subarray(at + 46, at + 46 + nameLength);
		assert.deepEqual([flags, extra, comment, local], [0x0800, 0, 0, next], `central header ${index}: UTF-8 names, no extra field or comment, right after the last entry`);
		assert.equal(zip.readUInt32LE(local), 0x04034b50, `local header ${index}`);
		const fields = [zip.readUInt16LE(local + 6), zip.readUInt16LE(local + 8), zip.readUInt32LE(local + 14), zip.readUInt32LE(local + 18), zip.readUInt32LE(local + 22), zip.readUInt16LE(local + 26), zip.readUInt16LE(local + 28)];
		assert.deepEqual(fields, [flags, method, crc, packed, length, nameLength, 0], `local header ${index} agrees with its central header`);
		assert.deepEqual(zip.subarray(local + 30, local + 30 + nameLength), name);
		const body = zip.subarray(local + 30 + nameLength, local + 30 + nameLength + packed);
		const data = method === 8 ? inflateRawSync(body) : method === 0 ? Buffer.from(body) : assert.fail(`method ${method}`);
		assert.deepEqual([crc32(data), data.length], [crc, length], `${name}: its CRC-32 and size`);
		entries.push({ name: name.toString("utf8"), method, mode: zip.readUInt32LE(at + 38) >>> 16, data });
		[at, next] = [at + 46 + nameLength, local + 30 + nameLength + packed];
	}
	assert.deepEqual([at, next], [end, start], "nothing between the entries, the central directory and its end");
	return entries;
}

// The fake, with `apps` on it, `empty` projects without any, `githubs`, its GitHub apps, and `databases`, its Postgres; `form`
// the `project.all` it answers; `scripted` what a procedure answers instead of its own, changed by a test as it goes. `seen`:
// every request, in order; `live` and `postgres`: the apps and the databases as the writes left them.
export async function fakeDokploy(t: TestContext, { apps = [] as readonly FakeApp[], empty = [] as readonly string[], githubs = [] as readonly FakeGithub[], databases = [] as readonly FakePostgres[], form = "v0.30.10" as "v0.30.10" | "documented", token = TOKEN } = {}) {
	const [seen, scripted, live, postgres] = [[] as Seen[], new Map<string, Scripted>(), [...apps], [...databases]];
	// Each environment's id, and its project and name, so `application.create` and `postgres.create` can place what they make.
	const places = new Map([...[...apps, ...databases].map((each) => [each.project, each.environment]), ...empty.map((name) => [name, "production"])].map(([project = "", name = ""]) => [environmentId(project, name), { project, environment: name }]));
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const fake = createServer(async (request: IncomingMessage, response: ServerResponse) => {
		const url = new URL(request.url ?? "/", "http://localhost");
		const [key, type] = [request.headers["x-api-key"], request.headers["content-type"]];
		const sent = request.method === "POST" ? await bodyOf(request, type ?? "") : undefined;
		seen.push({ method: request.method ?? "", path: url.pathname, query: Object.fromEntries(url.searchParams), key: typeof key === "string" ? key : undefined, type, ...(sent === undefined ? {} : { sent }) });
		// pages/api/[...trpc].ts: no session for the key, before any procedure.
		if (key !== token) return send(response, 401, { message: "Unauthorized" });
		const procedure = url.pathname.replace(/^.*\/api\//, "");
		const script = scripted.get(procedure);
		if (script === "hang") return;
		if (typeof script === "function") return ((answer) => send(response, answer.status, answer.body))(script(sent));
		if (script === "not-json") return response.writeHead(200, { "Content-Type": "text/html" }).end("<!DOCTYPE html><title>Dokploy</title>");
		if (script !== undefined && typeof script === "object" && "empty" in script) return response.writeHead(script.empty).end();
		if (script !== undefined && "redirect" in script) return response.writeHead(302, { Location: script.redirect }).end();
		if (script !== undefined) return send(response, script.status, script.body);
		const asked = request.method === "POST" ? (sent?.fields.applicationId ?? sent?.fields.serviceId) : url.searchParams.get("applicationId");
		const index = live.findIndex((each) => each.id === asked);
		const app = live[index];
		if (request.method === "GET" && procedure === "project.all") return send(response, 200, form === "documented" ? documentedRecord(live) : projectsRecord(live, empty));
		if (request.method === "GET" && procedure === "application.one") {
			if (app === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Application not found", procedure).body);
			return send(response, 200, applicationRecord(app, githubs));
		}
		if (request.method === "GET" && procedure === "deployment.all") return send(response, 200, app === undefined ? [] : (app.deployments ?? []).map((deployment, index) => deploymentRecord(app, deployment, index)).toReversed());
		if (request.method === "GET" && procedure === "github.githubProviders") return send(response, 200, githubs.map(providerRecord));
		if (request.method === "GET" && procedure.startsWith("github.getGithub")) {
			const github = githubs.find((each) => each.id === url.searchParams.get("githubId"));
			if (github === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Github Provider not found", procedure).body);
			if (procedure === "github.getGithubRepositories") return send(response, 200, github.repositories.map((each) => repositoryRecord(each.owner, each.name)));
			const repository = github.repositories.find((each) => each.owner === url.searchParams.get("owner") && each.name === url.searchParams.get("repo"));
			// GitHub answers 404 for a repository the installation does not see; tRPC turns octokit's error into a 500.
			if (repository === undefined) return send(response, 500, trpcError(500, "INTERNAL_SERVER_ERROR", "Not Found - https://docs.github.com/rest/branches/branches#list-branches", procedure).body);
			return send(response, 200, repository.branches.map((name) => ({ ...GITHUB.branch, name })));
		}
		if (request.method === "GET" && procedure === "environment.one") {
			const place = places.get(url.searchParams.get("environmentId") ?? "");
			if (place === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Environment not found", procedure).body);
			return send(response, 200, environmentOne(place, live, postgres));
		}
		const database = postgres.findIndex((each) => each.id === (sent?.fields.postgresId ?? url.searchParams.get("postgresId")));
		const db = postgres[database];
		if (request.method === "GET" && procedure === "postgres.one") return db === undefined ? send(response, 404, trpcError(404, "NOT_FOUND", "Postgres not found", procedure).body) : send(response, 200, postgresOne(db));
		const required = request.method === "POST" && Object.hasOwn(REQUIRED, procedure) ? REQUIRED[procedure] : undefined;
		if (required === undefined || sent === undefined) return send(response, 404, { message: "Not found", code: "NOT_FOUND" });
		// Each write answers when it is done or queued: `deploy` with no body (its procedure returns nothing), `dropDeployment`
		// and the saves with `true`, a create with the record it made; a body of another type is refused before any procedure.
		if (!/^(application\/json|multipart\/form-data)/.test(type ?? "")) return send(response, 415, trpcError(415, "UNSUPPORTED_MEDIA_TYPE", `Unsupported content-type "${type}`, procedure).body);
		const { fields } = sent;
		const lacking = required.filter((each) => (each === "zip" ? sent.files.zip === undefined : fields[each] === undefined));
		if (lacking.length > 0) return send(response, 400, inputError(procedure, lacking));
		if (procedure === "domain.validateDomain") return send(response, 200, validated(String(fields.domain)));
		if (procedure === "application.create") {
			const place = places.get(String(fields.environmentId));
			if (place === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Environment not found", procedure).body);
			const made: FakeApp = { id: `kXx3new${live.length}`, name: String(fields.name), status: "idle", ...place, sourceType: "github", dockerfile: "Dockerfile", env: null };
			live.push(made);
			return send(response, 200, Object.fromEntries(Object.entries(applicationRecord(made)).filter(([key]) => !RELATED.includes(key))));
		}
		if (procedure === "postgres.create") {
			const place = places.get(String(fields.environmentId));
			if (place === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Environment not found", procedure).body);
			// apiCreatePostgres holds the password to DATABASE_PASSWORD_REGEX (schema/utils.ts).
			const message = "Password contains invalid characters. Please avoid: $ ! ' \" \\ / and space characters for database compatibility";
			if (!/^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/.test(String(fields.databasePassword))) return send(response, 400, inputError(procedure, ["databasePassword"], message));
			// buildAppName("postgres") without an appName: generateAppName's hacker words and a nanoid of 6.
			const appName = `postgres-parse-online-pixel-${`k7m2q${postgres.length + 1}`.slice(-6)}`;
			const [server, image] = [typeof fields.serverId === "string" ? { serverId: fields.serverId } : {}, typeof fields.dockerImage === "string" ? fields.dockerImage : "postgres:18"];
			const made: FakePostgres = { id: `pgNew${postgres.length}`, name: String(fields.name), ...place, appName, status: "idle", password: String(fields.databasePassword), user: String(fields.databaseUser), database: String(fields.databaseName), image, ...server };
			postgres.push(made);
			return send(response, 200, postgresRecord(made));
		}
		if (procedure === "postgres.deploy") {
			if (db === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Postgres not found", procedure).body);
			// deployPostgres answers the record it read before the deploy, then marks it done.
			postgres[database] = { ...db, status: "done" };
			return send(response, 200, postgresOne(db));
		}
		if (app === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Application not found", procedure).body);
		if (procedure === "application.deploy") return response.writeHead(200, { "Content-Type": "application/json" }).end();
		if (procedure === "application.dropDeployment") return send(response, 200, true);
		const changed = (more: Partial<FakeApp>) => (live[index] = { ...app, ...more });
		if (procedure === "application.saveBuildType") changed({ buildType: String(fields.buildType), dockerfile: fields.dockerfile as string, dockerContextPath: fields.dockerContextPath as string | null });
		if (procedure === "application.saveEnvironment") changed({ env: String(fields.env) });
		if (procedure === "application.saveGithubProvider") {
			const github = { githubId: String(fields.githubId), owner: String(fields.owner), repository: String(fields.repository), branch: String(fields.branch), buildPath: String(fields.buildPath) };
			changed({ ...github, sourceType: "github", status: "idle", triggerType: fields.triggerType as "push", watchPaths: fields.watchPaths as string[], enableSubmodules: fields.enableSubmodules === true });
		}
		if (procedure === "application.update" && typeof fields.autoDeploy === "boolean") changed({ autoDeploy: fields.autoDeploy });
		if (procedure === "domain.create") {
			const domain = { host: String(fields.host), https: fields.https === true, port: Number(fields.port) };
			changed({ domains: [...(app.domains ?? []), domain] });
			return send(response, 200, domainRecord(app, domain, (app.domains ?? []).length));
		}
		if (procedure === "mounts.create") {
			const mount = { type: fields.type as "volume", volumeName: String(fields.volumeName), mountPath: String(fields.mountPath) };
			changed({ mounts: [...(app.mounts ?? []), mount] });
			return send(response, 200, mountRecord(app, mount, (app.mounts ?? []).length));
		}
		send(response, 200, true);
	});
	fake.listen(0, "127.0.0.1");
	await once(fake, "listening");
	t.after(() => {
		fake.closeAllConnections();
		fake.close();
	});
	return { url: `http://127.0.0.1:${(fake.address() as AddressInfo).port}`, seen, scripted, live, postgres };
}
