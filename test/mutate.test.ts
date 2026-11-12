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

// mutate with a clock that, as mutate.ts reads it, stands still: its nth read is `offsets`' nth ms past the start, the last one
// for each read after. The first read sets the deadline, each later one checks it: before a mutant, then before each tier. A
// run past 60 s is stopped (SIGTERM, no summary): a test run the deadline must cut in 2 s would else end at RUN_MS's 600 s.
function late(root: string, offsets: readonly number[], ...args: string[]) {
	const clock = join(temporaryFolder(), "clock.mjs");
	const code = `const [real, start, at] = [Date.now, Date.now(), ${JSON.stringify(offsets)}];\nlet reads = 0;\n`;
	writeFileSync(clock, `${code}Date.now = () => (new Error().stack.includes("/mutate.ts:") ? start + at[Math.min(reads++, at.length - 1)] : real());\n`);
	return spawnSync(process.execPath, ["--import", clock, MUTATE, ...args], { cwd: root, encoding: "utf8", timeout: 60_000 });
}

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

test("--max caps the mutants run and says how many were not, 100 without it; a wrong argument is the usage", () => {
	const root = repo();
	const capped = mutate(root, "--max", "2");
	assert.deepEqual([capped.stdout, capped.status], ["mutate: 2 mutants, 2 caught, 0 survived; 10 not run (--max 2)\n", 0]);
	for (const args of [["--max", "0"], ["--max", "x"], ["--max"], ["--max", "1", "2"], ["--min", "1"], ["2"]]) {
		const wrong = mutate(root, ...args);
		assert.deepEqual([wrong.stdout, wrong.stderr, wrong.status], ["", "mutate: usage: npm run mutate [-- --max <n>]\n", 2], args.join(" "));
	}
	// Without --max, the 100 the review gate needs (AR0696); the deadline at once runs none of them.
	writeFileSync(join(root, "packages/a/src/many.ts"), Array.from({ length: 15 }, (_, n) => `export const over${n} = ${n} > 3;\n`).join(""));
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "many");
	const most = late(root, [0, 1_500_000]);
	assert.deepEqual([most.stdout, most.stderr, most.status], ["mutate: 0 mutants, 0 caught, 0 survived; 100 not run (time); 3 not run (--max 100)\n", "", 0]);
	assert.equal(existsSync(join(root, "far.ran")), false);
});

test("at the deadline no mutant starts, and the summary counts those left as not run (time), before --max's", () => {
	// first.ts has no test, so a mutant of it that started would survive unseen by a test.
	const root = repo();
	writeFileSync(join(root, "first.ts"), "export const one = 1;\n");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const all = late(root, [0, 1_500_000]);
	assert.deepEqual([all.stdout, all.stderr, all.status], ["mutate: 0 mutants, 0 caught, 0 survived; 16 not run (time)\n", "", 0]);
	const capped = late(root, [0, 1_500_000], "--max", "2");
	assert.deepEqual([capped.stdout, capped.status], ["mutate: 0 mutants, 0 caught, 0 survived; 2 not run (time); 14 not run (--max 2)\n", 0]);
	const before = late(root, [0, 1_499_999, 1_500_000], "--max", "2");
	assert.deepEqual([before.stdout, before.status], ["survived: first.ts:1: hunk reverted to the base\nmutate: 1 mutants, 0 caught, 1 survived; 1 not run (time); 14 not run (--max 2)\n", 1]);
	assert.equal(existsSync(join(root, "far.ran")), false);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
});

test("a run the deadline cut goes on where it stopped on the same commit and --max, its summary counting every call; else starts over", () => {
	// first.ts has no test, so its one hunk's revert, the run's first mutant, survives; the second is caught.
	const root = repo();
	writeFileSync(join(root, "first.ts"), "export const one = 1;\n");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const progress = join(root, git(root, "rev-parse", "--git-path", "mutate-resume.json"));
	const survivor = "survived: first.ts:1: hunk reverted to the base\n";
	const none = "mutate: 0 mutants, 0 caught, 0 survived; 16 not run (time)\n";
	const cut = (...args: string[]) => late(root, [0, 1_499_999, 1_500_000], ...args);
	const clean = () => {
		assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
		assert.equal(readFileSync(join(root, "packages/a/src/limit.ts"), "utf8"), LIMIT);
	};
	const first = cut();
	assert.deepEqual([first.stdout, first.stderr, first.status], [`${survivor}mutate: 1 mutants, 0 caught, 1 survived; 15 not run (time)\n`, "", 1]);
	// A call the deadline cuts before any mutant keeps the total.
	const idle = late(root, [0, 1_500_000]);
	assert.deepEqual([idle.stdout, idle.stderr, idle.status], [`${survivor}mutate: 1 mutants, 0 caught, 1 survived; 15 not run (time)\n`, "", 1]);
	const rest = mutate(root);
	const whole = mutate(root);
	assert.match(rest.stdout, /^survived: first\.ts:1: hunk reverted to the base\n(survived: .*\n)*mutate: 16 mutants, \d+ caught, \d+ survived\n$/);
	assert.deepEqual([rest.stdout, rest.stderr, rest.status], [whole.stdout, whole.stderr, whole.status]);
	clean();
	// A run that finished leaves nothing to resume.
	assert.equal(existsSync(progress), false);
	assert.equal(late(root, [0, 1_500_000]).stdout, none);

	// --max is part of the key: a capped run goes on at its cap and keeps its count, so the gate still refuses it.
	assert.equal(cut("--max", "2").stdout, `${survivor}mutate: 1 mutants, 0 caught, 1 survived; 1 not run (time); 14 not run (--max 2)\n`);
	// One mutant left is saved too.
	assert.equal(late(root, [0, 1_500_000], "--max", "2").stdout, `${survivor}mutate: 1 mutants, 0 caught, 1 survived; 1 not run (time); 14 not run (--max 2)\n`);
	const capped = mutate(root, "--max", "2");
	assert.deepEqual([capped.stdout, capped.status], [`${survivor}mutate: 2 mutants, 1 caught, 1 survived; 14 not run (--max 2)\n`, 1]);
	cut();
	assert.equal(late(root, [0, 1_500_000], "--max", "2").stdout, "mutate: 0 mutants, 0 caught, 0 survived; 2 not run (time); 14 not run (--max 2)\n");
	clean();

	// A new commit starts over.
	cut();
	git(root, "commit", "--quiet", "--allow-empty", "-m", "empty");
	assert.equal(late(root, [0, 1_500_000]).stdout, none);
	cut();
	const key = JSON.parse(readFileSync(progress, "utf8"));
	// At the limit: every mutant tried is what a finished run counts, and nothing is left to save.
	writeFileSync(progress, JSON.stringify({ ...key, tried: 16 }));
	assert.equal(late(root, [0, 1_500_000]).stdout, `${survivor}mutate: 16 mutants, 15 caught, 1 survived\n`);
	assert.equal(existsSync(progress), false);
	// A broken or hand-edited file, or another key's, starts over.
	const other = { head: ["0".repeat(40)], base: ["0".repeat(40)], max: [2], tried: [17, -1, 1.5, "1"], survivors: ["x", [1], [survivor.trim(), survivor.trim()]] };
	const rows = [
		"{",
		"null",
		"5",
		...Object.entries(other).flatMap(([field, values]) => values.map((value) => JSON.stringify({ ...key, [field]: value }))),
	];
	for (const row of rows) {
		writeFileSync(progress, row);
		const run = late(root, [0, 1_500_000]);
		assert.deepEqual([run.stdout, run.stderr, run.status], [none, "", 0], row);
	}
	clean();
});

test("a mutant whose tests the deadline cuts is not run, not caught; its file is back and its tests stopped", async () => {
	const blocks = `${HEAD}test("blocks", async () => {\n\twriteFileSync(new URL("../../../blocked.pid", import.meta.url), String(process.pid));\n\tawait new Promise(() => setInterval(() => {}, 1000));\n});\n`;
	const root = repo({ ...TESTS, "packages/a/test/limit.test.ts": blocks });
	// The deadline 2 s away as the first mutant's same-name test starts, which blocks until it.
	const run = late(root, [0, 1_498_000]);
	assert.deepEqual([run.stdout, run.stderr, run.status], ["mutate: 0 mutants, 0 caught, 0 survived; 12 not run (time)\n", "", 0]);
	assert.equal(readFileSync(join(root, "packages/a/src/limit.ts"), "utf8"), LIMIT);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
	await until("the blocked test process gone", () => {
		try {
			process.kill(Number(readFileSync(join(root, "blocked.pid"), "utf8")), 0);
			return false;
		} catch {
			return true;
		}
	});
});

test("a deadline reached after a mutant's first tier passed starts none of its other tiers: the mutant is not run", () => {
	const root = repo({ ...TESTS, "packages/a/test/limit.test.ts": `${HEAD}test("passes", () => {});\n` });
	// Reads: the deadline, the first mutant's start, its first tier (500 s left), its second (none left).
	const run = late(root, [0, 500_000, 1_000_000, 1_500_000]);
	assert.deepEqual([run.stdout, run.stderr, run.status], ["mutate: 0 mutants, 0 caught, 0 survived; 12 not run (time)\n", "", 0]);
	assert.equal(readFileSync(join(root, "packages/a/src/limit.ts"), "utf8"), LIMIT);
});

test("a test run SIGKILLed with RUN_MS or more left, as a hang at RUN_MS is, counts as caught, not cut by the deadline", () => {
	// The same-name test kills its runner, as spawn's RUN_MS timeout does: 25 minutes before the deadline, then exactly RUN_MS.
	const root = repo({ ...TESTS, "packages/a/test/limit.test.ts": `${HEAD}test("killed", () => process.kill(process.ppid, "SIGKILL"));\n` });
	for (const run of [mutate(root, "--max", "2"), late(root, [0, 900_000], "--max", "2")])
		assert.deepEqual([run.stdout, run.stderr, run.status], ["mutate: 2 mutants, 2 caught, 0 survived; 10 not run (--max 2)\n", "", 0]);
	assert.equal(readFileSync(join(root, "packages/a/src/limit.ts"), "utf8"), LIMIT);
});

test("a capped run takes its mutants round-robin, the files' first, then each file's hunks' in turn, so it reaches every changed file", () => {
	// Package c has no tests, so each of its mutants survives and is named, in the order the run takes them.
	const root = repo({ ...TESTS, "packages/c/package.json": "{}\n", "packages/c/src/one.ts": "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n" });
	writeFileSync(join(root, "packages/c/src/one.ts"), "export const a = 10;\nexport const b = 2;\nexport const c = 3;\nexport const d = 40;\n");
	writeFileSync(join(root, "packages/c/src/two.ts"), "export const e = 5;\n");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "c");
	const run = mutate(root, "--max", "5");
	assert.equal(
		run.stdout,
		[
			"survived: packages/c/src/one.ts:1: hunk reverted to the base",
			"survived: packages/c/src/two.ts:1: hunk reverted to the base",
			"survived: packages/c/src/one.ts:4: hunk reverted to the base",
			"mutate: 5 mutants, 2 caught, 3 survived; 19 not run (--max 5)",
			"",
		].join("\n"),
	);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
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
