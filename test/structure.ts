import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

// The rules that keep Arthur small (spec/roadmap.md, entry 1), checked over one repository tree.
// Each problem is one line: the file, then the rule it breaks. The line budgets come from the caller.

const MAX_FILE_LINES = 200;
const CODE = /\.[cm]?[jt]s$/;
const BANNED_NAMES = /^(index|types|utils)\.[cm]?[jt]s$/;
const RUNTIME_KEYS = ["dependencies", "optionalDependencies", "peerDependencies"];
const TOOLCHAIN = ["typescript", "@types/node"];
const LICENSE = "Apache-2.0";
// The core's test kit: it never runs in production, so its lines count against a budget of their own, `core/testing`.
const TEST_KIT = [join("src", "testing.ts"), join("src", "test-env.ts"), join("src", "fake-agent.ts")];
// String literals and comments; strings come first so that `//` inside a string stays part of it.
const TOKENS = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(["'])([^"'\n]+)\1/g;
const CLASS = /\bclass\b\s*[A-Za-z_${]/;
const ENUM = /\benum\b\s*[A-Za-z_$]/;

type Report = (path: string, rule: string) => void;
type Pkg = { readonly dir: string; readonly name: string; readonly coreExports: readonly string[] };

export function checkStructure(root: string, budgets: Readonly<Record<string, number>>): string[] {
	const problems: string[] = [];
	const report: Report = (path, rule) => problems.push(`${relative(root, path) || "."}: ${rule}`);
	checkManifest(join(root, "package.json"), report);
	const packages = join(root, "packages");
	if (!existsSync(packages)) return problems;
	const coreManifest = join(packages, "core", "package.json");
	const coreExports = exportKeys(existsSync(coreManifest) ? JSON.parse(readFileSync(coreManifest, "utf8")).exports : undefined);
	for (const name of readdirSync(packages).sort()) {
		const dir = join(packages, name);
		if (!statSync(dir).isDirectory()) continue;
		checkManifest(join(dir, "package.json"), report);
		checkPackage({ dir, name, coreExports }, budgets, report);
	}
	return problems;
}

function checkPackage(pkg: Pkg, budgets: Readonly<Record<string, number>>, report: Report): void {
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
