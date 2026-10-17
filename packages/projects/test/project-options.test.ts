import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { checkOptions } from "../src/project-options.ts";

const shop = { name: "web-shop", title: "Shop", prefix: "SH", path: "/srv/web-shop", about: "Online shop for garden tools." };
const docs = { name: "docs", prefix: "DOC", repo: "git@example.com:acme/docs.git" };

// The problems of a list of these projects, as `path: problem` lines.
const problems = (list: readonly unknown[], extra: Readonly<Record<string, unknown>> = { reposDir: "/srv/repos" }) =>
	checkOptions({ list, ...extra }).map(({ path, problem }) => `${path}: ${problem}`);

test("a list that keeps every rule passes: path and repo projects, every optional key", () => {
	const full = {
		...shop,
		install: "",
		tracker: { plugin: "youtrack", instance: "main", project: "SHOP" },
		ci: { workflow: "Linux" },
		commitRules: { regex: "^feat" },
		autoMerge: true,
		requires: { os: "linux", arch: "x64", tools: ["docker"] },
		docker: false,
	};
	assert.deepEqual(problems([full, docs, { name: "api.v2", prefix: "API", path: "../api" }]), []);
	assert.deepEqual(problems([shop], {}), [], "reposDir is needed only by a repo");
});

test("an about of exactly 300 characters and a title of 60 pass; one more, or a line break, is refused", () => {
	assert.deepEqual(problems([{ ...shop, about: "a".repeat(300), title: "t".repeat(60) }]), []);
	assert.deepEqual(problems([{ ...shop, about: "a".repeat(301) }]), ['list[0].about: project web-shop: expected one line of 1 to 300 characters, got "' + "a".repeat(301) + '"']);
	assert.deepEqual(problems([{ ...shop, about: "One.\nTwo." }]), ['list[0].about: project web-shop: expected one line of 1 to 300 characters, got "One.\\nTwo."']);
	assert.deepEqual(problems([{ ...shop, title: "t".repeat(61) }]), [`list[0].title: project web-shop: expected one line of 1 to 60 characters, got "${"t".repeat(61)}"`]);
});

test("a missing name or prefix, and both or neither of path and repo, are refused, naming the project", () => {
	assert.deepEqual(problems([{ prefix: "SH", path: "/srv/a" }]), ["list[0].name: a project without a name: name is required"]);
	assert.deepEqual(problems([{ name: "a", path: "/srv/a" }]), ["list[0].prefix: project a: prefix is required"]);
	assert.deepEqual(problems([{ name: "a", prefix: "A" }]), ["list[0]: project a: expected exactly one of path and repo"]);
	assert.deepEqual(problems([{ ...docs, path: "/srv/docs" }]), ["list[0]: project docs: expected exactly one of path and repo"]);
});

test("a bad name or prefix is refused", () => {
	for (const name of ["Shop", "-shop", ".", "a/b", "a b", ""])
		assert.match(problems([{ ...shop, name }])[0] ?? "", /^list\[0\]\.name: .*expected lowercase letters, digits, dots and dashes/, name);
	for (const prefix of ["sh", "S1", "", "S-H"]) assert.match(problems([{ ...shop, prefix }])[0] ?? "", /^list\[0\]\.prefix: project web-shop: expected capital letters A-Z/, prefix);
});

test("two projects sharing a name, prefix or title, without case and across the three keys, are refused", () => {
	const other = { name: "other", prefix: "OT", path: "/srv/other" };
	assert.deepEqual(problems([shop, { ...other, name: "web-shop" }]), [
		'list[1].name: project web-shop: its name "web-shop" is the name of project web-shop; names, prefixes and titles are compared without case',
	]);
	assert.deepEqual(problems([shop, { ...other, prefix: "SH" }]), [
		'list[1].prefix: project other: its prefix "sh" is the prefix of project web-shop; names, prefixes and titles are compared without case',
	]);
	assert.deepEqual(problems([shop, { ...other, title: "SHOP" }]), [
		'list[1].title: project other: its title "shop" is the title of project web-shop; names, prefixes and titles are compared without case',
	]);
	assert.deepEqual(problems([{ ...other, name: "ka" }, { ...shop, prefix: "KA" }]), [
		'list[1].prefix: project web-shop: its prefix "ka" is the name of project ka; names, prefixes and titles are compared without case',
	]);
	assert.deepEqual(problems([{ ...other, name: "shop", title: "Shop" }]), [], "a project's own name and title may be one word");
});

test("two projects with one folder are refused: the same path, or a path where a repo is cloned", () => {
	assert.deepEqual(problems([shop, { name: "b", prefix: "B", path: "/srv/web-shop/" }]), ["list[1]: project b: its folder /srv/web-shop is the folder of project web-shop"]);
	assert.deepEqual(problems([docs, { name: "b", prefix: "B", path: "/srv/repos/docs" }]), ["list[1]: project b: its folder /srv/repos/docs is the folder of project docs"]);
	assert.deepEqual(problems([shop, { name: "b", prefix: "B", path: resolve("rel") }, { name: "c", prefix: "C", path: "rel" }]), [
		`list[2]: project c: its folder ${resolve("rel")} is the folder of project b`,
	]);
});

test("an unknown key is refused, pathPrepend and prompts among them", () => {
	for (const key of ["pathPrepend", "prompts", "branch"])
		assert.deepEqual(problems([{ ...shop, [key]: ["/opt/bin"] }]), [
			`list[0].${key}: project web-shop: unknown key; keys: name, prefix, path, repo, title, about, install, tracker, ci, commitRules, autoMerge, requires, docker`,
		]);
	assert.deepEqual(problems([shop], { aliases: {} }), ["aliases: unknown option; options: list, reposDir"]);
});

test("a wrong shape for each key a later plugin reads is refused", () => {
	const wrong: Readonly<Record<string, readonly unknown[]>> = {
		tracker: ["youtrack", { plugin: "youtrack" }, { plugin: "youtrack", project: "S", extra: 1 }, { plugin: "", project: "S" }],
		ci: ["Linux", {}, { workflow: 1 }],
		commitRules: [{}, { regex: "^a", words: "b" }, { regex: "" }, { format: "x" }, "^a"],
		autoMerge: ["yes", 1],
		requires: ["linux", { tools: "docker" }, { os: 1 }, { gpu: true }],
		docker: ["no"],
		install: [false, ["npm", "ci"]],
	};
	for (const [key, values] of Object.entries(wrong))
		for (const value of values) {
			const [first, ...rest] = problems([{ ...shop, [key]: value }]);
			assert.match(first ?? "", new RegExp(`^list\\[0\\]\\.${key}: project web-shop: expected `), `${key}: ${JSON.stringify(value)}`);
			assert.deepEqual(rest, []);
		}
});

test("no list, an empty one, a non-object entry, a repo without reposDir, and a bad reposDir are refused", () => {
	assert.deepEqual(problems([]), ["list: expected a list of at least one project, got an empty list"]);
	assert.deepEqual(checkOptions({}).map((each) => each.path), ["list"]);
	assert.deepEqual(problems(["web-shop"]), ['list[0]: expected a project { name, prefix, path or repo, ... }, got "web-shop"']);
	assert.deepEqual(problems([docs], {}), ["list[0].repo: project docs: a repo is cloned into reposDir, which is not set"]);
	assert.deepEqual(problems([shop], { reposDir: "" }), ['reposDir: expected a folder, got ""']);
});
