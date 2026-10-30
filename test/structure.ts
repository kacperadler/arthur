import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

// The rules that keep Arthur small (spec/roadmap.md, entry 1), checked over one repository tree.
// Each problem is one line: the file, then the rule it breaks. The line budgets and fixed-wait baselines come from the caller.

const MAX_FILE_LINES = 200;
const CODE = /\.[cm]?[jt]s$/;
const BANNED_NAMES = /^(index|types|utils)\.[cm]?[jt]s$/;
const RUNTIME_KEYS = ["dependencies", "optionalDependencies", "peerDependencies"];
const TOOLCHAIN = ["typescript", "@types/node"];
const LICENSE = "Apache-2.0";
// The core's test kit: it never runs in production, so its lines count against a budget of their own, `core/testing`.
const TEST_KIT = [join("src", "testing.ts"), join("src", "test-env.ts"), join("src", "fake-agent.ts"), join("src", "until.ts")];
// String literals and comments; strings come first so that `//` inside a string stays part of it.
const TOKENS = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(["'])([^"'\n]+)\1/g;
const CLASS = /\bclass\b\s*[A-Za-z_${]/;
const ENUM = /\benum\b\s*[A-Za-z_$]/;
// A test waits with the kit's `until` (AR0578): a test file declares no `until` of its own and no loop that sleeps, and holds
// no more fixed waits than its baseline. Strings and comments do not count: a script a test writes may sleep.
const OWN_UNTIL = /\bfunction\s+until\b|\b(?:const|let|var)\s+until\s*=/;
const POLL = /\b(?:for|while)\s*\([^\n]*\b(?:sleep|setTimeout)\s*\(/;
const FIXED_WAIT = /\b(?:sleep|setTimeout)\s*\(|\bAtomics\.wait\s*\(/g;

type Report = (path: string, rule: string) => void;
type Waits = Readonly<Record<string, number>>;
type TestFile = (file: string, code: string) => void;
type Pkg = { readonly dir: string; readonly name: string; readonly coreExports: readonly string[] };

// `waits`: the fixed waits each test file may hold, by its path from `root`; a file left out may hold none.
export function checkStructure(root: string, budgets: Readonly<Record<string, number>>, waits: Waits): string[] {
	const problems: string[] = [];
	const report: Report = (path, rule) => problems.push(`${relative(root, path) || "."}: ${rule}`);
	const testFile: TestFile = (file, code) => checkTestFile(file, code, waits[relative(root, file).split(sep).join("/")] ?? 0, report);
	checkManifest(join(root, "package.json"), report);
	const tests = join(root, "test");
	for (const path of existsSync(tests) ? readdirSync(tests, { recursive: true, encoding: "utf8" }).filter((path) => CODE.test(path)).sort() : [])
		testFile(join(tests, path), strip(readFileSync(join(tests, path), "utf8"), true));
	const packages = join(root, "packages");
	if (!existsSync(packages)) return problems;
	const coreManifest = join(packages, "core", "package.json");
	const coreExports = exportKeys(existsSync(coreManifest) ? JSON.parse(readFileSync(coreManifest, "utf8")).exports : undefined);
	for (const name of readdirSync(packages).sort()) {
		const dir = join(packages, name);
		if (!statSync(dir).isDirectory()) continue;
		checkManifest(join(dir, "package.json"), report);
		checkPackage({ dir, name, coreExports }, budgets, report, testFile);
	}
	return problems;
}

function checkPackage(pkg: Pkg, budgets: Readonly<Record<string, number>>, report: Report, testFile: TestFile): void {
	const files = readdirSync(pkg.dir, { recursive: true, encoding: "utf8" })
		.filter((path) => CODE.test(path) && !path.split(sep).includes("node_modules"))
		.sort();
	const kit = pkg.name === "core" ? TEST_KIT : [];
	let sourceLines = 0;
	let kitLines = 0;
	for (const path of files) {
		const file = join(pkg.dir, path);
		const text = readFileSync(file, "utf8");
		if (BANNED_NAMES.test(path.split(sep).at(-1) ?? "")) report(file, "no index.ts, types.ts or utils.ts; name a file after its one job");
		const code = strip(text, true);
		if (CLASS.test(code)) report(file, "declares a class; Arthur uses plain functions");
		if (ENUM.test(code)) report(file, "declares an enum; use a union type");
		for (const match of strip(text, false).matchAll(SPECIFIER)) {
			const rule = importRule(pkg, file, match[2] ?? "");
			if (rule) report(file, rule);
		}
		if (path.split(sep)[0] === "test") testFile(file, code);
		if (path.split(sep)[0] !== "src") continue;
		const lines = lineCount(text);
		if (kit.includes(path)) kitLines += lines;
		else sourceLines += lines;
		if (lines > MAX_FILE_LINES) report(file, `has ${lines} lines; a source file has at most ${MAX_FILE_LINES}`);
	}
	const budget = budgets[pkg.name];
	if (budget === undefined) report(pkg.dir, "has no line budget; add one to test/structure.test.ts");
	else if (sourceLines > budget) report(pkg.dir, `has ${sourceLines} source lines, over its line budget of ${budget}`);
	const kitBudget = kit.length > 0 ? budgets["core/testing"] : Infinity;
	if (kitBudget === undefined) report(pkg.dir, "has no line budget for its test kit; add core/testing to test/structure.test.ts");
	else if (kitLines > kitBudget) report(pkg.dir, `its test kit (${kit.join(", ")}) has ${kitLines} lines, over its line budget of ${kitBudget}`);
	if (!files.some((path) => path.startsWith(`test${sep}`) && path.endsWith(".test.ts")))
		report(pkg.dir, "has no test; a package has at least one test/*.test.ts");
}

function checkTestFile(file: string, code: string, allowed: number, report: Report): void {
	if (OWN_UNTIL.test(code)) report(file, "declares its own until; import until from @arthur/core/testing");
	if (POLL.test(code)) report(file, "has a loop that sleeps; wait with until from @arthur/core/testing");
	const waits = code.match(FIXED_WAIT)?.length ?? 0;
	if (waits > allowed) report(file, `has ${waits} fixed waits (sleep, setTimeout, Atomics.wait), over its baseline of ${allowed} in test/structure.test.ts; wait for the state with until`);
}

function importRule(pkg: Pkg, file: string, specifier: string): string | undefined {
	if (specifier.startsWith(".") || specifier.startsWith("/")) {
		const path = relative(pkg.dir, resolve(dirname(file), specifier));
		return path.split(sep)[0] === ".." ? `imports ${specifier}, a path outside its package` : undefined;
	}
	if (!specifier.startsWith("@arthur/")) return undefined;
	const [, target, ...rest] = specifier.split("/");
	if (target === pkg.name) return undefined;
	if (pkg.name === "core") return `imports ${specifier}; the core imports no plugin`;
	if (target !== "core") return `imports ${specifier}; a plugin imports no other plugin`;
	const subpath = [".", ...rest].join("/");
	if (pkg.coreExports.includes(subpath)) return undefined;
	return `imports ${specifier}; a plugin imports only @arthur/core and its published subpaths`;
}

function checkManifest(path: string, report: Report): void {
	if (!existsSync(path)) return;
	const manifest = JSON.parse(readFileSync(path, "utf8"));
	if (manifest.license !== LICENSE) report(path, `has license ${JSON.stringify(manifest.license ?? null)}; every Arthur package is ${LICENSE}`);
	for (const key of RUNTIME_KEYS) {
		const deps = manifest[key];
		if (deps && typeof deps === "object" && Object.keys(deps).length > 0)
			report(path, `has ${key}; Arthur has no runtime dependency`);
	}
	const dev = manifest.devDependencies;
	if (!dev || typeof dev !== "object") return;
	for (const name of Object.keys(dev).filter((name) => !TOOLCHAIN.includes(name)))
		report(path, `has devDependency ${name}; dev dependencies are the toolchain only (${TOOLCHAIN.join(", ")})`);
}

function exportKeys(exports: unknown): string[] {
	if (exports === undefined) return [];
	if (typeof exports !== "object" || exports === null) return ["."];
	const keys = Object.keys(exports);
	return keys.every((key) => key.startsWith(".")) ? keys : ["."];
}

function strip(text: string, strings: boolean): string {
	return text.replace(TOKENS, (token) => (token.startsWith("/") ? " " : strings ? '""' : token));
}

function lineCount(text: string): number {
	if (text === "") return 0;
	return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}
