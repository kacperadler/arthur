import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

// `npm run mutate [-- --max <n>]` (AR0579): which tests do not catch a change to the branch's own code. For each source file
// (`*.ts`, not `*.test.ts`) the diff from `git merge-base main HEAD` to HEAD changes, it writes one mutant at a time over the
// file and runs its tests: its same-name test, then the tests that import it, then the rest of its package's `test/`, each
// only while the last passed. A mutant all of them pass survives and is named; a caught one is not. The file's bytes, kept in
// memory, are written back after each mutant, at exit and on SIGINT, SIGTERM or SIGHUP; a tree with an uncommitted change to a
// tracked file is refused, so `git checkout -- .` undoes even a SIGKILL. Exit 0 with no survivor, 1 with one, 2 when refused.

type Mutant = { readonly file: string; readonly line: number; readonly what: string; readonly text: string };
// A test run of one mutant that lasts longer is killed, its process group with it, and counts as caught: a mutant that hangs.
const RUN_MS = 600_000;
const KIT = import.meta.resolve("@arthur/core/testing");
const FLIPS: Readonly<Record<string, string>> = { "===": "!==", "!==": "===", "<": "<=", "<=": "<", ">": ">=", ">=": ">" };
// Where an operand of `&&` or `||` ends, at its depth: another operator of lower or equal precedence, an assignment or `return`.
const STOP = /&&|\|\||\?\?|=>|\?(?![.?])|[:,;]|(?<![=!<>])=(?![=>])|\breturn\b/y;
const ARRAY = /(?<=(?:^|[=(,[?{|&]|\breturn)\s*)\[/g;
const REGEX = /(?<=(?:^|[=(,:!&|?{};]|\breturn)\s*)\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\[])+\/[dgimsuvy]*/g;
// A trimmed line no mutant of which changes what runs: blank, a comment, an import, a type or interface, a type's member.
const INERT = /^(\/\/|\/?\*|import\b|(export\s+)?(type|interface)\b|(readonly\s+)?[\w$]+\??: [^=(]*;$|$)/;

let kept: { readonly path: string; readonly bytes: Buffer } | undefined;
let running: number | undefined;

process.on("exit", () => {
	stopGroup(running);
	if (kept !== undefined) writeFileSync(kept.path, kept.bytes);
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => process.exit(128 + constants.signals[signal]));

const git = (cwd: string, ...words: string[]) => {
	const run = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-C", cwd, ...words], { encoding: "utf8" });
	if (run.status !== 0) refuse(`git ${words.join(" ")}: ${run.stderr.trim()}`);
	return run.stdout;
};

function refuse(why: string): never {
	console.error(`mutate: ${why}`);
	process.exit(2);
}

const args = process.argv.slice(2);
const max = args.length === 0 ? 25 : args.length === 2 && args[0] === "--max" && /^[1-9]\d*$/.test(args[1] ?? "") ? Number(args[1]) : refuse("usage: npm run mutate [-- --max <n>]");
const root = git(process.cwd(), "rev-parse", "--show-toplevel").trim();
if (git(root, "status", "--porcelain", "--untracked-files=no") !== "") refuse("refused: the tree has uncommitted changes to tracked files; commit them first");
const base = git(root, "merge-base", "main", "HEAD").trim();
const files = git(root, "diff", "--name-only", "--diff-filter=d", base, "HEAD", "--", "*.ts").split("\n").filter((file) => file !== "" && !/\.(test|d)\.ts$/.test(file));
const changes = files.map((file) => ({ file, lines: readFileSync(join(root, file), "utf8").split("\n"), hunks: hunks(git(root, "diff", "--unified=0", "--no-color", base, "HEAD", "--", file)) }));
const mutants = [
	...changes.flatMap(({ file, lines, hunks }) => hunks.filter(({ at, size, old }) => [...lines.slice(at, at + size), ...old].some((line) => !INERT.test(line.trim()))).map(({ at, size, old }): Mutant => ({ file, line: at + 1, what: "hunk reverted to the base", text: [...lines.slice(0, at), ...old, ...lines.slice(at + size)].join("\n") }))),
	...changes.flatMap(({ file, lines, hunks }) =>
		hunks.flatMap(({ at, size }) => lines.slice(at, at + size).flatMap((line, index) => lineMutants(line).map((mutated): Mutant => ({ file, line: at + index + 1, what: `${line.trim()} => ${mutated.trim() || "(deleted)"}`, text: [...lines.slice(0, at + index), mutated, ...lines.slice(at + index + 1)].join("\n") })))),
	),
];
const run = mutants.slice(0, max);
let survived = 0;
for (const mutant of run) {
	if (await killed(mutant)) continue;
	survived++;
	console.log(`survived: ${mutant.file}:${mutant.line}: ${mutant.what}`);
}
console.log(`mutate: ${run.length} mutants, ${run.length - survived} caught, ${survived} survived${mutants.length > max ? `; ${mutants.length - max} not run (--max ${max})` : ""}`);
process.exitCode = survived > 0 ? 1 : 0;

// The hunks of a `git diff --unified=0`: where each starts in the tip's lines, how many it holds there, and the base's lines.
function hunks(diff: string): { readonly at: number; readonly size: number; readonly old: readonly string[] }[] {
	return diff.split(/^(?=@@ )/m).slice(1).map((hunk) => {
		const [, start = "0", count = "1"] = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(hunk) ?? [];
		const size = Number(count);
		const old = hunk.split("\n").filter((line) => line.startsWith("-")).map((line) => line.slice(1));
		return { at: size === 0 ? Number(start) : Number(start) - 1, size, old };
	});
}

// Each mutant of one line, the code before a `//` comment only: the line deleted when it ends a statement or a list item; one
// `===`/`!==`, `<`/`<=` or `>`/`>=` flipped; a number +-1; `true`/`false`; `.some`/`.every`; one `&&`/`||` operand dropped;
// one array element, regex alternative or character class member dropped. Imports and type declarations have none.
function lineMutants(line: string): string[] {
	if (INERT.test(line.trim())) return [];
	const code = line.replace(/\s+\/\/.*$/, "");
	const out: string[] = [];
	const put = (start: number, end: number, by: string) => out.push(`${code.slice(0, start)}${by}${code.slice(end)}${line.slice(code.length)}`);
	if (/[;,]$/.test(code) && split(code, -1, "", false) !== undefined) out.push("");
	for (const m of code.matchAll(/ (===|!==|<=|>=|<|>) /g)) put(m.index + 1, m.index + 1 + (m[1] ?? "").length, FLIPS[m[1] ?? ""] ?? "");
	for (const m of code.matchAll(/(?<![\w$.])\d+(?![\w.])/g)) for (const step of [1, -1]) put(m.index, m.index + m[0].length, String(Number(m[0]) + step));
	for (const m of code.matchAll(/\b(true|false)\b/g)) put(m.index, m.index + m[0].length, m[0] === "true" ? "false" : "true");
	for (const m of code.matchAll(/\.(some|every)\(/g)) put(m.index, m.index + m[0].length, m[1] === "some" ? ".every(" : ".some(");
	for (const m of code.matchAll(/ (&&|\|\|) /g)) {
		put(m.index, edge(code, m.index + 4, 1), "");
		put(edge(code, m.index - 1, -1), m.index + 4, "");
	}
	for (const m of code.matchAll(ARRAY)) for (const dropped of drops(code, split(code, m.index, ",", false))) out.push(`${dropped}${line.slice(code.length)}`);
	for (const m of code.matchAll(REGEX)) {
		const body = m[0].slice(1, m[0].lastIndexOf("/"));
		const groups = [-1, ...Array.from(body.matchAll(/(?<!\\)\(/g), (group) => group.index)];
		const bodies = [...groups.flatMap((open) => drops(body, split(body, open, "|", true))), ...Array.from(body.matchAll(/(?<!\\)\[\^?((?:\\.|[^\]\\])+)\]/g)).flatMap((klass) => members(body, klass))];
		for (const each of bodies) put(m.index + 1, m.index + 1 + body.length, each);
	}
	return out;
}

// The end of the operand that starts at `from` going right (`step` 1), or the start of the one that ends there going left.
function edge(code: string, from: number, step: 1 | -1): number {
	let [depth, i] = [0, from];
	for (; i >= 0 && i < code.length; i += step) {
		depth += "([{".includes(code[i] ?? "") ? step : ")]}".includes(code[i] ?? "") ? -step : 0;
		STOP.lastIndex = i;
		if (depth < 0 || (depth === 0 && STOP.test(code))) break;
	}
	if (step > 0) return code.slice(0, i).trimEnd().length;
	const start = i < 0 ? 0 : depth < 0 ? i + 1 : STOP.lastIndex;
	return code.length - code.slice(start).trimStart().length;
}

// The parts of the list that opens at `open` (all of `text` when -1) up to its closing bracket, split at `sep` at its depth,
// each as [start, end); undefined when it does not close. In a regex escapes and character classes are skipped and only `(`
// nests, and a group's `?:`, `?=`, `?!`, `?<=`, `?<!` or `?<name>` is no part; in code a string is skipped.
function split(text: string, open: number, sep: string, regex: boolean): [number, number][] | undefined {
	const parts: [number, number][] = [];
	let [depth, start] = [0, open + 1 + (regex && open >= 0 ? (/^\?(?:[:=!]|<[=!]|<\w+>)/.exec(text.slice(open + 1))?.[0].length ?? 0) : 0)];
	for (let i = start; i < text.length; i++) {
		const c = text[i] ?? "";
		if (c === "\\") i++;
		else if (regex && c === "[") i = text.indexOf("]", i + 2);
		else if (!regex && "\"'`".includes(c)) i = text.indexOf(c, i + 1);
		else if ((regex ? "(" : "([{").includes(c)) depth++;
		else if ((regex ? ")" : ")]}").includes(c) && depth-- === 0) return open < 0 ? undefined : [...parts, [start, i]];
		else if (c === sep && depth === 0) {
			parts.push([start, i]);
			start = i + 1;
		}
		if (i < 0) return undefined;
	}
	return open < 0 && depth === 0 ? [...parts, [start, text.length]] : undefined;
}

// `text` without one of its parts each, a separator beside it gone too; nothing when fewer than two parts hold anything.
function drops(text: string, parts: [number, number][] | undefined): string[] {
	const full = (parts ?? []).filter(([start, end]) => text.slice(start, end).trim() !== "");
	if (full.length < 2) return [];
	return full.map(([start, end], k) => (k < full.length - 1 ? `${text.slice(0, start)}${text.slice(full[k + 1]?.[0]).trimStart()}` : `${text.slice(0, full[k - 1]?.[1])}${text.slice(end)}`));
}

// A regex body without one member of its character class `klass` each (a character, an escape or a range).
function members(body: string, klass: RegExpExecArray): string[] {
	const inner = klass[1] ?? "";
	const from = klass.index + klass[0].indexOf(inner);
	const each = Array.from(inner.matchAll(/(?:\\.|[^\\])(?:-(?:\\.|[^\\]))?/g));
	if (each.length < 2) return [];
	return each.map((member) => `${body.slice(0, from + member.index)}${body.slice(from + member.index + member[0].length)}`);
}

// Caught: a test run the mutant written over its file fails, tier by tier; the file's own bytes are back after it.
async function killed(mutant: Mutant): Promise<boolean> {
	const [path, bytes] = [join(root, mutant.file), readFileSync(join(root, mutant.file))];
	kept = { path, bytes };
	writeFileSync(path, mutant.text);
	try {
		for (const tier of tiers(mutant.file)) if (!(await passes(tier))) return true;
		return false;
	} finally {
		writeFileSync(path, bytes);
		kept = undefined;
	}
}

// The test files of `file`'s package (the closest folder up with a package.json; the root's at the top): its same-name test,
// then those that import it by a relative path, then the rest of the package's `test/`; each tier that holds any.
function tiers(file: string): string[][] {
	let pkg = dirname(file);
	while (pkg !== "." && !existsSync(join(root, pkg, "package.json"))) pkg = dirname(pkg);
	const tests = existsSync(join(root, pkg, "test")) ? readdirSync(join(root, pkg, "test"), { recursive: true, encoding: "utf8" }).filter((path) => path.endsWith(".test.ts")).map((path) => join(pkg, "test", path)) : [];
	const same = tests.filter((test) => basename(test) === basename(file).replace(/\.ts$/, ".test.ts"));
	const importers = tests.filter((test) => !same.includes(test) && Array.from(readFileSync(join(root, test), "utf8").matchAll(/(?:\bfrom\s+|\bimport\(\s*)["'](\.\.?\/[^"']+)["']/g), (m) => resolve(root, dirname(test), m[1] ?? "")).includes(resolve(root, file)));
	return [same, importers, tests.filter((test) => !same.includes(test) && !importers.includes(test))].filter((tier) => tier.length > 0);
}

// Whether node --test passes on `tests` with the core's test kit, in a process group of its own, killed as the run ends; never
// as the child of a node --test that runs this (NODE_TEST_CONTEXT), which would report to it and exit 0.
function passes(tests: readonly string[]): Promise<boolean> {
	const child = spawn(process.execPath, ["--import", KIT, "--test", ...tests], { cwd: root, env: { ...process.env, NODE_TEST_CONTEXT: undefined }, detached: true, stdio: "ignore", timeout: RUN_MS, killSignal: "SIGKILL" });
	const { promise, resolve: done, reject } = Promise.withResolvers<boolean>();
	running = child.pid;
	child.on("error", reject);
	child.on("exit", (code) => {
		stopGroup(running);
		running = undefined;
		done(code === 0);
	});
	return promise;
}

function stopGroup(pid: number | undefined): void {
	try {
		if (pid !== undefined) process.kill(-pid, "SIGKILL");
	} catch {} // ESRCH: no process of the group is left.
}
