import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";

const REPORTER = join(import.meta.dirname, "github-annotations.ts");

const FIXTURE = `import assert from "node:assert/strict";
import { before, describe, it, test } from "node:test";
test("passes", () => {});
test("a, b: 100%", () => assert.equal(1, 2));
test("parent", async (t) => {
	await t.test("child", () => {
		throw new Error(Array.from({ length: 10 }, (_, i) => \`line \${i + 1}\`).join("\\n"));
	});
});
describe("hooked", () => {
	before(() => {
		throw new Error("no setup");
	});
	it("waits", () => {});
});
test("throws a string", () => {
	throw "plain";
});
`;

// node --test in a folder of its own with the reporter alone; NODE_TEST_CONTEXT would make it this run's child, and NODE_OPTIONS
// carries the ci workflow's own reporters.
function annotate(files: Readonly<Record<string, string>>): { status: number | null; stdout: string } {
	const folder = temporaryFolder();
	for (const [name, text] of Object.entries(files)) writeFileSync(join(folder, name), text);
	const { NODE_TEST_CONTEXT: _, NODE_OPTIONS: __, ...env } = process.env;
	const args = ["--test", `--test-reporter=${REPORTER}`, "--test-reporter-destination=stdout", ...Object.keys(files)];
	return spawnSync(process.execPath, args, { cwd: folder, env, encoding: "utf8" });
}

test("each failed test is one ::error line with its file, line, escaped name and the first 8 lines of its error; echoes of it are left out", () => {
	const run = annotate({ "fixture.test.mjs": FIXTURE });
	assert.equal(run.status, 1);
	assert.deepEqual(run.stdout.split("\n"), [
		"::error file=fixture.test.mjs,line=4,title=a%2C b%3A 100%25::AssertionError: Expected values to be strictly equal:%0A1 !== 2",
		"::error file=fixture.test.mjs,line=6,title=child::Error: line 1%0Aline 2%0Aline 3%0Aline 4%0Aline 5%0Aline 6%0Aline 7%0Aline 8",
		"::error file=fixture.test.mjs,line=10,title=hooked::Error: no setup",
		"::error file=fixture.test.mjs,line=16,title=throws a string::plain",
		"",
	]);
});

test("a file that fails outside its tests is named by its path; a passing run prints nothing", () => {
	const passing = `import { test } from "node:test";\ntest("ok", () => {});\n`;
	const run = annotate({ "a.test.mjs": `import "node:test";\nthrow new Error("top level");\n`, "b.test.mjs": passing });
	assert.deepEqual([run.status, run.stdout], [1, "::error file=a.test.mjs,line=1,title=a.test.mjs::test failed\n"]);
	const green = annotate({ "b.test.mjs": passing });
	assert.deepEqual([green.status, green.stdout], [0, ""]);
});
