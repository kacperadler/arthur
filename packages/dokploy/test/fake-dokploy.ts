import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

// The fake Dokploy the dokploy tests share: a `node:http` server on a port the OS picks, answering as Dokploy v0.30.10
// does, every field of each answer that test/dokploy-shapes.json records, or `project.all` as the documentation's example.

export const TOKEN = "kdQ7uZ3sA0pT1mN2vB4xC6yD8eF9gH0iJ1kL2mN3oP4qR5sT6uV7wX8yZ9aB0cD1e";

// Values Dokploy answers that `arthur dokploy` must never print: an app's env, build args and secrets, its git refresh token
// and registry password, a project's and an environment's env, and the documentation's database passwords.
export const SECRETS = ["DATABASE_URL=postgres://shop:s3cr3t-db@db/shop", "NPM_TOKEN=npm_s3cr3tBuildArg", "SENTRY_AUTH=s3cr3tBuildSecret", "PREVIEW_KEY=s3cr3tPreview", "ghr_s3cr3tRefresh", "s3cr3t-registry", "PROJECT_KEY=s3cr3tProject", "ENVIRONMENT_KEY=s3cr3tEnvironment", "h13BzO6y3KYSHaQg", "mM1b7JeoPA7jArxj", "Yvb8gqClfomjcue8"];

export type FakeDeployment = { readonly title: string; readonly status: "running" | "done" | "error" | "cancelled"; readonly createdAt: string; readonly finishedAt?: string; readonly errorMessage?: string };
export type FakeApp = {
	readonly id: string;
	readonly name: string;
	readonly status: "idle" | "running" | "done" | "error";
	readonly project: string;
	readonly environment: string;
	readonly sourceType?: string;
	readonly domains?: readonly { readonly host: string; readonly https: boolean; readonly path?: string }[];
	readonly deployments?: readonly FakeDeployment[];
};
// What a procedure answers in place of its own: a status and body, a redirect to `location`, no answer at all, or text that is not JSON.
export type Scripted = { readonly status: number; readonly body: unknown } | { readonly redirect: string } | "hang" | "not-json";
export type Seen = { readonly method: string; readonly path: string; readonly query: Readonly<Record<string, string>>; readonly key: string | undefined };

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

// `application.one`: every column of the application table, its environment with its project, and the related records
// findApplicationById reads, the git providers, server and registries none, as for an app without them.
function applicationRecord(app: FakeApp) {
	const domains = (app.domains ?? []).map((domain, index) => ({
		...{ domainId: `dom-${app.id}-${index}`, host: domain.host, https: domain.https, port: 3000, customEntrypoint: null, path: domain.path ?? "/", serviceName: null, domainType: "application" },
		...{ uniqueConfigKey: index + 1, createdAt: `${DAY}T08:00:00.000Z`, composeId: null, customCertResolver: null, applicationId: app.id, previewDeploymentId: null, certificateType: domain.https ? "letsencrypt" : "none" },
		...{ internalPath: "/", stripPath: false, middlewares: null, forwardAuthEnabled: false, enabled: true },
	}));
	return {
		...{ applicationId: app.id, name: app.name, appName: `${app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-a1b2c3`, description: null, env: "DATABASE_URL=postgres://shop:s3cr3t-db@db/shop", previewEnv: "PREVIEW_KEY=s3cr3tPreview" },
		...{ watchPaths: null, previewBuildArgs: null, previewBuildSecrets: null, previewLabels: null, previewWildcard: null, previewPort: 3000, previewHttps: false, previewPath: "/", previewCertificateType: "none" },
		...{ previewCustomCertResolver: null, previewLimit: 3, isPreviewDeploymentsActive: false, previewRequireCollaboratorPermissions: true, rollbackActive: false, buildArgs: "NPM_TOKEN=npm_s3cr3tBuildArg" },
		...{ buildSecrets: "SENTRY_AUTH=s3cr3tBuildSecret", memoryReservation: null, memoryLimit: null, cpuReservation: null, cpuLimit: null, title: null, enabled: null, subtitle: null, command: null, args: null, icon: null },
		...{ refreshToken: "ghr_s3cr3tRefresh", sourceType: app.sourceType ?? "drop", cleanCache: false, repository: null, owner: null, branch: null, buildPath: "/", triggerType: "push", autoDeploy: true },
		...{ gitlabProjectId: null, gitlabRepository: null, gitlabOwner: null, gitlabBranch: null, gitlabBuildPath: "/", gitlabPathNamespace: null, giteaRepository: null, giteaOwner: null, giteaBranch: null },
		...{ giteaBuildPath: "/", bitbucketRepository: null, bitbucketRepositorySlug: null, bitbucketOwner: null, bitbucketBranch: null, bitbucketBuildPath: "/", username: "deploy", password: "s3cr3t-registry" },
		...{ dockerImage: null, registryUrl: null, customGitUrl: null, customGitBranch: null, customGitBuildPath: null, customGitSSHKeyId: null, enableSubmodules: false, dockerfile: null, dockerContextPath: null },
		...{ dockerBuildStage: null, dropBuildPath: null, healthCheckSwarm: null, restartPolicySwarm: null, placementSwarm: null, updateConfigSwarm: null, rollbackConfigSwarm: null, modeSwarm: null, labelsSwarm: null },
		...{ networkSwarm: null, stopGracePeriodSwarm: null, endpointSpecSwarm: null, ulimitsSwarm: null, replicas: 1, applicationStatus: app.status, buildType: "nixpacks", railpackVersion: "0.2.2", herokuVersion: "24" },
		...{ publishDirectory: null, isStaticSpa: null, createEnvFile: true, createdAt: `${DAY}T08:00:00.000Z`, registryId: null, rollbackRegistryId: null, environmentId: environmentId(app.project, app.environment) },
		...{ githubId: null, gitlabId: null, giteaId: null, bitbucketId: null, serverId: null, buildServerId: null, buildRegistryId: null, networkIds: [], detachDokployNetwork: false },
		environment: { ...environmentRecord(app.project, app.environment), project: projectRecord(app.project) },
		domains,
		deployments: (app.deployments ?? []).map((deployment, index) => deploymentRecord(app, deployment, index)),
		...{ mounts: [], redirects: [], security: [], ports: [], gitlab: null, github: null, bitbucket: null, gitea: null, server: null, previewDeployments: [], registry: null, buildRegistry: null, rollbackRegistry: null },
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

// The fake, with `apps` on it, and `empty` projects without any; `form` the `project.all` it answers; `scripted` what a
// procedure answers instead of its own, changed by a test as it goes. `seen`: every request, in order.
export async function fakeDokploy(t: TestContext, { apps = [] as readonly FakeApp[], empty = [] as readonly string[], form = "v0.30.10" as "v0.30.10" | "documented", token = TOKEN } = {}) {
	const [seen, scripted] = [[] as Seen[], new Map<string, Scripted>()];
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const fake = createServer((request: IncomingMessage, response: ServerResponse) => {
		const url = new URL(request.url ?? "/", "http://localhost");
		const key = request.headers["x-api-key"];
		seen.push({ method: request.method ?? "", path: url.pathname, query: Object.fromEntries(url.searchParams), key: typeof key === "string" ? key : undefined });
		// pages/api/[...trpc].ts: no session for the key, before any procedure.
		if (key !== token) return send(response, 401, { message: "Unauthorized" });
		const procedure = url.pathname.replace(/^.*\/api\//, "");
		const script = scripted.get(procedure);
		if (script === "hang") return;
		if (script === "not-json") return response.writeHead(200, { "Content-Type": "text/html" }).end("<!DOCTYPE html><title>Dokploy</title>");
		if (script !== undefined && "redirect" in script) return response.writeHead(302, { Location: script.redirect }).end();
		if (script !== undefined) return send(response, script.status, script.body);
		const app = apps.find((each) => each.id === url.searchParams.get("applicationId"));
		if (request.method === "GET" && procedure === "project.all") return send(response, 200, form === "documented" ? documentedRecord(apps) : projectsRecord(apps, empty));
		if (request.method === "GET" && procedure === "application.one") {
			if (app === undefined) return send(response, 404, trpcError(404, "NOT_FOUND", "Application not found", procedure).body);
			return send(response, 200, applicationRecord(app));
		}
		if (request.method === "GET" && procedure === "deployment.all") return send(response, 200, app === undefined ? [] : (app.deployments ?? []).map((deployment, index) => deploymentRecord(app, deployment, index)).toReversed());
		send(response, 404, { message: "Not found", code: "NOT_FOUND" });
	});
	fake.listen(0, "127.0.0.1");
	await once(fake, "listening");
	t.after(() => {
		fake.closeAllConnections();
		fake.close();
	});
	return { url: `http://127.0.0.1:${(fake.address() as AddressInfo).port}`, seen, scripted };
}
