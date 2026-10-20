import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost } from "@arthur/core/testing";

// Roadmap entry 51: the host API is what docs/plugin-api.md writes down. A name a module of @arthur/core publishes, or a host
// member, that the page does not list fails here, and so does one the page lists that is gone.

const ROOT = join(import.meta.dirname, "..");
const CORE = join(ROOT, "packages", "core");
const DOC = readFileSync(join(ROOT, "docs", "plugin-api.md"), "utf8");
// The host's members that hold members of their own.
const NESTED = ["events", "commands", "jobs", "board", "clock"];

// What a module's source exports: declarations, `export { ... }` and `export type { ... } from`, and `default`.
function exportedNames(source: string): string[] {
	const names = [...source.matchAll(/^export (?:async )?(?:function\*?|const|let|type|interface) +(\w+)/gm)].map((match) => match[1] ?? "");
	for (const [, list = ""] of source.matchAll(/^export (?:type )?\{([^}]*)\}/gm)) names.push(...list.split(",").map((name) => name.trim().split(/\s+as\s+/).at(-1) ?? "").filter(Boolean));
	if (/^export default /m.test(source)) names.push("default");
	return names.sort();
}

// The page's section under `heading`, up to the next heading of any level.
function section(doc: string, heading: string): string | undefined {
	const start = doc.split("\n").indexOf(heading);
	if (start < 0) return undefined;
	const rest = doc.split("\n").slice(start + 1);
	const end = rest.findIndex((line) => line.startsWith("#"));
	return rest.slice(0, end < 0 ? undefined : end).join("\n");
}

// The names a module's `Exports:` line lists; `none` is no name.
function listed(doc: string, module: string): string[] | undefined {
	const line = section(doc, `### \`${module}\``)
		?.split("\n")
		.find((each) => each.startsWith("Exports: "));
	if (line === undefined) return undefined;
	return line === "Exports: none." ? [] : [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "").sort();
}

// The host members the page's table under "## The host" lists, as `jobs.spawn`.
function hostRows(doc: string): string[] {
	return [...(section(doc, "## The host") ?? "").matchAll(/^\| `([\w.]+)[^`]*` \|/gm)].map((match) => match[1] ?? "").sort();
}

function hostMembers(host: object): string[] {
	return Object.entries(host)
		.flatMap(([key, value]) => (NESTED.includes(key) ? Object.keys(value as object).map((inner) => `${key}.${inner}`) : [key]))
		.sort();
}

test("each module of @arthur/core's exports has its section, whose Exports line names exactly what the module exports", () => {
	const exports: Readonly<Record<string, string>> = JSON.parse(readFileSync(join(CORE, "package.json"), "utf8")).exports;
	const modules = Object.keys(exports).map((key) => `@arthur/core${key.slice(1)}`);
	assert.deepEqual(
		[...DOC.matchAll(/^### `(@arthur\/core[^`]*)`$/gm)].map((match) => match[1]),
		modules,
		"one section per module, in the order of package.json",
	);
	for (const [key, file] of Object.entries(exports)) {
		const module = `@arthur/core${key.slice(1)}`;
		assert.deepEqual(listed(DOC, module), exportedNames(readFileSync(join(CORE, file), "utf8")), `${module} (${file})`);
	}
});

test("the host a plugin gets has exactly the members the page's host table lists", async () => {
	const fake = fakeHost({ name: "api" });
	assert.deepEqual(hostRows(DOC), hostMembers(fake.host));
	assert.ok(!hostMembers(fake.host).includes("jobs.unblock") && !hostMembers(fake.host).includes("board.after"), "removed by entry 51");
});

test("refused: a module's export or a host member the page does not name, and one it names that is gone", () => {
	const doc = ["### `@arthur/core/lock`", "", "Exports: `queueLock`, `withLock`.", "", "## The host", "", "| Member | What |", "| --- | --- |", "| `name` | Its name. |", "| `jobs.spawn(request)` | A job. |"].join("\n");
	const source = "export function withLock() {}\nexport async function queueLock() {}\nexport function takeLock() {}\nfunction own() {}\n";
	assert.notDeepEqual(listed(doc, "@arthur/core/lock"), exportedNames(source), "takeLock, not on the page");
	assert.deepEqual(listed(doc, "@arthur/core/lock"), exportedNames(source.replace("export function takeLock() {}\n", "")));
	assert.deepEqual(exportedNames('export type { A, B as C } from "./x.ts";\nexport { d } from "./y.ts";\nexport default function e() {}\n'), ["A", "C", "d", "default"]);
	assert.deepEqual(hostRows(doc), ["jobs.spawn", "name"]);
	assert.notDeepEqual(hostRows(doc), hostMembers({ name: "x", jobs: { spawn() {}, unblock() {} } }), "jobs.unblock, not on the page");
	assert.notDeepEqual(hostRows(doc), hostMembers({ jobs: { spawn() {} } }), "name, on the page and gone");
});
