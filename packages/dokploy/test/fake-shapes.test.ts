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
	const app = { id: "kXx3", name: "Shop", status: "done" as const, project: "Shop", environment: "production", domains: [{ host: "shop.example", https: true }], deployments };
	const current = await fakeDokploy(t, { apps: [app], empty: ["Archive"] });
	const documented = await fakeDokploy(t, { apps: [app], form: "documented" });
	const get = async (base: string, path: string, headers: Record<string, string> = { "x-api-key": TOKEN }) => (await fetch(new URL(path, base), { headers })).json();
	const routes: [string, unknown][] = [
		["project-all", await get(current.url, "/api/project.all")],
		["project-all-documented", await get(documented.url, "/api/project.all")],
		["application-one", await get(current.url, "/api/application.one?applicationId=kXx3")],
		["deployment-all", await get(current.url, "/api/deployment.all?applicationId=kXx3")],
		["error", await get(current.url, "/api/application.one?applicationId=gone")],
		["error-unauthorized", await get(current.url, "/api/project.all", {})],
	];
	assert.deepEqual(
		routes.flatMap(([name, got]) => (name in shapes ? drift(got, shapes[name], name) : [`${name} not recorded`])),
		[],
	);
});

test("the comparison names a key the fake leaves out, one it adds, a list or object answered as something else, at any depth and in any item, and takes null for any shape", () => {
	const shape = { id: null, environment: { name: null }, domains: [{ host: null }], github: { owner: null } };
	assert.deepEqual(drift({ id: 1, environment: { name: "a" }, domains: [{ host: "x" }], github: null }, shape), []);
	assert.deepEqual(drift({ environment: { name: "a", env: "X=1" }, domains: [{ host: "x" }, {}], github: {} }, shape), ["- .id", "+ .environment.env", "- .domains[1].host", "- .github.owner"]);
	assert.deepEqual(drift({ id: 1, environment: { name: "a" }, domains: [{ port: 3000 }], github: null }, { ...shape, domains: [] }), [], "an empty recorded list shows no item to hold the fake's to");
	assert.deepEqual(drift({ id: 1, environment: "a", domains: { host: "x" }, github: [] }, shape), [".environment: not an object", ".domains: not a list", ".github: not an object"]);
});
