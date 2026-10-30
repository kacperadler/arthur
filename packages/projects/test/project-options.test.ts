import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions, checkProjects } from "../src/project-options.ts";

const shop = { title: "Shop", prefix: "SH", path: "/srv/web-shop", about: "Online shop for garden tools." };
const docs = { prefix: "DOC", repo: "git@example.com:acme/docs.git" };

// The problems of these projects, each `[name, piece]`, its file `/p/<name>/project.config.ts` in the folder `/p/<name>`.
const written = (list: readonly (readonly [string, unknown])[]) => list.map(([name, piece]) => ({ name, file: `/p/${name}/project.config.ts`, folder: `/p/${name}`, piece }));
const problems = (list: readonly (readonly [string, unknown])[]) => checkProjects(written(list), "/srv/repos");

test("projects that keep every rule pass: path and repo projects, every optional key, a path counted from the folder", () => {
	const full = { ...shop, install: "", prompts: { vision: "docs/vision.md", criteriaDir: "criteria", rolesDir: "./roles" } };
	assert.deepEqual(problems([["web-shop", full], ["docs", docs], ["api.v2", { prefix: "API", path: "../api" }]]), []);
	assert.deepEqual(checkProjects(written([["web-shop", shop]]), undefined), [], "reposDir is needed only by a repo");
});

test("an about of exactly 300 characters and a title of 60 pass; one more, or a line break, is refused, naming the file", () => {
	assert.deepEqual(problems([["web-shop", { ...shop, about: "a".repeat(300), title: "t".repeat(60) }]]), []);
	assert.deepEqual(problems([["web-shop", { ...shop, about: "a".repeat(301) }]]), [`/p/web-shop/project.config.ts: projects.project(...).about: expected one line of 1 to 300 characters, got "${"a".repeat(301)}"`]);
	assert.deepEqual(problems([["web-shop", { ...shop, about: "One.\nTwo." }]]), ['/p/web-shop/project.config.ts: projects.project(...).about: expected one line of 1 to 300 characters, got "One.\\nTwo."']);
	assert.deepEqual(problems([["web-shop", { ...shop, title: "t".repeat(61) }]]), [`/p/web-shop/project.config.ts: projects.project(...).title: expected one line of 1 to 60 characters, got "${"t".repeat(61)}"`]);
});

test("a missing prefix, a bad one, both or neither of path and repo, a repo without reposDir and a piece that is no object are refused", () => {
	assert.deepEqual(problems([["a", { path: "/srv/a" }]]), ["/p/a/project.config.ts: projects.project(...).prefix: prefix is required"]);
	for (const prefix of ["sh", "S1", "", "S-H"]) assert.match(problems([["web-shop", { ...shop, prefix }]])[0] ?? "", /^\/p\/web-shop\/project\.config\.ts: projects\.project\(\.\.\.\)\.prefix: expected capital letters A-Z/, prefix);
	assert.deepEqual(problems([["a", { prefix: "A" }]]), ["/p/a/project.config.ts: projects.project(...): expected exactly one of path and repo"]);
	assert.deepEqual(problems([["docs", { ...docs, path: "/srv/docs" }]]), ["/p/docs/project.config.ts: projects.project(...): expected exactly one of path and repo"]);
	assert.deepEqual(checkProjects(written([["docs", docs]]), undefined), ["/p/docs/project.config.ts: projects.project(...).repo: a repo is cloned into reposDir, which is not set"]);
	assert.deepEqual(problems([["a", "SH"]]), ['/p/a/project.config.ts: projects.project(...): expected { prefix, path or repo, ... }, got "SH"']);
});

test("two projects sharing a name, prefix or title, without case and across the three keys, are refused", () => {
	const other = { prefix: "OT", path: "/srv/other" };
	const same = (key: string, word: string, first: string) => `/p/other/project.config.ts: projects.project(...)${key === "name" ? "" : `.${key}`}: its ${key} "${word}" is ${first}; names, prefixes and titles are compared without case`;
	assert.deepEqual(problems([["web-shop", shop], ["other", { ...other, prefix: "SH" }]]), [same("prefix", "sh", "the prefix of project web-shop")]);
	assert.deepEqual(problems([["web-shop", shop], ["other", { ...other, title: "SHOP" }]]), [same("title", "shop", "the title of project web-shop")]);
	assert.deepEqual(problems([["ka", other], ["other", { ...other, path: "/srv/b", prefix: "KA" }]]), [same("prefix", "ka", "the name of project ka")]);
	assert.deepEqual(problems([["web-shop", { ...shop, prefix: "OTHER" }], ["other", { ...other }]]), [same("name", "other", "the prefix of project web-shop")]);
	assert.deepEqual(problems([["shop", { ...other, title: "Shop" }]]), [], "a project's own name and title may be one word");
});

test("two projects with one checkout are refused: the same path, from each folder, or a path where a repo is cloned", () => {
	assert.deepEqual(problems([["web-shop", shop], ["b", { prefix: "B", path: "/srv/web-shop/" }]]), ["/p/b/project.config.ts: projects.project(...): its checkout /srv/web-shop is the checkout of project web-shop"]);
	assert.deepEqual(problems([["docs", docs], ["b", { prefix: "B", path: "/srv/repos/docs" }]]), ["/p/b/project.config.ts: projects.project(...): its checkout /srv/repos/docs is the checkout of project docs"]);
	assert.deepEqual(problems([["a", { prefix: "A", path: "../shop" }], ["b", { prefix: "B", path: "../../p/shop" }]]), ["/p/b/project.config.ts: projects.project(...): its checkout /p/shop is the checkout of project a"]);
});

test("a key that moved to its plugin's piece, or any other unknown key, is refused", () => {
	for (const key of ["name", "tracker", "ci", "commitRules", "autoMerge", "requires", "docker", "pathPrepend"])
		assert.deepEqual(problems([["web-shop", { ...shop, [key]: true }]]), [`/p/web-shop/project.config.ts: projects.project(...).${key}: unknown key; keys: prefix, path, repo, title, about, install, prompts`]);
});

test("a wrong install, and prompts that are not paths inside the project's folder, are refused", () => {
	for (const [key, value] of [
		["install", false],
		["install", ["npm", "ci"]],
		["prompts", "spec"],
		["prompts", { vision: "/etc/passwd" }],
		["prompts", { criteriaDir: "../other/criteria" }],
		["prompts", { rolesDir: "a/../../b" }],
		["prompts", { vision: "" }],
		["prompts", { overrides: "x" }],
	] as const) {
		const [first, ...rest] = problems([["web-shop", { ...shop, [key]: value }]]);
		assert.match(first ?? "", new RegExp(`^/p/web-shop/project\\.config\\.ts: projects\\.project\\(\\.\\.\\.\\)\\.${key}: expected `), `${key}: ${JSON.stringify(value)}`);
		assert.deepEqual(rest, []);
	}
});

test("the options: folders, each named as a project and once; reposDir a folder; the old list refused as unknown", () => {
	const paths = (options: Readonly<Record<string, unknown>>) => checkOptions(options).map(({ path, problem }) => `${path}: ${problem}`);
	assert.deepEqual(paths({ folders: ["projects/web-shop", "/srv/projects/api.v2"], reposDir: "/srv/repos" }), []);
	assert.deepEqual(paths({ folders: [] }), ["folders: expected a list of at least one folder, each a non-empty string, got an empty list"]);
	assert.deepEqual(paths({}), ["folders: expected a list of at least one folder, each a non-empty string, got nothing"]);
	assert.deepEqual(paths({ folders: ["a", ""] }), ["folders: expected a list of at least one folder, each a non-empty string, got a list"]);
	assert.deepEqual(paths({ folders: ["projects/Shop"] }), ['folders[0]: the folder\'s name "Shop" is the project\'s name: lowercase letters, digits, dots and dashes, from a letter or digit']);
	assert.deepEqual(paths({ folders: ["a/shop", "b/shop/"] }), ["folders[1]: a second folder named shop, as folders[0]; the folder's name is the project's name"]);
	assert.deepEqual(paths({ folders: ["shop"], reposDir: "" }), ['reposDir: expected a folder, got ""']);
	assert.deepEqual(paths({ folders: ["shop"], list: [{ name: "shop", prefix: "SH", path: "." }] }), ["list: unknown option; options: folders, reposDir"]);
});
