import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkStructure } from "./structure.ts";

// The line budget of each package: the number of lines its src/ may hold. They live here only; a raise is a decision recorded in its ticket.
// One budget per line, a blank line after each, so Git merges raises to two neighbours, or a raise and a new last one, without a conflict.
const BUDGETS = {
	core: 6377,

	"core/testing": 349,

	projects: 482,

	orchestration: 2421,

	machines: 488,

	resources: 617,

	session: 880,

	schedule: 595,

	models: 509,

	youtrack: 661,

	"commit-rules": 165,

	nvm: 96,

	telegram: 641,

	uptime: 298,

	delivery: 1631,

	github: 659,

	manage: 928,

	develop: 706,

	findings: 254,

};

const lines = (count: number) => "export const a = 1;\n".repeat(count);

// A tree that keeps every rule: the core publishes "." and "./testing", one plugin uses both.
const BASE: Readonly<Record<string, string>> = {
	"package.json": JSON.stringify({ name: "arthur", license: "Apache-2.0", devDependencies: { typescript: "^7.0.2" } }),
	"packages/core/package.json": JSON.stringify({
		name: "@arthur/core",
		license: "Apache-2.0",
		dependencies: {},
		exports: { ".": "./src/host.ts", "./testing": "./src/testing.ts" },
	}),
	"packages/core/src/host.ts": "export type Host = { name: string };\n",
	"packages/core/src/testing.ts": 'import type { Host } from "./host.ts";\nexport const fakeHost: Host = { name: "fake" };\n',
	"packages/core/test/host.test.ts": 'import { fakeHost } from "../src/testing.ts";\n',
	"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", license: "Apache-2.0" }),
	"packages/telegram/src/telegram.ts": 'import type { Host } from "@arthur/core";\nimport { readFileSync } from "node:fs";\n',
	"packages/telegram/test/telegram.test.ts": 'import { fakeHost } from "@arthur/core/testing";\nimport "../src/telegram.ts";\n',
};

function check(
	files: Readonly<Record<string, string | undefined>>,
	budgets: Readonly<Record<string, number>> = { core: 100, "core/testing": 100, telegram: 300 },
): string[] {
	const root = mkdtempSync(join(tmpdir(), "arthur-structure-test-"));
	try {
		for (const [path, text] of Object.entries({ ...BASE, ...files })) {
			if (text === undefined) continue;
			mkdirSync(dirname(join(root, path)), { recursive: true });
			writeFileSync(join(root, path), text);
		}
		return checkStructure(root, budgets);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("the repository keeps every rule", () => {
	assert.deepEqual(checkStructure(join(import.meta.dirname, ".."), BUDGETS), []);
});

// The README is a front page (AR0450, AR-D87): at most 120 lines, with one small ```mermaid block GitHub draws; the full diagram is arthur.mmd.
test("the README holds at most 120 lines and one closed mermaid flowchart of at most 40", () => {
	const readme = readFileSync(join(import.meta.dirname, "..", "README.md"), "utf8");
	assert.ok(readme.split("\n").length <= 121, "README.md holds at most 120 lines");
	const blocks = [...readme.matchAll(/^```mermaid\n([\s\S]*?)^```$/gm)].map((match) => match[1] ?? "");
	assert.equal(blocks.length, 1, "one ```mermaid block");
	assert.match(blocks[0] ?? "", /^flowchart [^`]*$/, "a flowchart, closed before any other fence");
	assert.ok((blocks[0] ?? "").split("\n").length <= 41, "at most 40 lines; the rest is arthur.mmd");
});

// A workflow grants its token only contents: read at the top level and runs each action at a commit: a tag is whatever the action's repository points it at.
test("each CI workflow, .yml or .yaml, grants only contents: read at the top level and pins every action to a commit", () => {
	const folder = join(import.meta.dirname, "..", ".github", "workflows");
	const files = readdirSync(folder).filter((name) => /\.ya?ml$/.test(name));
	assert.notDeepEqual(files, []);
	for (const name of files) {
		const text = readFileSync(join(folder, name), "utf8");
		assert.deepEqual(text.match(/^permissions:\n((?:(?:[ \t].*|#.*)?\n)*)/m)?.[1]?.split("\n").filter((line) => !/^\s*(#|$)/.test(line)), ["  contents: read"], `${name}: the top-level permissions are not exactly contents: read`);
		for (const line of text.match(/\buses:.*/g) ?? []) assert.match(line, /^uses: [^@\s]+@[0-9a-f]{40}(\s|$)/, `${name}: ${line}`);
	}
});

test("a tree that keeps every rule passes, @arthur/core/testing and a type import of the core included", () => {
	assert.deepEqual(check({}), []);
});

test("a runtime dependency in any package.json fails", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({ name: "arthur", dependencies: { leftpad: "1.0.0" } }),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", peerDependencies: { grammy: "1" } }),
			"packages/core/package.json": JSON.stringify({ name: "@arthur/core", optionalDependencies: { fsevents: "2" } }),
		}).filter((problem) => problem.includes("runtime dependency")),
		[
			"package.json: has dependencies; Arthur has no runtime dependency",
			"packages/core/package.json: has optionalDependencies; Arthur has no runtime dependency",
			"packages/telegram/package.json: has peerDependencies; Arthur has no runtime dependency",
		],
	);
});

test("a dev dependency beyond typescript and @types/node fails, in any package.json", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({
				name: "arthur",
				license: "Apache-2.0",
				devDependencies: { typescript: "^7.0.2", "@types/node": "^24.19.2", vitest: "3" },
			}),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", license: "Apache-2.0", devDependencies: { "@types/node": "24", sinon: "1" } }),
		}),
		[
			"package.json: has devDependency vitest; dev dependencies are the toolchain only (typescript, @types/node)",
			"packages/telegram/package.json: has devDependency sinon; dev dependencies are the toolchain only (typescript, @types/node)",
		],
	);
});

test("a licence other than Apache-2.0 fails, in the root and in any package.json", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({ name: "arthur", license: "MIT", devDependencies: { typescript: "^7.0.2" } }),
			"packages/core/package.json": JSON.stringify({ name: "@arthur/core", exports: { ".": "./src/host.ts", "./testing": "./src/testing.ts" } }),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", license: "SEE LICENSE IN ../../LICENSE" }),
		}),
		[
			'package.json: has license "MIT"; every Arthur package is Apache-2.0',
			"packages/core/package.json: has license null; every Arthur package is Apache-2.0",
			'packages/telegram/package.json: has license "SEE LICENSE IN ../../LICENSE"; every Arthur package is Apache-2.0',
		],
	);
});

test("an index.ts, types.ts or utils.ts fails, in src/ and test/ alike", () => {
	assert.deepEqual(
		check({
			"packages/core/src/index.ts": "",
			"packages/telegram/src/bot/types.ts": "",
			"packages/telegram/test/utils.ts": "",
		}),
		[
			"packages/core/src/index.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
			"packages/telegram/src/bot/types.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
			"packages/telegram/test/utils.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
		],
	);
});

test("a class or an enum fails, in src/ and test/ alike", () => {
	assert.deepEqual(
		check({
			"packages/telegram/src/bot.ts": "export class Bot {}\n",
			"packages/telegram/src/anonymous.ts": "export const Bot = class {};\n",
			"packages/telegram/test/fake.ts": "const enum Kind { Text }\n",
		}),
		[
			"packages/telegram/src/anonymous.ts: declares a class; Arthur uses plain functions",
			"packages/telegram/src/bot.ts: declares a class; Arthur uses plain functions",
			"packages/telegram/test/fake.ts: declares an enum; use a union type",
		],
	);
});

test("the words class, enum and an import in a comment or a string pass", () => {
	const text = [
		"// a class Bot would be wrong here, and so would enum Kind",
		'const words = "class Bot { enum Kind }";',
		"const template = `class ${words} {}`;",
		"/* import { bot } from \"@arthur/youtrack\"; */",
		'const quoted = "import \\"@arthur/youtrack\\"";',
		"const className = { class: 1, enum: 2 };",
		"",
	].join("\n");
	assert.deepEqual(check({ "packages/telegram/src/words.ts": text }), []);
});

test("a source file of exactly 200 lines passes, 201 lines fails", () => {
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(200) }), []);
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(200).trimEnd() }), []);
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(201) }), [
		"packages/telegram/src/long.ts: has 201 lines; a source file has at most 200",
	]);
});

test("a package over its line budget, or without one, fails; tests do not count", () => {
	const telegram = { "packages/telegram/src/bot.ts": lines(8), "packages/telegram/test/long.test.ts": lines(50) };
	assert.deepEqual(check(telegram, { core: 1, "core/testing": 2, telegram: 10 }), []);
	assert.deepEqual(check({ ...telegram, "packages/core/src/extra.ts": lines(2) }, { core: 2, "core/testing": 2, telegram: 9 }), [
		"packages/core: has 3 source lines, over its line budget of 2",
		"packages/telegram: has 10 source lines, over its line budget of 9",
	]);
	assert.deepEqual(check({}, { core: 3, "core/testing": 2 }), ["packages/telegram: has no line budget; add one to test/structure.test.ts"]);
});

test("the core's test kit, testing.ts and fake-agent.ts, counts against core/testing alone, and needs that budget", () => {
	const kit = { "packages/core/src/fake-agent.ts": lines(5) };
	assert.deepEqual(check(kit, { core: 1, "core/testing": 7, telegram: 300 }), []);
	assert.deepEqual(check(kit, { core: 1, "core/testing": 6, telegram: 300 }), [
		"packages/core: its test kit (src/testing.ts, src/fake-agent.ts) has 7 lines, over its line budget of 6",
	]);
	assert.deepEqual(check({ "packages/core/src/extra.ts": lines(6) }, { core: 7, "core/testing": 1, telegram: 300 }), [
		"packages/core: its test kit (src/testing.ts, src/fake-agent.ts) has 2 lines, over its line budget of 1",
	]);
	assert.deepEqual(check({}, { core: 1, telegram: 300 }), [
		"packages/core: has no line budget for its test kit; add core/testing to test/structure.test.ts",
	]);
	assert.deepEqual(check({ "packages/telegram/src/testing.ts": lines(5) }, { core: 1, "core/testing": 2, telegram: 6 }), [
		"packages/telegram: has 7 source lines, over its line budget of 6",
	]);
});

test("a plugin imports no other plugin, no core internal and no path outside its package", () => {
	const text = [
		'import { bot } from "@arthur/youtrack";',
		'import type { Issue } from "@arthur/youtrack";',
		'import type { Host } from "@arthur/core/src/host.ts";',
		'export * from "@arthur/core/testing/extra";',
		'import { host } from "../../core/src/host.ts";',
		'const lazy = await import("@arthur/schedule");',
		'import { self } from "@arthur/telegram";',
		'import { own } from "./telegram.ts";',
		"",
	].join("\n");
	assert.deepEqual(check({ "packages/telegram/src/bot.ts": text }), [
		"packages/telegram/src/bot.ts: imports @arthur/youtrack; a plugin imports no other plugin",
		"packages/telegram/src/bot.ts: imports @arthur/youtrack; a plugin imports no other plugin",
		"packages/telegram/src/bot.ts: imports @arthur/core/src/host.ts; a plugin imports only @arthur/core and its published subpaths",
		"packages/telegram/src/bot.ts: imports @arthur/core/testing/extra; a plugin imports only @arthur/core and its published subpaths",
		"packages/telegram/src/bot.ts: imports ../../core/src/host.ts, a path outside its package",
		"packages/telegram/src/bot.ts: imports @arthur/schedule; a plugin imports no other plugin",
	]);
});

test("the core imports no plugin", () => {
	const text = 'import type { Bot } from "@arthur/telegram";\nimport "../../telegram/src/telegram.ts";\n';
	assert.deepEqual(check({ "packages/core/src/run.ts": text }), [
		"packages/core/src/run.ts: imports @arthur/telegram; the core imports no plugin",
		"packages/core/src/run.ts: imports ../../telegram/src/telegram.ts, a path outside its package",
	]);
});

test("a package without a test fails", () => {
	assert.deepEqual(
		check({ "packages/telegram/test/telegram.test.ts": undefined, "packages/telegram/test/helper.ts": "" }),
		["packages/telegram: has no test; a package has at least one test/*.test.ts"],
	);
});
