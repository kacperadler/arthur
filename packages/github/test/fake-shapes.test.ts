import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fakeGithub } from "./fake-github.ts";

// The keys of each answer the documentation shows, recorded in github-shapes.json from the examples of GitHub's REST API
// description (its `source`, read on its `recorded` day). The fake changes shape only through a reviewed change of that file.
const { shapes } = JSON.parse(readFileSync(new URL("github-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown> };

// Each key path where `got` and the documented `shape` differ: `-` a key the documentation shows and the fake leaves out,
// `+` one the fake adds. Each item of an array is held to the documented first item; a null on either side is not compared.
const drift = (got: unknown, shape: unknown, at = ""): string[] => {
	if (got === null || shape === null || typeof got !== "object" || typeof shape !== "object") return [];
	if (Array.isArray(shape)) return Array.isArray(got) && shape.length > 0 ? got.flatMap((item, index) => drift(item, shape[0], `${at}[${index}]`)) : [];
	const [has, shown] = [got as Record<string, unknown>, shape as Record<string, unknown>];
	return [
		...Object.keys(shown).filter((key) => !(key in has)).map((key) => `- ${at}.${key}`),
		...Object.keys(has).filter((key) => !(key in shown)).map((key) => `+ ${at}.${key}`),
		...Object.keys(shown).filter((key) => key in has).flatMap((key) => drift(has[key], shown[key], `${at}.${key}`)),
	];
};

test("every route of the fake GitHub answers with the keys GitHub's documentation shows, at every depth", async (t) => {
	const api = await fakeGithub(t);
	api.runs["acme/shop/ci.yml"] = [{ id: 30433642, attempt: 2, sha: "abc", branch: "arthur/1", status: "completed", conclusion: "failure" }, { id: 7, sha: "def", branch: "main", status: "completed", conclusion: "success" }];
	api.jobs[30433642] = [{ id: 399444496, name: "test", conclusion: "failure", steps: [{ name: "npm test", conclusion: "failure" }], log: "failed" }];
	const reviews = [{ id: 80, user: "jane", state: "APPROVED" as const, body: "Looks good" }];
	api.pulls["acme/shop"] = [{ number: 12, title: "Add the cart", branch: "arthur/12", updated: "2026-01-02T00:00:00Z", reviews, comments: [{ id: 1, user: "jane", body: "Me too" }] }];
	const get = async (path: string, method = "GET") => (await fetch(new URL(path, api.apiUrl), { method })).json();
	const routes: [string, unknown][] = [
		["workflow-run-paginated", await get("repos/acme/shop/actions/workflows/ci.yml/runs?per_page=100&exclude_pull_requests=true")],
		["job-paginated", await get("repos/acme/shop/actions/runs/30433642/attempts/2/jobs?per_page=100")],
		["pull-request-simple-items", await get("repos/acme/shop/pulls?state=all&per_page=100&page=1")],
		["pull-request", await get("repos/acme/shop/pulls/12")],
		["pull-request-review-items", await get("repos/acme/shop/pulls/12/reviews?per_page=100&page=1")],
		["issue-comment-items", await get("repos/acme/shop/issues/12/comments?per_page=100&page=1")],
		["empty-object", await get("repos/acme/shop/actions/runs/30433642/rerun", "POST")],
		["empty-object", await get("repos/acme/shop/actions/runs/30433642/cancel", "POST")],
	];
	assert.deepEqual(
		routes.flatMap(([name, got]) => (name in shapes ? drift(got, shapes[name], name) : [`${name} not recorded`])),
		[],
	);
});

test("the comparison names a key the fake leaves out, one it adds, at any depth and in any item, and takes null for any shape", () => {
	const shape = { id: null, user: { login: null }, labels: [{ name: null }], milestone: { title: null } };
	assert.deepEqual(drift({ id: 1, user: { login: "a" }, labels: [{ name: "x" }], milestone: null }, shape), []);
	assert.deepEqual(drift({ user: { login: "a", type: "User" }, labels: [{ name: "x" }, {}], milestone: {} }, shape), ["- .id", "+ .user.type", "- .labels[1].name", "- .milestone.title"]);
	assert.deepEqual(drift({ id: 1, user: { login: "a" }, labels: [{ color: "red" }], milestone: null }, { ...shape, labels: [] }), [], "an empty documented list shows no item to hold the fake's to");
});
