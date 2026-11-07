import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { loadPlugins } from "../src/host.ts";
import { release } from "../src/job-machine.ts";
import { inRange } from "../src/plugin-range.ts";
import { temporaryFolder } from "../src/testing.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");

test("a range is read as npm reads ^x.y.z, ~x.y.z and an exact x.y.z, each at its limits; any other is not read", () => {
	const rows: readonly (readonly [unknown, string, boolean | undefined])[] = [
		["^1.2.3", "1.2.3", true],
		["^1.2.3", "1.9.0", true],
		["^1.2.3", "1.2.2", false],
		["^1.2.3", "2.0.0", false],
		["^1.2.3", "0.9.9", false],
		["^0.1.0", "0.1.0", true],
		["^0.1.0", "0.1.7", true],
		["^0.1.0", "0.2.0", false],
		["^0.1.0", "1.1.0", false],
		["^0.1.2", "0.1.1", false],
		["^0.0.3", "0.0.3", true],
		["^0.0.3", "0.0.4", false],
		["~1.2.3", "1.2.9", true],
		["~1.2.3", "1.2.2", false],
		["~1.2.3", "1.3.0", false],
		["~0.0.3", "0.0.4", true],
		["1.2.3", "1.2.3", true],
		["1.2.3", "1.2.4", false],
		["1.2.3", "1.2.2", false],
		[">=0.1.0", "0.1.0", undefined],
		["^0.1", "0.1.0", undefined],
		["0.1.0 || 0.2.0", "0.1.0", undefined],
		["*", "0.1.0", undefined],
		[" ^0.1.0", "0.1.0", undefined],
		["workspace:*", "0.1.0", undefined],
		["^01.2.3", "1.2.3", undefined],
		["~1.02.3", "1.2.3", undefined],
		["1.2.03", "1.2.3", undefined],
		["", "0.1.0", undefined],
		[1, "0.1.0", undefined],
		[null, "0.1.0", undefined],
	];
	for (const [range, version, expected] of rows) assert.equal(inRange(range, version), expected, `${JSON.stringify(range)} with ${version}`);
});

// A plugin of its own package in `folders`, its package.json `fields`, its module two folders below it as an installed one may be.
const folders = new Map<string, string>();
function plugin(name: string, fields: Record<string, unknown>) {
	const folder = join(temporaryFolder(), name);
	mkdirSync(join(folder, "dist", "lib"), { recursive: true });
	writeFileSync(join(folder, "package.json"), JSON.stringify({ name: `@acme/${name}`, ...fields }));
	folders.set(name, folder);
	return { name, module: pathToFileURL(join(folder, "dist", "lib", `${name}.js`)).href, setup: () => {} };
}

test("a plugin's range of @arthur/core, read at load, gives one doctor line that never stops the start; one without it, or with no package, gives none", async () => {
	const version = release();
	const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
	const [newer, next] = [`^${major}.${minor + 1}.0`, `${major}.${minor}.${patch + 1}`];
	const plugins = [
		{ name: "orchestration", setup: () => {} },
		plugin("plain", {}),
		plugin("other", { peerDependencies: { "@acme/other": "^1.0.0" } }),
		plugin("within", { peerDependencies: { "@arthur/core": `^${version}` } }),
		plugin("newer", { peerDependencies: { "@arthur/core": newer } }),
		plugin("next", { peerDependencies: { "@arthur/core": next } }),
		plugin("loose", { peerDependencies: { "@arthur/core": ">=0.1.0" } }),
		plugin("number", { peerDependencies: { "@arthur/core": 1 } }),
	];
	const folder = temporaryFolder();
	const core = { home: join(folder, ".arthur"), envFile: join(folder, "env"), agent: { command: "omp" }, timeZone: "UTC", quietHours: undefined, jobs: { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, unsandboxed: true, cpu: 1, memory: "70%" } };
	const loaded = await loadPlugins({ path: join(folder, "arthur.config.ts"), core, plugins }, {});
	// Read at load: a range written after it changes nothing until the next load.
	writeFileSync(join(folders.get("within") ?? "", "package.json"), JSON.stringify({ peerDependencies: { "@arthur/core": "^99.0.0" } }));
	const lines = (await loaded.doctor()).filter((line) => line.plugin === "core" && line.name.startsWith("plugin "));
	const missing = (name: string, reason: string, fix: string) => {
		const text = `core plugin ${name}: missing: ${reason}; without it: ${name} may use what this core does not have; fix: ${fix}`;
		return { plugin: "core", name: `plugin ${name}`, text, missing: true, critical: false, fix };
	};
	const outside = (name: string, range: string) => missing(name, `built for @arthur/core ${range}, this core is ${version}`, `install the release of ${name} built for @arthur/core ${version}, or the core its range names`);
	const unread = (name: string, range: string) =>
		missing(name, `its range of @arthur/core, ${range}, is not read: only ^x.y.z, ~x.y.z and x.y.z are`, `write peerDependencies["@arthur/core"] in ${join(folders.get(name) ?? "", "package.json")} as ^x.y.z, ~x.y.z or x.y.z`);
	assert.deepEqual(lines, [
		{ plugin: "core", name: "plugin within", text: `core plugin within: ok (built for @arthur/core ^${version})`, missing: false, critical: false },
		outside("newer", newer),
		outside("next", next),
		unread("loose", '">=0.1.0"'),
		unread("number", "1"),
	]);
});

test("one release: the root, the core and every first-party plugin's package.json and the lockfile hold one version; none names a range of @arthur/core", () => {
	const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
	const root = read("package.json").version;
	assert.match(root, /^\d+\.\d+\.\d+$/);
	const lock = read("package-lock.json").packages;
	assert.equal(lock[""].version, root, "the lockfile's root");
	for (const name of readdirSync(join(ROOT, "packages"))) {
		const own = read(join("packages", name, "package.json"));
		assert.deepEqual([own.version, lock[`packages/${name}`]?.version, own.peerDependencies?.["@arthur/core"]], [root, root, undefined], name);
	}
});
