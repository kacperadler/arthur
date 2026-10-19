import { everyOption, type OptionTable } from "@arthur/core/option-table";
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions, table } from "../src/machine-options.ts";
import { EVERY_SECONDS } from "../src/machines.ts";

const MAC = { name: "mac", ssh: "mac-mini", home: "/Users/arthur/.arthur", labels: { os: "macos", arch: "arm64", tools: ["xcodebuild"] }, maxJobs: 2 };

test("the example's options pass, and so do none at all", () => {
	assert.deepEqual(checkOptions({ local: { labels: { tools: ["docker"] }, maxJobs: 3 }, list: [MAC, { name: "build-2", ssh: "arthur@100.64.0.9", home: "/srv/arthur" }], check: { everySeconds: 10 } }), []);
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ list: [], local: {} }), []);
});

test("refused, naming the machine: two with one name, one named local, an os other than linux or macos", () => {
	assert.deepEqual(checkOptions({ list: [MAC, { ...MAC, ssh: "other" }] }), [{ path: "list[1].name", problem: "machine mac: two machines named mac, list[0] and list[1]" }]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, name: "local" }] }), [{ path: "list[0].name", problem: "machine local: local is the machine Arthur runs on; its tools and maxJobs go in the local option" }]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, labels: { os: "windows" } }] }), [{ path: "list[0].labels.os", problem: 'machine mac: expected "linux" or "macos", got "windows"' }]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, labels: { os: "Linux" } }] }), [{ path: "list[0].labels.os", problem: 'machine mac: expected "linux" or "macos", got "Linux"' }]);
});

test("each entry's shape: required keys, the forms the core would refuse, labels, maxJobs at its limit", () => {
	assert.deepEqual(checkOptions({ list: [{ labels: {} }] }), [
		{ path: "list[0].name", problem: "a machine without a name: name is required" },
		{ path: "list[0].ssh", problem: "a machine without a name: ssh is required" },
		{ path: "list[0].home", problem: "a machine without a name: home is required" },
	]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, ssh: "-oProxyCommand=sh", home: ".arthur", port: 22 }] }), [
		{ path: "list[0].ssh", problem: 'machine mac: expected a Host of ~/.ssh/config or a host name (letters, digits, _ . @ -), never an ssh option, got "-oProxyCommand=sh"' },
		{ path: "list[0].home", problem: 'machine mac: expected an absolute path, Arthur\'s home folder there, got ".arthur"' },
		{ path: "list[0].port", problem: "machine mac: unknown key; keys: name, ssh, home, labels, maxJobs" },
	]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, name: "Mac" }] }), [{ path: "list[0].name", problem: 'machine Mac: expected lowercase letters, digits and dashes, from a letter, got "Mac"' }]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, labels: { arch: "", tools: "xcodebuild", gpu: true } }] }), [
		{ path: "list[0].labels.arch", problem: 'machine mac: expected a non-empty string, got ""' },
		{ path: "list[0].labels.tools", problem: 'machine mac: expected a list of non-empty strings, got "xcodebuild"' },
		{ path: "list[0].labels.gpu", problem: "machine mac: unknown key; keys: os, arch, tools" },
	]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, labels: ["macos"] }] }), [{ path: "list[0].labels", problem: "machine mac: expected an object of os, arch, tools, got a list" }]);
	assert.deepEqual(checkOptions({ list: [{ ...MAC, maxJobs: 1 }] }), []);
	for (const maxJobs of [0, 1.5, "2"]) assert.equal(checkOptions({ list: [{ ...MAC, maxJobs }] })[0]?.path, "list[0].maxJobs", String(maxJobs));
	assert.deepEqual(checkOptions({ list: ["mac"] }), [{ path: "list[0]", problem: 'a machine without a name: expected an object of name, ssh, home, labels, maxJobs, got "mac"' }]);
	assert.deepEqual(checkOptions({ list: { mac: MAC } }), [{ path: "list", problem: "expected a list of machines, got an object" }]);
});

test("local takes tools and maxJobs, never os or arch; everySeconds is 10 or more; any other option is refused", () => {
	assert.deepEqual(checkOptions({ local: { labels: { os: "linux", arch: "x64" } } }), [
		{ path: "local.labels.os", problem: 'machine local: expected nothing: the os and arch of local are detected, got "linux"' },
		{ path: "local.labels.arch", problem: 'machine local: expected nothing: the os and arch of local are detected, got "x64"' },
	]);
	assert.deepEqual(checkOptions({ local: { maxJobs: 0, ssh: "x" } }), [
		{ path: "local.maxJobs", problem: "machine local: expected a whole number of 1 or more, got 0" },
		{ path: "local.ssh", problem: "machine local: unknown key; keys: labels, maxJobs" },
	]);
	assert.deepEqual(checkOptions({ check: { everySeconds: 9 } }), [{ path: "check.everySeconds", problem: "expected a whole number of seconds, 10 or more, as a check may take 10 s, got 9" }]);
	assert.deepEqual(checkOptions({ machines: [] }), [{ path: "machines", problem: "unknown key; keys: local, list, check" }]);
});

// Each default `table` writes as a value, by its path, parsed as JSON when it parses; `words` are the paths of those written as
// words for a person, left out.
function valueDefaults(table: OptionTable, words: readonly string[]): Record<string, unknown> {
	const value = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	return Object.fromEntries(everyOption(table).flatMap(({ path, entry }) => (entry.default === undefined || words.includes(path) ? [] : [[path, value(entry.default)]])));
}

test("each default the option table writes as a value is the one the code applies with nothing set", () => {
	assert.deepEqual(valueDefaults(table, ["local.maxJobs", "list.*.maxJobs"]), { "check.everySeconds": EVERY_SECONDS });
});
