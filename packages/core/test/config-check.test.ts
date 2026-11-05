import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { loadConfig } from "../src/config.ts";
import { configCheck } from "../src/config-check.ts";
import { checkEnv, resolveEnv } from "../src/env.ts";

const root = mkdtempSync(join(tmpdir(), "arthur-config-check-test-"));
after(() => rmSync(root, { recursive: true, force: true }));
const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const SECRET = "s3cr3t-Value-4242";
// Said where no typescript sits beside the config, as in every bare folder of this file.
const untyped = (config: string) => `types not checked: typescript is not installed beside ${config}; npm ci installs it with the dev dependencies`;
const UNTYPED = untyped("arthur.config.ts");

let count = 0;
// A folder with `arthur.config.ts` exporting `plugins`, and its env file `vars` when `envText` is given.
function project(plugins: string, envText?: string): string {
	const folder = join(root, String(++count));
	mkdirSync(folder);
	writeFileSync(join(folder, "arthur.config.ts"), `export default { core: { envFile: "vars" }, plugins: ${plugins} };\n`);
	if (envText !== undefined) writeFileSync(join(folder, "vars"), envText);
	return folder;
}

const ORCHESTRATION = `{ name: "orchestration", setup() {} }`;
const PLUGINS = `[
	${ORCHESTRATION},
	{ name: "youtrack", setup() {}, options: { instances: [{ urlEnv: "ARTHUR_YOUTRACK_URL" }, { name: "acme", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" }] } },
	{ name: "server", setup() {}, options: { enabled: false, tokenEnv: "ARTHUR_SERVER_TOKEN" } },
]`;

test("each variable of the enabled plugins is listed set or missing, with the option that names it", async () => {
	const folder = project(PLUGINS, "ARTHUR_YOUTRACK_URL=https://yt.example\n");
	const { lines, ok } = await configCheck(join(folder, "arthur.config.ts"), {});
	assert.deepEqual(lines, [
		untyped(join(folder, "arthur.config.ts")),
		"set     ARTHUR_YOUTRACK_URL (youtrack.instances[0].urlEnv)",
		"missing ARTHUR_YOUTRACK_ACME_TOKEN (youtrack.instances[1].tokenEnv)",
	]);
	assert.equal(ok, false);
	assert.deepEqual(await configCheck(join(folder, "arthur.config.ts"), { ARTHUR_YOUTRACK_ACME_TOKEN: "" }), {
		lines: [
			untyped(join(folder, "arthur.config.ts")),
			`ARTHUR_YOUTRACK_ACME_TOKEN is set in the shell only; the arthur service does not see it, put it in ${join(folder, "vars")}`,
			"set     ARTHUR_YOUTRACK_URL (youtrack.instances[0].urlEnv)",
			"set     ARTHUR_YOUTRACK_ACME_TOKEN (youtrack.instances[1].tokenEnv)",
		],
		ok: true,
	});
});

test("a variable set in the shell but not in the env file is said, without its value and without failing the check", async () => {
	const folder = project(PLUGINS, "ARTHUR_YOUTRACK_URL=https://yt.example\n");
	const shellOnly = `ARTHUR_YOUTRACK_ACME_TOKEN is set in the shell only; the arthur service does not see it, put it in ${join(folder, "vars")}`;
	const both = await configCheck(join(folder, "arthur.config.ts"), { ARTHUR_YOUTRACK_URL: SECRET, ARTHUR_YOUTRACK_ACME_TOKEN: SECRET });
	assert.deepEqual(both, { lines: [untyped(join(folder, "arthur.config.ts")), shellOnly, "set     ARTHUR_YOUTRACK_URL (youtrack.instances[0].urlEnv)", "set     ARTHUR_YOUTRACK_ACME_TOKEN (youtrack.instances[1].tokenEnv)"], ok: true });
	// A variable of a disabled plugin is not looked up, so not said; with no env file, every set variable is the shell's.
	const none = project(`[${ORCHESTRATION}, { name: "server", setup() {}, options: { enabled: false, tokenEnv: "ARTHUR_SERVER_TOKEN" } }, { name: "youtrack", setup() {}, options: { tokenEnv: "ARTHUR_YOUTRACK_TOKEN" } }]`);
	assert.deepEqual((await configCheck(join(none, "arthur.config.ts"), { ARTHUR_SERVER_TOKEN: "x", ARTHUR_YOUTRACK_TOKEN: "x" })).lines, [
		untyped(join(none, "arthur.config.ts")),
		`ARTHUR_YOUTRACK_TOKEN is set in the shell only; the arthur service does not see it, put it in ${join(none, "vars")}`,
		"set     ARTHUR_YOUTRACK_TOKEN (youtrack.tokenEnv)",
	]);
	const run = spawnSync(process.execPath, [CLI, "config", "check"], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, ARTHUR_YOUTRACK_ACME_TOKEN: SECRET } });
	assert.deepEqual([run.status, ...run.stdout.split("\n").slice(0, 2)], [0, untyped(join(folder, "arthur.config.ts")), shellOnly]);
	assert.doesNotMatch(run.stdout, new RegExp(SECRET));
});

test("a missing env file is named when a variable is missing; a duplicate key is said and does not fail the check", async () => {
	const missingFile = project(PLUGINS);
	assert.deepEqual((await configCheck(join(missingFile, "arthur.config.ts"), { ARTHUR_YOUTRACK_URL: "u" })).lines.at(-1), `${join(missingFile, "vars")} does not exist; a missing variable must come from the shell`);
	const duplicate = project(PLUGINS, "ARTHUR_YOUTRACK_URL=a\nARTHUR_YOUTRACK_URL=b\nARTHUR_YOUTRACK_ACME_TOKEN=c\n");
	const { lines, ok } = await configCheck(join(duplicate, "arthur.config.ts"), {});
	assert.equal(lines[1], `${join(duplicate, "vars")}: ARTHUR_YOUTRACK_URL is set on lines 1, 2; the last wins`);
	assert.equal(ok, true);
});

test("a refused name fails the check; a config that does not load prints its refusal; no variables is said", async () => {
	const bad = project(`[${ORCHESTRATION}, { name: "youtrack", setup() {}, options: { tokenEnv: "ARTHUR_GITHUB_TOKEN" } }]`);
	const config = join(bad, "arthur.config.ts");
	assert.deepEqual(await configCheck(config, {}), { lines: [untyped(config), `${config}: youtrack.tokenEnv: expected ARTHUR_YOUTRACK_<WHAT>, got ARTHUR_GITHUB_TOKEN`], ok: false });
	assert.deepEqual(await configCheck(join(root, "nowhere.ts"), {}), { lines: [`config file not found: ${join(root, "nowhere.ts")}`], ok: false });
	const bare = join(project(`[${ORCHESTRATION}]`), "arthur.config.ts");
	assert.deepEqual(await configCheck(bare, {}), { lines: [untyped(bare), "no enabled plugin names an env variable"], ok: true });
});

test("every refusal of the host before setup fails the check, next to the env lines, and no setup runs", async () => {
	const check = async (plugins: string) => {
		const config = join(project(plugins), "arthur.config.ts");
		const { lines, ok } = await configCheck(config, {});
		return { lines: lines.map((line) => line.replace(`${config}: `, "").replace(config, "arthur.config.ts")), ok };
	};
	assert.deepEqual(await check(`[{ name: "telegram", setup() {}, options: {} }]`), {
		lines: ["plugins: orchestration is required and missing; add orchestration({ ... })", UNTYPED, "no enabled plugin names an env variable"],
		ok: false,
	});
	assert.deepEqual(await check(`[1, ${ORCHESTRATION}, { name: "telegram", options: { tokenEnv: "ARTHUR_TELEGRAM_TOKEN" } }]`), {
		lines: ["plugins[0]: expected a plugin such as youtrack({ ... }), got 1", "plugins[2]: telegram: expected a setup function, got nothing", UNTYPED, "no enabled plugin names an env variable"],
		ok: false,
	});
	assert.deepEqual(await check(`[${ORCHESTRATION}, { name: "telegram", setup() {} }, { name: "telegram", setup() {} }]`), {
		lines: ["plugins[2]: a second plugin named telegram; the first is plugins[1]", UNTYPED, "no enabled plugin names an env variable"],
		ok: false,
	});
	assert.deepEqual(await check(`[${ORCHESTRATION}, { name: "a", requires: ["b"], setup() {} }, { name: "b", requires: ["a"], setup() {} }]`), {
		lines: ["plugins: a cycle in requires or after: a -> b -> a", UNTYPED, "no enabled plugin names an env variable"],
		ok: false,
	});
	assert.deepEqual(await check(`[${ORCHESTRATION}, { name: "telegram", requires: ["machines"], setup() {}, check: (options) => [{ path: "chat", problem: "expected a number, got " + typeof options.chat }] }]`), {
		lines: ["telegram.chat: expected a number, got undefined", "telegram.requires: telegram requires machines, which is not in the plugin list", UNTYPED, "no enabled plugin names an env variable"],
		ok: false,
	});
	assert.deepEqual(await check(`[${ORCHESTRATION}, { name: "telegram", setup() {}, check() { throw new Error("no chat") } }]`), {
		lines: ["plugin telegram: check failed: no chat", UNTYPED, "no enabled plugin names an env variable"],
		ok: false,
	});
	assert.deepEqual(await check(`[{ name: "orchestration", setup() { throw new Error("setup ran") } }, { name: "telegram", setup() { throw new Error("setup ran") } }]`), {
		lines: [UNTYPED, "no enabled plugin names an env variable"],
		ok: true,
	});
});

test("a known secret never appears in an error, a warning or the check's output", async () => {
	const plugins = `[{ name: "youtrack", setup() {}, options: {
		urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN", otherEnv: "ARTHUR_YOUTRACK_OTHER", pastedEnv: "${SECRET}",
	} }]`;
	const envText = `ARTHUR_YOUTRACK_URL=${SECRET}\nARTHUR_YOUTRACK_URL="${SECRET}"\n${SECRET}\nARTHUR_YOUTRACK_OTHER='${SECRET}\nBAD-${SECRET}=x\n`;
	const config = join(project(plugins, envText), "arthur.config.ts");
	const shell = { ARTHUR_YOUTRACK_TOKEN: SECRET };
	const { lines } = await configCheck(config, shell);
	const check = checkEnv(await loadConfig(config), shell);
	let error = "";
	try {
		resolveEnv(await loadConfig(config), shell);
	} catch (thrown) {
		error = (thrown as Error).message;
	}
	// Every path that could leak was taken: a set value, a duplicate, a broken line, an unclosed quote, a pasted name.
	assert.equal(check.values.youtrack?.ARTHUR_YOUTRACK_URL, SECRET);
	assert.equal(check.warnings.length, 1);
	assert.equal(check.problems.length, 4);
	assert.match(error, /ARTHUR_YOUTRACK_OTHER is missing/);
	for (const text of [...lines, error, ...check.warnings, ...check.problems, JSON.stringify(check.variables)])
		assert.doesNotMatch(text, new RegExp(SECRET));
});

test("the arthur binary runs config check in the working folder: its lines, and the exit code", () => {
	const folder = project(PLUGINS, "ARTHUR_YOUTRACK_URL=x\n");
	const run = (args: string[], env: Record<string, string> = {}) =>
		spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, ...env } });
	const missing = run(["config", "check"]);
	assert.deepEqual([missing.status, missing.stdout], [1, `${untyped(join(folder, "arthur.config.ts"))}\nset     ARTHUR_YOUTRACK_URL (youtrack.instances[0].urlEnv)\nmissing ARTHUR_YOUTRACK_ACME_TOKEN (youtrack.instances[1].tokenEnv)\n`]);
	assert.equal(run(["config", "check"], { ARTHUR_YOUTRACK_ACME_TOKEN: SECRET }).status, 0);
	assert.doesNotMatch(run(["config", "check"], { ARTHUR_YOUTRACK_ACME_TOKEN: SECRET }).stdout, new RegExp(SECRET));
	assert.match(run(["config", "check", "--help"]).stdout, /^# arthur config check\n/);
	const wrong = run(["config"]);
	assert.deepEqual([wrong.status, wrong.stderr], [2, "usage: arthur config check\n"]);
});

test("the arthur binary's config check prints a refusal of a plugin's setup and fails; a refusal before setup is printed once", () => {
	const check = (plugins: string) => {
		const folder = project(plugins);
		const result = spawnSync(process.execPath, [CLI, "config", "check"], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
		return [result.status, result.stdout.replaceAll(`${join(folder, "arthur.config.ts")}: `, "").replaceAll(join(folder, "arthur.config.ts"), "arthur.config.ts")];
	};
	const none = `${UNTYPED}\nno enabled plugin names an env variable\n`;
	assert.deepEqual(check(`[{ name: "orchestration", setup(host) { host.commands.register({ name: "config", run() {} }) } }]`), [
		1,
		`plugin orchestration: setup failed: command config: registered by core and by orchestration; a command belongs to one plugin\n${none}`,
	]);
	assert.deepEqual(check(`[${ORCHESTRATION}, { name: "telegram", setup() { throw new Error("no bot token") } }]`), [1, `plugin telegram: setup failed: no bot token\n${none}`]);
	assert.deepEqual(check(`[1, ${ORCHESTRATION}]`), [1, `plugins[0]: expected a plugin such as youtrack({ ... }), got 1\n${none}`]);
	assert.deepEqual(check(`[{ name: "telegram", setup() { throw new Error("setup ran") } }]`), [1, `plugins: orchestration is required and missing; add orchestration({ ... })\n${none}`]);
	assert.deepEqual(check(`[${ORCHESTRATION}]`), [0, none]);
});

const MODULES = join(import.meta.dirname, "..", "..", "..", "node_modules");
// A project file whose two typed helpers each take one key, `url` and `app`, called with the keys given.
const pieces = (url: string, app: string) => `type Site = { readonly url: string };\ntype Piece = { readonly app: string };
const site = (value: Site) => value;\nconst piece = (value: Piece) => value;
export default { pieces: { uptime: site({ ${url}: "https://shop.example" }), dokploy: piece({ ${app}: "web" }) } };\n`;
// A folder with the repository's node_modules beside a config whose typed helper takes `{ chat }`, called as `bot`, and whose
// `projects` entry has the options `projects` (`<folder>` its path); a plugin `site` names `projects/other` in its `folders`.
function typed(bot: string, projects: string, files: Readonly<Record<string, string>>): string {
	const folder = join(root, String(++count));
	mkdirSync(folder);
	symlinkSync(MODULES, join(folder, "node_modules"));
	const plugins = `[${ORCHESTRATION}, { name: "site", setup() {}, options: { folders: ["<folder>/projects/other"] } }, { name: "projects", setup() {}, options: ${projects} }, ${bot}]`;
	const helper = `type Bot = { readonly chat: number };\nconst bot = (options: Bot) => ({ name: "telegram", setup() {}, options });\n`;
	writeFileSync(join(folder, "arthur.config.ts"), `${helper}export default { core: { envFile: "vars" }, plugins: ${plugins.replaceAll("<folder>", folder)} };\n`);
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(folder, path, ".."), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	return folder;
}
// The check's lines, a tsc error as its file and the key it names; and the binary's exit and the same lines.
const errors = (lines: readonly string[]) => lines.map((line) => line.replace(/^(\S+)\(\d+,\d+\): error TS\d+: .*?'(\w+)'.*$/, "$1 $2"));
async function both(folder: string) {
	const { lines, ok } = await configCheck(join(folder, "arthur.config.ts"), {});
	const run = spawnSync(process.execPath, [CLI, "config", "check"], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	return { lines: errors(lines), ok, binary: [run.status, ...errors(run.stdout.trim().split("\n"))] };
}
const NONE = "no enabled plugin names an env variable";

test("tsc's every error in the config and each listed project file is printed with its file and line, in one run, and fails the check", async () => {
	const folder = typed(`bot({ chta: 1 })`, `{ folders: ["<folder>/projects/landing", "<folder>/projects/empty", 7] }`, {
		"projects/landing/project.config.ts": pieces("ulr", "ap"),
		"projects/other/project.config.ts": pieces("ulr", "ap"),
		"projects/empty/notes.md": "",
	});
	const lines = ["arthur.config.ts chta", "projects/landing/project.config.ts ulr", "projects/landing/project.config.ts ap", NONE];
	assert.deepEqual(await both(folder), { lines, ok: false, binary: [1, ...lines] });
});

test("a correct config and project file pass; a disabled projects entry, or folders that are not a list, leave only the config checked", async () => {
	const right = typed(`bot({ chat: 1 })`, `{ folders: ["<folder>/projects/landing"] }`, { "projects/landing/project.config.ts": pieces("url", "app"), "projects/other/project.config.ts": pieces("ulr", "ap") });
	assert.deepEqual(await both(right), { lines: [NONE], ok: true, binary: [0, NONE] });
	for (const projects of [`{ enabled: false, folders: ["<folder>/projects/landing"] }`, `{ folders: "<folder>/projects/landing" }`]) {
		const folder = typed(`bot({ chta: 1 })`, projects, { "projects/landing/project.config.ts": pieces("ulr", "ap") });
		assert.deepEqual(await both(folder), { lines: ["arthur.config.ts chta", NONE], ok: false, binary: [1, "arthur.config.ts chta", NONE] });
	}
});

test("the tsc beside the config runs, and one that fails prints its own lines, or its exit when it prints none", async () => {
	for (const [code, lines] of [[`process.stderr.write("tsc: out of memory\\n"); process.exit(3)`, ["tsc: out of memory"]], ["process.exit(3)", ["types not checked: tsc exited with 3"]]] as const) {
		const folder = project(`[${ORCHESTRATION}]`);
		mkdirSync(join(folder, "node_modules", "typescript", "bin"), { recursive: true });
		writeFileSync(join(folder, "node_modules", "typescript", "package.json"), `{ "name": "typescript" }\n`);
		writeFileSync(join(folder, "node_modules", "typescript", "bin", "tsc"), `${code};\n`);
		assert.deepEqual(await configCheck(join(folder, "arthur.config.ts"), {}), { lines: [...lines, NONE], ok: false });
	}
});
