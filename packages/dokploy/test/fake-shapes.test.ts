import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fakeDokploy, TOKEN } from "./fake-dokploy.ts";

// The keys of each answer, recorded in dokploy-shapes.json from the example of Dokploy's documentation and from Dokploy's
// source at v0.30.10 (its `sources`, read on its `recorded` day), since Dokploy's openapi.json describes every answer as {}.
// The fake changes shape only through a reviewed change of that file.
const { shapes } = JSON.parse(readFileSync(new URL("dokploy-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown> };

// Each key path where `got` and the recorded `shape` differ: `-` a key the record shows and the fake leaves out, `+` one the
// fake adds, or a list or object the fake answers as something else. Each item of a list is held to the recorded first
// item; a null on either side, or a value recorded as neither list nor object, is not compared.
const drift = (got: unknown, shape: unknown, at = ""): string[] => {
	if (got === null || shape === null || typeof shape !== "object") return [];
	if (Array.isArray(shape)) return Array.isArray(got) ? got.flatMap((item, index) => drift(item, shape[0], `${at}[${index}]`)) : [`${at}: not a list`];
	if (typeof got !== "object" || Array.isArray(got)) return [`${at}: not an object`];
	const [has, shown] = [got as Record<string, unknown>, shape as Record<string, unknown>];
	return [
		...Object.keys(shown).filter((key) => !(key in has)).map((key) => `- ${at}.${key}`),
		...Object.keys(has).filter((key) => !(key in shown)).map((key) => `+ ${at}.${key}`),
		...Object.keys(shown).filter((key) => key in has).flatMap((key) => drift(has[key], shown[key], `${at}.${key}`)),
	];
};

test("every route of the fake Dokploy answers with the keys the documentation's example and Dokploy v0.30.10 show, at every depth", async (t) => {
	const deployments = [{ title: "First", status: "done" as const, createdAt: "2026-10-29T09:00:00.000Z", finishedAt: "2026-10-29T09:02:00.000Z" }, { title: "Second", status: "error" as const, createdAt: "2026-10-30T09:00:00.000Z", errorMessage: "failed" }];
	const source = { githubId: "gh-1", owner: "acme", repository: "web-shop", branch: "main" };
	const app = { id: "kXx3", name: "Shop", status: "done" as const, project: "Shop", environment: "production", domains: [{ host: "shop.example", https: true }], deployments, mounts: [{ type: "volume" as const, volumeName: "data", mountPath: "/data" }], ...source };
	const githubs = [{ id: "gh-1", name: "acme", repositories: [{ owner: "acme", name: "web-shop", branches: ["main"] }] }];
	const databases = [{ id: "pg-1", name: "db", project: "Shop", environment: "production", appName: "shop-db-x1y2z3", status: "idle" as const, backups: [{ id: "bk-1", schedule: "0 3 * * *", destination: "s3-main", keep: 7, enabled: true }] }];
	const current = await fakeDokploy(t, { apps: [app], empty: ["Archive"], githubs, databases, destinations: ["s3-main"] });
	const documented = await fakeDokploy(t, { apps: [app], form: "documented" });
	const get = async (base: string, path: string, headers: Record<string, string> = { "x-api-key": TOKEN }) => (await fetch(new URL(path, base), { headers })).json();
	const post = async (path: string, body: FormData | string, headers: Record<string, string> = {}) => (await fetch(new URL(path, current.url), { method: "POST", headers: { "x-api-key": TOKEN, ...headers }, body })).json();
	const json = (path: string, body: unknown) => post(path, JSON.stringify(body), { "Content-Type": "application/json" });
	const build = { applicationId: "kXx3", buildType: "dockerfile", dockerfile: "Dockerfile", dockerContextPath: ".", dockerBuildStage: null, herokuVersion: "24", railpackVersion: "0.2.2" };
	const form = new FormData();
	form.set("applicationId", "kXx3");
	form.set("zip", new Blob(["PK\x05\x06".padEnd(22, "\0")], { type: "application/zip" }), "upload.zip");
	// An app with a GitHub app answers its record, which the comparison skips when it is null.
	const one = await get(current.url, "/api/application.one?applicationId=kXx3");
	assert.equal(one.github?.githubId, "gh-1");
	const routes: [string, unknown][] = [
		["project-all", await get(current.url, "/api/project.all")],
		["project-all-documented", await get(documented.url, "/api/project.all")],
		["application-one", one],
		["deployment-all", await get(current.url, "/api/deployment.all?applicationId=kXx3")],
		["error", await get(current.url, "/api/application.one?applicationId=gone")],
		["error-unauthorized", await get(current.url, "/api/project.all", {})],
		["application-drop-deployment", await post("/api/application.dropDeployment", form)],
		["error-input", await post("/api/application.deploy", "{}", { "Content-Type": "application/json" })],
		["application-create", await json("/api/application.create", { name: "New", environmentId: "env-shop-production" })],
		["application-save-build-type", await json("/api/application.saveBuildType", build)],
		["application-save-environment", await json("/api/application.saveEnvironment", { applicationId: "kXx3", env: "A=1", buildArgs: "", buildSecrets: "", createEnvFile: true })],
		["domain-create", await json("/api/domain.create", { host: "new.shop.example", port: 3000, https: true, certificateType: "letsencrypt", applicationId: "kXx3", domainType: "application" })],
		["mounts-create", await json("/api/mounts.create", { type: "volume", volumeName: "files", mountPath: "/files", serviceType: "application", serviceId: "kXx3" })],
		["domain-validate-domain", await json("/api/domain.validateDomain", { domain: "shop.example" })],
		["domain-validate-domain-elsewhere", await json("/api/domain.validateDomain", { domain: "elsewhere.shop.example" })],
		["domain-validate-domain-unresolved", await json("/api/domain.validateDomain", { domain: "shop.invalid" })],
		["github-github-providers", await get(current.url, "/api/github.githubProviders")],
		["github-get-github-repositories", await get(current.url, "/api/github.getGithubRepositories?githubId=gh-1")],
		["github-get-github-branches", await get(current.url, "/api/github.getGithubBranches?repo=web-shop&owner=acme&githubId=gh-1")],
		["application-save-github-provider", await json("/api/application.saveGithubProvider", { applicationId: "kXx3", ...source, buildPath: "/", triggerType: "push", watchPaths: [], enableSubmodules: false })],
		["application-update", await json("/api/application.update", { applicationId: "kXx3", autoDeploy: true })],
		["environment-one", await get(current.url, "/api/environment.one?environmentId=env-shop-production")],
		["postgres-one", await get(current.url, "/api/postgres.one?postgresId=pg-1")],
		["postgres-deploy", await json("/api/postgres.deploy", { postgresId: "pg-1" })],
		["postgres-create", await json("/api/postgres.create", { name: "new", environmentId: "env-shop-production", dockerImage: "postgres:18", databaseName: "postgres", databaseUser: "postgres", databasePassword: "a1b2" })],
		["destination-all", await get(current.url, "/api/destination.all")],
		["error-input", await json("/api/postgres.create", { name: "new", environmentId: "env-shop-production", databaseName: "postgres", databaseUser: "postgres", databasePassword: "pa$$ word" })],
	];
	assert.deepEqual([6, 9, 10, 19, 20].map((index) => routes[index]?.[1]), [true, true, true, true, true], "dropDeployment, the saves and the update answer true");
	// Dokploy's DATABASE_PASSWORD_REGEX refuses a $ and a space.
	assert.match(JSON.stringify(routes.at(-1)?.[1]), /"path":\["databasePassword"\],"message":"Password contains invalid characters\. /);
	assert.deepEqual(
		routes.flatMap(([name, got]) => (name in shapes ? drift(got, shapes[name], name) : [`${name} not recorded`])),
		[],
	);
});

// tRPC's error body names the status it went with (data.httpStatus), as the HTTP status of the answer.
test("each Postgres route's not-found answers 404 and says 404 in its body", async (t) => {
	const current = await fakeDokploy(t);
	const ask = async (path: string, body?: unknown) => {
		const response = await fetch(new URL(path, current.url), { method: body === undefined ? "GET" : "POST", headers: { "x-api-key": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
		return [response.status, (await response.json()).data.httpStatus];
	};
	const create = { name: "db", environmentId: "env-gone", databaseName: "postgres", databaseUser: "postgres", databasePassword: "a1b2" };
	const answers = [await ask("/api/environment.one?environmentId=env-gone"), await ask("/api/postgres.one?postgresId=pg-gone"), await ask("/api/postgres.create", create), await ask("/api/postgres.deploy", { postgresId: "pg-gone" })];
	assert.deepEqual(answers, [[404, 404], [404, 404], [404, 404], [404, 404]]);
});

test("the comparison names a key the fake leaves out, one it adds, a list or object answered as something else, at any depth and in any item, and takes null for any shape", () => {
	const shape = { id: null, environment: { name: null }, domains: [{ host: null }], github: { owner: null } };
	assert.deepEqual(drift({ id: 1, environment: { name: "a" }, domains: [{ host: "x" }], github: null }, shape), []);
	assert.deepEqual(drift({ environment: { name: "a", env: "X=1" }, domains: [{ host: "x" }, {}], github: {} }, shape), ["- .id", "+ .environment.env", "- .domains[1].host", "- .github.owner"]);
	assert.deepEqual(drift({ id: 1, environment: { name: "a" }, domains: [{ port: 3000 }], github: null }, { ...shape, domains: [] }), [], "an empty recorded list shows no item to hold the fake's to");
	assert.deepEqual(drift({ id: 1, environment: "a", domains: { host: "x" }, github: [] }, shape), [".environment: not an object", ".domains: not a list", ".github: not an object"]);
});
