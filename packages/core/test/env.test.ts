import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { LoadedConfig } from "../src/config.ts";
import { checkEnv, parseEnvFile, resolveEnv, type Shell } from "../src/env.ts";

const root = mkdtempSync(join(tmpdir(), "arthur-env-test-"));
after(() => rmSync(root, { recursive: true, force: true }));

let count = 0;
// A loaded config whose env file holds `envText`, or does not exist when it is undefined; each plugin gets a `setup`.
function config(plugins: readonly object[], envText?: string): LoadedConfig {
	const folder = join(root, String(++count));
	mkdirSync(folder);
	const envFile = join(folder, "env");
	if (envText !== undefined) writeFileSync(envFile, envText);
	const jobs = { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, cpu: 1, memory: "70%" };
	const core = { home: join(folder, ".arthur"), envFile, agent: { command: "omp" }, timeZone: "UTC", quietHours: undefined, jobs };
	return { path: join(folder, "arthur.config.ts"), core, plugins: plugins.map((plugin) => ({ setup() {}, ...plugin })) };
}

const youtrack = (options: object) => ({ name: "youtrack", options });

function refusal(loaded: LoadedConfig, shell: Shell = {}): string {
	try {
		resolveEnv(loaded, shell);
	} catch (error) {
		return (error as Error).message;
	}
	assert.fail("resolveEnv passed, expected a refusal");
}

test("a value comes from the shell, else from the env file; each plugin gets only its own", () => {
	const loaded = config(
		[youtrack({ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" }), { name: "github", options: { tokenEnv: "ARTHUR_GITHUB_TOKEN" } }],
		"ARTHUR_YOUTRACK_URL=https://file.example\nARTHUR_YOUTRACK_TOKEN=from-file\nARTHUR_GITHUB_TOKEN=gh-file\n",
	);
	const { values, warnings } = resolveEnv(loaded, { ARTHUR_YOUTRACK_TOKEN: "from-shell" });
	assert.deepEqual(values, {
		youtrack: { ARTHUR_YOUTRACK_URL: "https://file.example", ARTHUR_YOUTRACK_TOKEN: "from-shell" },
		github: { ARTHUR_GITHUB_TOKEN: "gh-file" },
	});
	assert.deepEqual(warnings, []);
});

test("an empty shell variable wins over the env file's value", () => {
	const loaded = config([youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN" })], "ARTHUR_YOUTRACK_TOKEN=from-file\n");
	assert.deepEqual(resolveEnv(loaded, { ARTHUR_YOUTRACK_TOKEN: "" }).values, { youtrack: { ARTHUR_YOUTRACK_TOKEN: "" } });
	assert.deepEqual(checkEnv(loaded, { ARTHUR_YOUTRACK_TOKEN: "" }).variables, [
		{ plugin: "youtrack", option: "youtrack.tokenEnv", name: "ARTHUR_YOUTRACK_TOKEN", set: true },
	]);
});

test("a missing variable refuses the start, naming the option and the variable, each one on its line", () => {
	const loaded = config([youtrack({ instances: [{ urlEnv: "ARTHUR_YOUTRACK_URL" }, { name: "acme", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" }] })], "");
	assert.deepEqual(refusal(loaded).split("\n"), [
		`${loaded.path}: youtrack.instances[0].urlEnv: ARTHUR_YOUTRACK_URL is missing: not in the shell nor in ${loaded.core.envFile}`,
		`${loaded.path}: youtrack.instances[1].tokenEnv: ARTHUR_YOUTRACK_ACME_TOKEN is missing: not in the shell nor in ${loaded.core.envFile}`,
	]);
});

test("a missing env file is fine when every variable is in the shell, and named when one is missing", () => {
	const loaded = config([youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN", urlEnv: "ARTHUR_YOUTRACK_URL" })]);
	assert.deepEqual(resolveEnv(loaded, { ARTHUR_YOUTRACK_TOKEN: "t", ARTHUR_YOUTRACK_URL: "u" }).values.youtrack, {
		ARTHUR_YOUTRACK_TOKEN: "t",
		ARTHUR_YOUTRACK_URL: "u",
	});
	assert.match(refusal(loaded, { ARTHUR_YOUTRACK_TOKEN: "t" }), /youtrack\.urlEnv: ARTHUR_YOUTRACK_URL is missing: .*, which does not exist$/);
});

test("a disabled plugin's variables are not read and not listed, and its names are not checked", () => {
	const reads: string[] = [];
	const shell = new Proxy({ ARTHUR_SERVER_TOKEN: "s", ARTHUR_YOUTRACK_TOKEN: "t" } as Shell, {
		get: (target, key) => (reads.push(String(key)), Reflect.get(target, key)),
	});
	const loaded = config([
		{ name: "server", options: { enabled: false, tokenEnv: "ARTHUR_SERVER_TOKEN", otherEnv: "not a name" } },
		youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN" }),
	]);
	const check = checkEnv(loaded, shell);
	assert.deepEqual(check.problems, []);
	assert.deepEqual(check.variables.map((variable) => variable.name), ["ARTHUR_YOUTRACK_TOKEN"]);
	assert.deepEqual(Object.keys(check.values), ["youtrack"]);
	assert.deepEqual(reads, ["ARTHUR_YOUTRACK_TOKEN"]);
});

test("a name without the plugin's ARTHUR_ prefix, or with another plugin's name, is refused", () => {
	const loaded = config([
		youtrack({ aEnv: "YOUTRACK_TOKEN", bEnv: "ARTHUR_GITHUB_TOKEN", cEnv: "ARTHUR_YOUTRACK_", dEnv: "ARTHUR_YOUTRACK_CLOUD_TOKEN" }),
		{ name: "youtrack-cloud", options: { enabled: false } },
	]);
	const expected = "expected ARTHUR_YOUTRACK_<WHAT>, got";
	assert.deepEqual(checkEnv(loaded, {}).problems, [
		`${loaded.path}: youtrack.aEnv: ${expected} YOUTRACK_TOKEN`,
		`${loaded.path}: youtrack.bEnv: ${expected} ARTHUR_GITHUB_TOKEN`,
		`${loaded.path}: youtrack.cEnv: ${expected} ARTHUR_YOUTRACK_`,
		`${loaded.path}: youtrack.dEnv: ${expected} ARTHUR_YOUTRACK_CLOUD_TOKEN, a name of plugin youtrack-cloud`,
	]);
	assert.deepEqual(checkEnv(loaded, {}).variables, []);
});

test("a named instance's variable carries the instance's name, and no other instance uses it", () => {
	const loaded = config([
		{
			name: "commit-rules",
			options: {
				tokenEnv: "ARTHUR_COMMIT_RULES_ACME_TOKEN",
				bots: [
					{ name: "acme", tokenEnv: "ARTHUR_COMMIT_RULES_ACME_TOKEN", urlEnv: "ARTHUR_COMMIT_RULES_URL" },
					{ name: "second-bot", auth: { tokenEnv: "ARTHUR_COMMIT_RULES_SECOND_BOT_TOKEN" } },
				],
			},
		},
	]);
	const check = checkEnv(loaded, {});
	assert.deepEqual(check.problems, [
		`${loaded.path}: commit-rules.tokenEnv: expected ARTHUR_COMMIT_RULES_<WHAT>, got ARTHUR_COMMIT_RULES_ACME_TOKEN, a name of instance acme of plugin commit-rules`,
		`${loaded.path}: commit-rules.bots[0].urlEnv: expected ARTHUR_COMMIT_RULES_ACME_<WHAT>, got ARTHUR_COMMIT_RULES_URL`,
	]);
	assert.deepEqual(check.variables.map((variable) => variable.option), ["commit-rules.bots[0].tokenEnv", "commit-rules.bots[1].auth.tokenEnv"]);
});

test("two owners of the same prefix are refused, naming both, whether plugins or instances", () => {
	const token = "ARTHUR_YOUTRACK_CLOUD_TOKEN";
	const loaded = config([
		youtrack({ instances: [{ name: "cloud", tokenEnv: token }, { name: "a-b", urlEnv: "ARTHUR_YOUTRACK_A_B_URL" }, { name: "a b", urlEnv: "ARTHUR_YOUTRACK_A_B_URL" }] }),
		{ name: "youtrack-cloud", options: { tokenEnv: token } },
		{ name: "github", options: { enabled: false } },
		{ name: "github", options: {} },
	]);
	const check = checkEnv(loaded, { [token]: "t" });
	assert.deepEqual(check.problems, [
		`${loaded.path}: ARTHUR_GITHUB_ is the prefix of both plugin github and plugin github`,
		`${loaded.path}: ARTHUR_YOUTRACK_CLOUD_ is the prefix of both plugin youtrack-cloud and instance cloud of plugin youtrack`,
		`${loaded.path}: ARTHUR_YOUTRACK_A_B_ is the prefix of both instance a-b of plugin youtrack and instance a b of plugin youtrack`,
	]);
	assert.match(refusal(loaded, { [token]: "t" }), /ARTHUR_YOUTRACK_CLOUD_ is the prefix of both plugin youtrack-cloud and instance cloud/);
});

test("a name inside another plugin's instance prefix belongs to that instance alone", () => {
	const loaded = config([
		{ name: "a", options: { instances: [{ name: "b-c", tokenEnv: "ARTHUR_A_B_C_TOKEN" }] } },
		{ name: "a-b", options: { tokenEnv: "ARTHUR_A_B_C_TOKEN" } },
	]);
	const check = checkEnv(loaded, {});
	assert.deepEqual(check.problems, [
		`${loaded.path}: a-b.tokenEnv: expected ARTHUR_A_B_<WHAT>, got ARTHUR_A_B_C_TOKEN, a name of instance b-c of plugin a`,
	]);
	assert.deepEqual(check.variables.map((variable) => variable.option), ["a.instances[0].tokenEnv"]);
});

test("with three nested owners a name belongs to the deepest, whatever order they were declared in", () => {
	const token = "ARTHUR_A_B_C_TOKEN";
	const shell = { [token]: "s3cret" };
	const b = { name: "b", tokenEnv: token };
	const bc = { name: "b-c", tokenEnv: token };
	for (const instances of [[b, bc], [bc, b]]) {
		const loaded = config([{ name: "a", options: { tokenEnv: token, instances } }]);
		const at = instances.indexOf(b);
		const check = checkEnv(loaded, shell);
		assert.deepEqual(check.problems, [
			`${loaded.path}: a.tokenEnv: expected ARTHUR_A_<WHAT>, got ${token}, a name of instance b-c of plugin a`,
			`${loaded.path}: a.instances[${at}].tokenEnv: expected ARTHUR_A_B_<WHAT>, got ${token}, a name of instance b-c of plugin a`,
		]);
		assert.deepEqual(check.variables.map((variable) => variable.option), [`a.instances[${1 - at}].tokenEnv`]);
		assert.doesNotMatch(refusal(loaded, shell), /s3cret/);
	}
	const a = { name: "a", options: { tokenEnv: token } };
	const ab = { name: "a-b", options: { tokenEnv: token, instances: [{ name: "c", tokenEnv: token }] } };
	for (const plugins of [[a, ab], [ab, a]]) {
		const loaded = config(plugins);
		const check = checkEnv(loaded, shell);
		assert.deepEqual(check.problems.toSorted(), [
			`${loaded.path}: a-b.tokenEnv: expected ARTHUR_A_B_<WHAT>, got ${token}, a name of instance c of plugin a-b`,
			`${loaded.path}: a.tokenEnv: expected ARTHUR_A_<WHAT>, got ${token}, a name of instance c of plugin a-b`,
		]);
		assert.deepEqual(check.variables.map((variable) => variable.option), ["a-b.instances[0].tokenEnv"]);
		assert.doesNotMatch(refusal(loaded, shell), /s3cret/);
	}
});

test("an option that is not a name is refused without showing it; one left undefined needs nothing", () => {
	const loaded = config([youtrack({ aEnv: 5, bEnv: null, cEnv: "ghp_pasted-secret", dEnv: undefined })]);
	assert.deepEqual(checkEnv(loaded, {}).problems, [
		`${loaded.path}: youtrack.aEnv: expected ARTHUR_YOUTRACK_<WHAT>, got a number`,
		`${loaded.path}: youtrack.bEnv: expected ARTHUR_YOUTRACK_<WHAT>, got null`,
		`${loaded.path}: youtrack.cEnv: expected ARTHUR_YOUTRACK_<WHAT> (capitals, digits and _); the text given is not shown`,
	]);
});

test("a plugin entry the host refuses is skipped: its refusal is the host's alone", () => {
	const loaded = config([]);
	const github = { name: "github", options: { tokenEnv: "ARTHUR_GITHUB_TOKEN" } };
	const valid = { setup() {}, ...youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN" }) };
	const plugins = [null, { name: "Bad_Name", setup() {}, options: { tokenEnv: "X" } }, github, { name: "ok", setup() {}, options: [] }, valid];
	const check = checkEnv({ ...loaded, plugins }, {});
	assert.deepEqual(check.problems, []);
	assert.deepEqual(check.variables.map((variable) => variable.option), ["youtrack.tokenEnv"]);
});

test("the env file: comments, blank lines, quotes, a # comment after a value, = inside a value, CRLF", () => {
	const text = [
		"# a comment",
		"",
		"  A = plain value  ",
		'B="double # not a comment" # a comment',
		"C='single'",
		"D=x=y",
		"E=value # comment",
		"F=a#b",
		"G=",
		"H=\"\"\r",
		"I=crlf\r",
	].join("\n");
	const parsed = parseEnvFile(text, "env");
	assert.deepEqual(Object.fromEntries(parsed.values), {
		A: "plain value",
		B: "double # not a comment",
		C: "single",
		D: "x=y",
		E: "value",
		F: "a#b",
		G: "",
		H: "",
		I: "crlf",
	});
	assert.deepEqual([parsed.problems, parsed.warnings], [[], []]);
});

test("an env-file line without =, with a bad key or an unclosed quote is refused by its number, never shown", () => {
	const parsed = parseEnvFile("OK=1\nsecret-without-equals\nexport A=1\nB=\"open\nC='x' trailing\n", "env");
	assert.deepEqual(parsed.problems, [
		"env:2: expected KEY=value, the key letters, digits and _; the line is not shown",
		"env:3: expected KEY=value, the key letters, digits and _; the line is not shown",
		"env:4: B: expected a value in matching quotes, then nothing or a # comment; the value is not shown",
		"env:5: C: expected a value in matching quotes, then nothing or a # comment; the value is not shown",
	]);
	const loaded = config([youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN" })], "nothing here\n");
	assert.equal(refusal(loaded, { ARTHUR_YOUTRACK_TOKEN: "t" }), `${loaded.core.envFile}:1: expected KEY=value, the key letters, digits and _; the line is not shown`);
});

test("a duplicate key: the last wins, said once however often it repeats", () => {
	const loaded = config([youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN" })], "ARTHUR_YOUTRACK_TOKEN=1\nX=1\nARTHUR_YOUTRACK_TOKEN=2\nARTHUR_YOUTRACK_TOKEN=3\n");
	const { values, warnings } = resolveEnv(loaded, {});
	assert.deepEqual(values, { youtrack: { ARTHUR_YOUTRACK_TOKEN: "3" } });
	assert.deepEqual(warnings, [`${loaded.core.envFile}: ARTHUR_YOUTRACK_TOKEN is set on lines 1, 3, 4; the last wins`]);
});

test("an env file that exists but cannot be read is refused", () => {
	const loaded = config([youtrack({ tokenEnv: "ARTHUR_YOUTRACK_TOKEN" })]);
	mkdirSync(loaded.core.envFile);
	assert.equal(refusal(loaded, { ARTHUR_YOUTRACK_TOKEN: "t" }), `${loaded.core.envFile}: cannot be read (EISDIR)`);
});
