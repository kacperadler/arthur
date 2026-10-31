import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";

// AR0579: `npm run mutate` names the mutants of the branch's change that no test catches.

const MUTATE = join(import.meta.dirname, "mutate.ts");
const LIMIT = "export function over(n: number): boolean {\n\treturn n > 3;\n}\nexport function under(n: number): boolean {\n\treturn n < 10;\n}\nexport const most = 5;\n";
const HEAD = 'import assert from "node:assert/strict";\nimport { appendFileSync, writeFileSync } from "node:fs";\nimport { test } from "node:test";\n';
// Package a's tests: its same-name test, one more that imports limit.ts, one that reaches it only through a helper and marks
// each run in `far.ran`; package b's test fails on any run, so a mutant of a caught by b's tests would hide a survivor.
const TESTS = {
	"packages/a/test/limit.test.ts": `${HEAD}import { over, under } from "../src/limit.ts";\ntest("over and under", () => {\n\tassert.equal(over(4), true);\n\tassert.equal(over(3), false);\n\tassert.equal(under(5), true);\n});\n`,
	"packages/a/test/other.test.ts": `${HEAD}import { under } from "../src/limit.ts";\ntest("10 is not under", () => assert.equal(under(10), false));\n`,
	"packages/a/test/helper.ts": 'export { under } from "../src/limit.ts";\n',
	"packages/a/test/far.test.ts": `${HEAD}import { under } from "./helper.ts";\ntest("9 is under", () => {\n\tappendFileSync(new URL("../../../far.ran", import.meta.url), "x");\n\tassert.equal(under(9), true);\n});\n`,
	"packages/b/package.json": "{}\n",
	"packages/b/test/b.test.ts": `${HEAD}test("b", () => assert.fail("package b's tests run only for package b"));\n`,
};

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const mutate = (root: string, ...args: string[]) => spawnSync(process.execPath, [MUTATE, ...args], { cwd: root, encoding: "utf8" });

// A repository whose main holds the tests, a first limit.ts and notes.ts, and whose branch `work`, checked out, changes
// limit.ts to LIMIT, adds only a comment and a type to notes.ts, and adds a line to a test file: no mutant of either.
function repo(tests: Readonly<Record<string, string>> = TESTS): string {
	const root = temporaryFolder();
	const files = { "package.json": '{ "type": "module" }\n', "packages/a/package.json": "{}\n", "packages/a/src/limit.ts": "export const unit = 1;\n", "packages/a/src/notes.ts": "export const note = 1;\n", ...tests };
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "main");
	git(root, "checkout", "--quiet", "-b", "work");
	writeFileSync(join(root, "packages/a/src/limit.ts"), LIMIT);
	writeFileSync(join(root, "packages/a/src/notes.ts"), "// A note.\nexport type Note = number;\nexport const note = 1;\n");
	appendFileSync(join(root, "packages/b/test/b.test.ts"), "export const touched = 1;\n");
	git(root, "commit", "--quiet", "-am", "limit");
	return root;
}

test("a mutant no test catches is named, a caught one is not; the tests run tier by tier in the file's package; the file is back after", () => {
	const root = repo();
	writeFileSync(join(root, "notes.txt"), "an untracked file is no change\n");
	const run = mutate(root);
	assert.equal(run.stderr, "");
	assert.equal(
		run.stdout,
		[
			"survived: packages/a/src/limit.ts:7: export const most = 5; => (deleted)",
			"survived: packages/a/src/limit.ts:7: export const most = 5; => export const most = 6;",
			"survived: packages/a/src/limit.ts:7: export const most = 5; => export const most = 4;",
			"mutate: 12 mutants, 9 caught, 3 survived",
			"",
		].join("\n"),
	);
	assert.equal(run.status, 1);
	// far.test.ts ran only where limit.test.ts and other.test.ts both passed: `under`'s 10 made 9, and the three survivors.
	assert.equal(readFileSync(join(root, "far.ran"), "utf8"), "xxxx");
	assert.equal(readFileSync(join(root, "packages/a/src/limit.ts"), "utf8"), LIMIT);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
});

test("--max caps the mutants run and says how many were not; a wrong argument is the usage", () => {
	const root = repo();
	const capped = mutate(root, "--max", "2");
	assert.deepEqual([capped.stdout, capped.status], ["mutate: 2 mutants, 2 caught, 0 survived; 10 not run (--max 2)\n", 0]);
	for (const args of [["--max", "0"], ["--max", "x"], ["--max"], ["--max", "1", "2"], ["--min", "1"], ["2"]]) {
		const wrong = mutate(root, ...args);
		assert.deepEqual([wrong.stdout, wrong.stderr, wrong.status], ["", "mutate: usage: npm run mutate [-- --max <n>]\n", 2], args.join(" "));
	}
	assert.equal(existsSync(join(root, "far.ran")), false);
});

test("a signal mid-run writes the file's bytes back and stops the running tests", async () => {
	const blocks = `${HEAD}test("blocks", async () => {\n\twriteFileSync(new URL("../../../blocked.pid", import.meta.url), String(process.pid));\n\tawait new Promise(() => setInterval(() => {}, 1000));\n});\n`;
	const root = repo({ ...TESTS, "packages/a/test/limit.test.ts": blocks });
	const [file, pid] = [join(root, "packages/a/src/limit.ts"), join(root, "blocked.pid")];
	const child = spawn(process.execPath, [MUTATE], { cwd: root, stdio: "ignore" });
	const exited = once(child, "exit");
	await until("the first mutant written and its test running", () => existsSync(pid) && readFileSync(file, "utf8") === "export const unit = 1;\n");
	child.kill("SIGTERM");
	assert.deepEqual(await exited, [143, null]);
	assert.equal(readFileSync(file, "utf8"), LIMIT);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
	await until("the blocked test process gone", () => {
		try {
			process.kill(Number(readFileSync(pid, "utf8")), 0);
			return false;
		} catch {
			return true;
		}
	});
});

test("a tree with an uncommitted change to a tracked file, staged or not, is refused and left as it is", () => {
	const root = repo();
	const file = join(root, "packages/a/src/limit.ts");
	appendFileSync(file, "// unsaved\n");
	for (const stage of [false, true]) {
		if (stage) git(root, "add", "--all");
		const run = mutate(root);
		assert.deepEqual([run.stdout, run.stderr, run.status], ["", "mutate: refused: the tree has uncommitted changes to tracked files; commit them first\n", 2]);
		assert.equal(readFileSync(file, "utf8"), `${LIMIT}// unsaved\n`);
	}
	assert.equal(existsSync(join(root, "far.ran")), false);
});
