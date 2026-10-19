import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");

// Each requirement answers what `said` names; `log` is not needed: arthur setup sends nothing.
const NEED = `const need = (name, critical, said = "ok") => ({ name, check: () => said, costs: "no " + name, fix: "fix " + name, critical });`;

// The options files of the installed plugins, as each package publishes `./options`: a summary, a table, its tools.
const ORCHESTRATION = `export const summary = "the coordinator";
export const tools = [{ name: "tmux", version: ["tmux", "-V"] }];
export const table = { maxAgents: { about: "Jobs at once", default: "3", check: () => undefined }, coordinator: { about: "The coordinator", fields: { model: { about: "Its model", check: () => undefined }, thinking: { about: "Its thinking", check: () => undefined } } } };`;
const TELEGRAM = `export const summary = "the telegram channel";
export const tools = [{ name: "ffmpeg", version: ["ffmpeg", "-version"] }];
export const table = { botTokenEnv: { about: "The bot token's variable", check: () => undefined }, chatIdEnv: { about: "The chat's variable", check: () => undefined }, bots: { about: "The bots", check: () => undefined }, media: { about: "Media in", check: () => undefined } };`;
const VOICE = `export const summary = "local transcription of voice notes";
export const tools = [{ name: "ffmpeg", version: ["ffmpeg", "-version"] }, { name: "arthur-test-absent", version: ["arthur-test-absent", "--version"] }];
export const table = { model: { about: "A whisper model", default: '"small"', check: () => undefined }, threads: { about: "CPU threads", default: "4", check: () => undefined } };`;
const DOCKER = `export const summary = "labels and removes the Docker resources of each job";
export const tools = [{ name: "docker", version: ["docker", "--version"] }];
export const table = { buildCache: { about: "The cap of the build cache", check: () => undefined }, sweep: { about: "The sweep", fields: { at: { about: 'The daily sweep, "HH:MM"', check: () => undefined } } } };`;

// A config folder, `config` as its arthur.config.ts when given (HOME its home), `env` as its .env; the packages installed
// under node_modules/@arthur, each with its options file or none; and a bin first on PATH with each fake tool, systemctl
// answering as a user manager with the controllers delegated, and omp.
function project({ config, env, packages = {} }: { readonly config?: string; readonly env?: string; readonly packages?: Readonly<Record<string, string | undefined>> }) {
	const folder = temporaryFolder();
	const bin = join(folder, "bin");
	mkdirSync(bin);
	const tool = (name: string, script: string) => writeFileSync(join(bin, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
	tool("systemctl", `[ "$*" = "--user show-environment" ] && { echo HOME=/home/arthur; exit 0; }\n[ "$*" = "show user@${process.getuid?.()}.service -p DelegateControllers --value" ] && { echo 'cpu memory pids'; exit 0; }\nexit 1`);
	tool("omp", "echo omp/18.3.0");
	tool("tmux", "echo tmux 3.4");
	tool("ffmpeg", "echo 'ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023 the FFmpeg developers'");
	tool("docker", "echo 'Docker version 27.3.1, build ce12230'");
	if (config !== undefined) writeFileSync(join(folder, "arthur.config.ts"), config.replace("HOME", JSON.stringify(join(folder, ".arthur"))));
	if (env !== undefined) writeFileSync(join(folder, ".env"), env);
	for (const [name, options] of Object.entries(packages)) {
		const dir = join(folder, "node_modules", "@arthur", name);
		mkdirSync(dir, { recursive: true });
		const exports = options === undefined ? { ".": "./main.js" } : { ".": "./main.js", "./options": "./options.js" };
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `@arthur/${name}`, type: "module", exports }));
		if (options !== undefined) writeFileSync(join(dir, "options.js"), options);
	}
	const arthur = (args: readonly string[] = ["setup"], shell: Readonly<Record<string, string>> = {}) =>
		spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: [bin, process.env.PATH ?? ""].join(delimiter), ...shell }, timeout: 30_000 });
	return { folder, tool, arthur };
}

// The lines of one section of the report, from its title to the blank line after it, each trimmed and its columns, two
// spaces or more apart, joined by ` | `.
function section(output: string, title: string): string[] {
	const lines = output.split("\n");
	const start = lines.findIndex((line) => line.startsWith(title));
	assert.notEqual(start, -1, `no section ${title} in:\n${output}`);
	const end = lines.findIndex((line, index) => index > start && line === "");
	return lines.slice(start, end === -1 ? undefined : end).map((line) => line.trim().replace(/\s{2,}/g, " | "));
}

const FULL = `${NEED}
export default { core: { home: HOME, jobs: { budgetUsd: 3 } }, plugins: [
	{ name: "orchestration", options: { maxAgents: 2, coordinator: { model: "m" } }, doctor: () => [need("tmux", true)], setup() {} },
	{ name: "telegram", options: { botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID", bots: [1, 2], media: true },
		doctor: () => [need("ffmpeg", false, "missing: not found")], setup(host) { host.provide("doctor", () => [need("bot", false, "missing: unreachable")]); } },
	{ name: "voice", options: { enabled: false, modelEnv: "ARTHUR_VOICE_MODEL" }, doctor: () => [need("whisper", true, "missing: no whisper")], setup(host) { host.provide("doctor", () => [need("whisper", true, "missing: no whisper")]); } },
] };
`;
const INSTALLED = { orchestration: ORCHESTRATION, telegram: TELEGRAM, voice: VOICE, docker: DOCKER, broken: undefined };

test("arthur setup: the tools, the config, the requirements, what can still go in, and the next steps; no value is printed", () => {
	const { arthur } = project({ config: FULL, env: "ARTHUR_TELEGRAM_CHAT_ID=file-secret-456\n", packages: INSTALLED });
	const run = arthur(["setup"], { ARTHUR_TELEGRAM_BOT_TOKEN: "shell-secret-123" });
	assert.equal(run.stderr, "");
	const tools = section(run.stdout, "Tools");
	assert.deepEqual(
		tools.slice(1).map((row) => row.split(" | ")[0]),
		["git", "node", "omp", "ssh", "systemd-run", "tailscale", "tmux", "ffmpeg", "arthur-test-absent", "docker"],
		"the core's tools, then each plugin's: the config's order, then those not in it",
	);
	assert.deepEqual(tools.slice(3, 4).concat(tools.slice(7)), [
		"omp | omp/18.3.0 | core",
		"tmux | 3.4 | orchestration",
		"ffmpeg | 6.1.1-3ubuntu5 | telegram, voice (off)",
		"arthur-test-absent | not found | voice (off)",
		"docker | 27.3.1 | docker (not in the config)",
	]);
	assert.deepEqual(section(run.stdout, "Config"), [
		"Config: arthur.config.ts",
		"core | set: home, jobs.budgetUsd; not set: envFile, agent, timeZone, quietHours, jobs.timeoutMinutes, jobs.idleMinutes, jobs.cpu, jobs.memory, jobs.offlineGraceMinutes",
		"orchestration | on | set: maxAgents, coordinator.model; not set: coordinator.thinking",
		"telegram | on | set: botTokenEnv, chatIdEnv, bots (2), media",
		"env set | ARTHUR_TELEGRAM_BOT_TOKEN (telegram.botTokenEnv)",
		"env set | ARTHUR_TELEGRAM_CHAT_ID (telegram.chatIdEnv)",
		"voice | off (enabled: false)",
	]);
	assert.deepEqual(section(run.stdout, "Requirements").slice(6), [
		"orchestration tmux: ok",
		"telegram ffmpeg: missing: not found; without it: no ffmpeg; fix: fix ffmpeg",
		"telegram bot: missing: unreachable; without it: no bot; fix: fix bot",
	]);
	assert.deepEqual(section(run.stdout, "Can still go"), [
		"Can still go in arthur.config.ts",
		"voice (off): local transcription of voice notes",
		'model | A whisper model; default "small"',
		"threads | CPU threads; default 4",
		"broken (not in the config): no options table",
		"docker (not in the config): labels and removes the Docker resources of each job",
		"buildCache | The cap of the build cache",
		"sweep | The sweep",
		'sweep.at | The daily sweep, "HH:MM"',
	]);
	assert.deepEqual(section(run.stdout, "Next"), ["Next", "1. fix ffmpeg", "2. fix bot", "Run arthur setup again after each step."]);
	assert.equal(run.status, 0, "nothing in Next refuses the start");
	assert.ok(!run.stdout.includes("shell-secret-123") && !run.stdout.includes("file-secret-456"), "neither the shell's value nor the env file's");
});

test("arthur setup writes nothing beyond what arthur doctor does, and takes no argument", () => {
	const { folder, arthur } = project({ config: FULL, env: "", packages: INSTALLED });
	const tree = () => readdirSync(folder, { recursive: true }).map(String).sort();
	// The load every command runs makes each plugin's folder, and doctor's home check the home folder.
	arthur(["doctor"]);
	const before = tree();
	assert.equal(arthur().status, 1, "a missing variable");
	assert.deepEqual(tree(), before);
	const extra = arthur(["setup", "now"]);
	assert.deepEqual([extra.status, extra.stdout, extra.stderr], [2, "", "usage: arthur setup\n"]);
});

test("a missing variable is a step that refuses the start; each enabled plugin's own doctor is checked, what it checks in its setup waits; a disabled plugin's env is not read; the env file's warnings", () => {
	const { folder, arthur } = project({ config: FULL, env: "# none yet\nARTHUR_OTHER=a-secret-1\nARTHUR_OTHER=a-secret-2\n", packages: INSTALLED });
	const run = arthur(["setup"], { ARTHUR_TELEGRAM_BOT_TOKEN: "shell-secret-123" });
	assert.deepEqual(section(run.stdout, "Config").slice(4), [
		"env set | ARTHUR_TELEGRAM_BOT_TOKEN (telegram.botTokenEnv)",
		"env missing ARTHUR_TELEGRAM_CHAT_ID (telegram.chatIdEnv)",
		"voice | off (enabled: false)",
		`${join(folder, ".env")}: ARTHUR_OTHER is set on lines 2, 3; the last wins`,
	]);
	assert.deepEqual(section(run.stdout, "Requirements").slice(6), [
		"orchestration tmux: ok",
		"telegram ffmpeg: missing: not found; without it: no ffmpeg; fix: fix ffmpeg",
		"the requirements a plugin checks in its setup are not checked until what Config refuses is fixed",
	]);
	assert.deepEqual(section(run.stdout, "Next"), [
		"Next",
		"1. Set ARTHUR_TELEGRAM_CHAT_ID in .env (telegram.chatIdEnv), then arthur config check. Refuses the start.",
		"2. fix ffmpeg",
		"Run arthur setup again after each step.",
	]);
	assert.ok(!run.stdout.includes("ARTHUR_VOICE_MODEL"), "voice is off: its variable is neither listed nor a step");
	assert.ok(!/shell-secret-123|a-secret-/.test(run.stdout));
	assert.equal(run.status, 1);
});

test("Next: the config first, then the env, then critical requirements, then the rest; exit 1", () => {
	const config = `${NEED}
export default { core: { home: HOME, agent: { command: "arthur-test-no-agent" } }, plugins: [
	{ name: "orchestration", setup() {} },
	{ name: "telegram", requires: ["ghost"], options: { chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }, setup() {} },
] };
`;
	const { arthur, tool } = project({ config });
	tool("systemctl", `[ "$*" = "--user show-environment" ] && { echo HOME=/home/arthur; exit 0; }\necho pids`);
	const run = arthur();
	assert.match(section(run.stdout, "Config").at(-1) ?? "", /^refused: .*arthur\.config\.ts: telegram\.requires: telegram requires ghost, which is not in the plugin list$/);
	assert.deepEqual(section(run.stdout, "Next"), [
		"Next",
		"1. Fix what Config refuses above, then arthur config check. Refuses the start.",
		"2. Set ARTHUR_TELEGRAM_CHAT_ID in .env (telegram.chatIdEnv), then arthur config check. Refuses the start.",
		"3. install arthur-test-no-agent on the PATH arthur run has (docs/setup.md, steps 2 and 8). Refuses the start.",
		"4. delegate them (docs/setup.md, step 10), then reboot",
		"Run arthur setup again after each step.",
	]);
	assert.equal(run.status, 1);
});

test("a critical requirement missing is a step that refuses the start, before every other one; a fix said twice is one step", () => {
	const { arthur } = project({
		config: `${NEED}\nexport default { core: { home: HOME }, plugins: [{ name: "orchestration", setup(host) { host.provide("doctor", () => [need("soft", false, "missing: x"), need("tmux", true, "missing: no tmux"), { ...need("again", false, "missing: y"), fix: "fix soft" }]); } }] };\n`,
	});
	const run = arthur();
	assert.deepEqual(section(run.stdout, "Next"), ["Next", "1. fix tmux. Refuses the start.", "2. fix soft", "Run arthur setup again after each step."]);
	assert.equal(run.status, 1);
});

test("nothing missing: Next says nothing, and exit 0", () => {
	const { arthur } = project({ config: `${NEED}\nexport default { core: { home: HOME }, plugins: [{ name: "orchestration", setup(host) { host.provide("doctor", () => [need("tmux", true)]); } }] };\n` });
	const run = arthur();
	assert.deepEqual(section(run.stdout, "Can still go"), ["Can still go in arthur.config.ts", "nothing"]);
	assert.deepEqual([run.status, run.stdout.split("\n").slice(-3)], [0, ["Next", "  nothing", ""]]);
});

test("no config: Config says so, Requirements are skipped, every installed plugin can go in, and Next writes it first", () => {
	const { arthur } = project({ packages: { docker: DOCKER } });
	const run = arthur();
	assert.deepEqual(section(run.stdout, "Tools").at(-1), "docker | 27.3.1 | docker (not in the config)");
	assert.deepEqual(section(run.stdout, "Config"), ["Config: no arthur.config.ts"]);
	assert.deepEqual(section(run.stdout, "Requirements"), ["Requirements (arthur doctor)", "skipped: no arthur.config.ts"]);
	assert.deepEqual(section(run.stdout, "Can still go").slice(0, 2), ["Can still go in arthur.config.ts", "docker (not in the config): labels and removes the Docker resources of each job"]);
	assert.deepEqual(section(run.stdout, "Next"), ["Next", "1. Write arthur.config.ts (docs/setup.md, step 5), then arthur config check. Refuses the start.", "Run arthur setup again after each step."]);
	assert.equal(run.status, 1);
});

test("a config that does not load: its refusal under Config, Requirements skipped, no plugin marked, exit 1", () => {
	const { arthur } = project({ config: "export default {\n", packages: { docker: DOCKER } });
	const run = arthur();
	assert.deepEqual(section(run.stdout, "Tools").at(-1), "docker | 27.3.1 | docker", "the config's plugins are unknown");
	assert.match(section(run.stdout, "Config")[1] ?? "", /^refused: config file .*arthur\.config\.ts failed to load: /);
	assert.deepEqual(section(run.stdout, "Requirements"), ["Requirements (arthur doctor)", "skipped: arthur.config.ts does not load"]);
	assert.deepEqual(section(run.stdout, "Can still go"), ["Can still go in arthur.config.ts", "skipped: arthur.config.ts does not load"]);
	assert.deepEqual(section(run.stdout, "Next"), ["Next", "1. Fix what Config refuses above, then arthur config check. Refuses the start.", "Run arthur setup again after each step."]);
	assert.equal(run.status, 1);
});

test("a plugin's setup that throws is a refusal under Config, after the checks before setup passed", () => {
	const { arthur } = project({ config: 'export default { core: { home: HOME }, plugins: [{ name: "orchestration", setup() { throw new Error("no socket"); } }] };\n' });
	const run = arthur();
	assert.deepEqual(section(run.stdout, "Config").slice(-1), ["refused: plugin orchestration: setup failed: no socket"]);
	assert.equal(run.status, 1);
});

test("a tool's version: not found, the last line of one that fails, nothing printed, and one that hangs is cut after 5 s", () => {
	const tools = ["hangs", "fails", "silent", "stderr"].map((name) => `{ name: "${name}", version: ["${name}"] }`).join(", ");
	const { arthur, tool } = project({ packages: { slow: `export const summary = "s";\nexport const tools = [${tools}, { name: "gone", version: ["arthur-test-gone"] }];\nexport const table = {};\n` } });
	tool("hangs", "sleep 60");
	tool("fails", "echo partial\necho 'cannot read the licence' >&2\nexit 3");
	tool("silent", "exit 0");
	tool("stderr", "echo 'OpenSSH_9.6p1 Ubuntu-3ubuntu13.5, OpenSSL 3.0.13' >&2");
	const started = Date.now();
	const run = arthur();
	assert.ok(Date.now() - started < 20_000, "the hanging tool does not hold the report");
	assert.deepEqual(section(run.stdout, "Tools").slice(-5), [
		"hangs | no version: cut after 5 s | slow (not in the config)",
		"fails | no version: cannot read the licence | slow (not in the config)",
		"silent | no version: it printed nothing | slow (not in the config)",
		"stderr | OpenSSH_9.6p1 | slow (not in the config)",
		"gone | not found | slow (not in the config)",
	]);
	assert.deepEqual(section(run.stdout, "Can still go").slice(1), ["slow (not in the config): s"], "every other section still printed");
});
