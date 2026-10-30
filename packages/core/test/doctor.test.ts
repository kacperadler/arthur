import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { delimiter, join } from "node:path";
import { type TestContext, test } from "node:test";
import { doctor } from "../src/doctor.ts";
import { noSandbox } from "../src/job-sandbox.ts";
import { coreRequirements } from "../src/requirements.ts";
import { temporaryFolder, until } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const USER = userInfo().username;
const UID = process.getuid?.();
const ROOT = UID === 0;
const PATH = process.env.PATH ?? "";

// `systemctl` as systemd 255 answers on a host whose user manager has the CPU and memory controllers delegated; `controllers`
// replaces what it has, and `manager: false` leaves no user manager to reach, as in a container.
function systemctl(folder: string, { manager = true, controllers = "cpu memory pids" } = {}): void {
	const script = manager
		? `[ "$*" = "--user show-environment" ] && { echo HOME=/home/arthur; exit 0; }\n[ "$*" = "show user@${UID}.service -p DelegateControllers --value" ] && { echo '${controllers}'; exit 0; }\nexit 1`
		: 'echo "Failed to connect to bus: No medium found" >&2\nexit 1';
	writeFileSync(join(folder, "systemctl"), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
}

// Each requirement answers what the file of its name beside the config holds, `ok` without one. `log.txt` gets each start,
// each `doctor` event and each notice, as plugins see them.
const CONFIG = `import { appendFileSync, existsSync, readFileSync } from "node:fs";
const file = (name) => new URL("./" + name, import.meta.url);
const said = (name) => (existsSync(file(name)) ? readFileSync(file(name), "utf8") : "ok");
const log = (line) => appendFileSync(file("log.txt"), line + "\\n");
const need = (name, critical) => ({ name, check: () => said(name), costs: "no " + name, fix: "fix " + name, critical });
export default { core: { home: HOME }, plugins: [
	{ name: "orchestration", doctor: () => [need("tmux", true)], setup(host) {
		host.events.on("doctor", (event) => log("doctor " + JSON.stringify(event.data)));
		host.events.on("notice", (event) => log("notice " + JSON.stringify(event.data.text)));
	}, start() { log("start orchestration"); } },
	{ name: "channel", doctor: async () => [need("token", false)], setup(host) {
		host.provide("doctor", async () => [need("socket", true), { name: "bot", check: async () => "ok (@arthur_bot)", costs: "-", fix: "-" }]);
	}, start() { log("start channel"); } },
	{ name: "broken", setup(host) {
		host.provide("doctor", () => [{ name: "throws", check() { throw new Error("boom\\nat line 2"); }, costs: "c", fix: "f" }, { name: "odd", check: () => "fine", costs: "c", fix: "f" }]);
	} },
	{ name: "noisy", setup(host) { host.provide("doctor", () => { throw new Error("no list today"); }); } },
	{ name: "shapeless", setup(host) { host.provide("doctor", () => "a string"); } },
	{ name: "off", options: { enabled: false }, doctor: () => [need("never", true)], setup(host) { host.provide("doctor", () => [need("never", true)]); } },
] };
`;

// A config folder with CONFIG, its home `home` (default `<folder>/.arthur`), and a `bin` first on PATH with `systemctl`.
function project(home?: string) {
	const folder = temporaryFolder();
	const bin = join(folder, "bin");
	mkdirSync(bin);
	systemctl(bin);
	writeFileSync(join(folder, "arthur.config.ts"), CONFIG.replace("HOME", JSON.stringify(home ?? join(folder, ".arthur"))));
	const say = (name: string, text?: string) => (text === undefined ? rmSync(join(folder, name), { force: true }) : writeFileSync(join(folder, name), text));
	const log = () => (existsSync(join(folder, "log.txt")) ? readFileSync(join(folder, "log.txt"), "utf8") : "");
	const env = { PATH: [bin, PATH].join(delimiter), XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? "" };
	// Cut after 30 s: a refused `arthur run` ends at once, one that starts stays until its signal.
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env, timeout: 30_000 });
	return { folder, home: home ?? join(folder, ".arthur"), say, log, arthur, env };
}

const SANDBOX_FIX = "without it: every job fails at its start, failed: no sandbox; fix: run Arthur on Linux 5.13 or later with python3 (docs/deploy.md), or set core.jobs.unsandboxed: true in arthur.config.ts to run jobs without one, with the writes of your user";
// This host's sandbox line: `ok` where the sandbox sets up, else missing with why.
const sandbox = noSandbox([], "sh");
const CORE = ["core git: ok", "core node: ok", "core omp: ok", "core home: ok", "core controllers: ok", "core env: ok", "core env ignored: ok", sandbox === undefined ? "core sandbox: ok" : `core sandbox: missing: no sandbox: ${sandbox}; ${SANDBOX_FIX}`];
const REST = [
	"orchestration tmux: ok",
	"channel token: ok",
	"channel socket: ok",
	"channel bot: ok (@arthur_bot)",
	"broken throws: missing: check failed: boom; without it: c; fix: f",
	'broken odd: missing: check failed: it answered "fine", neither ok nor missing; without it: c; fix: f',
	"noisy requirements: missing: check failed: no list today; without it: what noisy needs is not checked; fix: plugin noisy's doctor answer",
	"shapeless requirements: missing: check failed: it answered no list of requirements; without it: what shapeless needs is not checked; fix: plugin shapeless's doctor answer",
];
const TMUX = "orchestration tmux: missing: tmux not found on PATH; without it: no tmux; fix: fix tmux";
const SOCKET = "channel socket: missing: no socket; without it: no socket; fix: fix socket";
const TOKEN = "channel token: missing: no TOKEN set; without it: no token; fix: fix token";

test("arthur doctor: one line per requirement, the core's then each enabled plugin's in setup order, its own doctor's first; a throw costs its line only; exit 1 only on a critical miss", () => {
	const { say, arthur, home } = project();
	const all = arthur("doctor");
	assert.deepEqual([all.status, all.stdout, all.stderr], [0, [...CORE, ...REST, ""].join("\n"), ""], "a throwing check is not critical: its line is missing, the exit code 0");
	say("token", "missing: no TOKEN set");
	const token = arthur("doctor");
	assert.deepEqual([token.status, token.stdout.split("\n")[CORE.length + 1]], [0, TOKEN], "only a non-critical miss: exit 0");
	say("tmux", "missing: tmux not found on PATH");
	const tmux = arthur("doctor");
	assert.deepEqual([tmux.status, tmux.stdout.split("\n")[CORE.length]], [1, TMUX], "one critical miss: exit 1");
	assert.equal(tmux.stdout.split("\n").length, CORE.length + REST.length + 1, "every line is still printed");
	assert.ok(!existsSync(join(home, "events.jsonl")) && !existsSync(join(home, "doctor.json")), "arthur doctor sends nothing and records nothing");
	assert.deepEqual([arthur("doctor", "now").status, arthur("doctor", "now").stderr], [2, "usage: arthur doctor\n"]);
});

test("arthur doctor while the load refuses, a variable missing: the core's lines and each enabled plugin's own doctor, then why the rest is not checked", () => {
	const { folder, arthur, log } = project();
	writeFileSync(
		join(folder, "arthur.config.ts"),
		`import { appendFileSync } from "node:fs";
const need = (name, critical) => ({ name, check: () => "missing: no " + name, costs: "no " + name, fix: "install " + name, critical });
export default { plugins: [
	{ name: "orchestration", doctor: () => [need("tmux", true)], setup(host) { appendFileSync(new URL("./log.txt", import.meta.url), "setup\\n"); host.provide("doctor", () => [need("socket", true)]); } },
	{ name: "telegram", options: { enabled: true, botTokenEnv: "ARTHUR_DOCTOR_TEST_TOKEN" }, doctor: async (options, core) => [need(\`ffmpeg \${Object.keys(options)} \${core.agent.command}\`, false)], setup() {} },
	{ name: "broken", doctor() { throw new Error("no list today"); }, setup() {} },
	{ name: "off", options: { enabled: false }, doctor: () => [need("never", true)], setup() {} },
] };
`,
	);
	const missing = arthur("doctor");
	assert.deepEqual([missing.status, missing.stdout], [
		1,
		[
			...CORE,
			"orchestration tmux: missing: no tmux; without it: no tmux; fix: install tmux",
			"telegram ffmpeg botTokenEnv omp: missing: no ffmpeg botTokenEnv omp; without it: no ffmpeg botTokenEnv omp; fix: install ffmpeg botTokenEnv omp",
			"broken requirements: missing: check failed: no list today; without it: what broken needs is not checked; fix: plugin broken's doctor answer",
			"",
		].join("\n"),
	]);
	assert.match(missing.stderr, /^arthur doctor: the requirements a plugin checks in its setup are not checked: arthur\.config\.ts did not load:\n.*ARTHUR_DOCTOR_TEST_TOKEN/);
	assert.equal(log(), "", "no plugin's setup ran");
});

test("arthur doctor when a plugin's setup fails: the core's lines, then why the rest is not checked; a config that does not load, the reason alone", () => {
	const { folder, arthur } = project();
	writeFileSync(join(folder, "arthur.config.ts"), 'export default { plugins: [{ name: "orchestration", setup() { throw new Error("no socket"); } }] };\n');
	const failed = arthur("doctor");
	assert.deepEqual([failed.status, failed.stdout], [1, [...CORE, ""].join("\n")]);
	assert.equal(failed.stderr, "arthur doctor: the requirements a plugin checks in its setup are not checked: arthur.config.ts did not load:\nplugin orchestration: setup failed: no socket\n");
	writeFileSync(join(folder, "arthur.config.ts"), "export default {\n");
	const broken = arthur("doctor");
	assert.deepEqual([broken.status, broken.stdout], [1, ""]);
	assert.match(broken.stderr, /^arthur doctor: arthur\.config\.ts did not load:\n/);
});

test("the core's requirements: git, Node 24, the agent, a writable home, critical; the controllers delegated, the env file outside the agents' folders and the sandbox (ok with core.jobs.unsandboxed on), not; each missing with its reason and fix", async (t) => {
	t.after(() => void (process.env.PATH = PATH));
	const bin = temporaryFolder();
	symlinkSync("/bin/sh", join(bin, "sh"));
	systemctl(bin, { controllers: "memory pids" });
	process.env.PATH = bin;
	const home = join(temporaryFolder(), "home");
	const why = process.platform === "linux" ? "python3: spawnSync python3 ENOENT" : `${process.platform} has no Landlock`;
	const lines = await doctor(coreRequirements({ home, envFile: "/elsewhere/.env", agent: { command: "omp" }, jobs: { unsandboxed: false } }, () => [home], "22.11.0", {}), []);
	assert.deepEqual(
		lines.map((line) => [line.text, line.critical]),
		[
			["core git: missing: git not found on PATH; without it: no worktree, so no job, and no ticket board; fix: sudo apt-get install -y git (docs/setup.md, step 2)", true],
			["core node: missing: Node 22.11.0 runs arthur; it needs 24 or newer; without it: Arthur's code may not run; fix: nvm install 24 && nvm alias default 24, then write ~/.config/arthur.env again (docs/setup.md, steps 2 and 8)", true],
			["core omp: missing: omp not found on PATH; without it: no coordinator and no job; fix: install omp on the PATH arthur run has (docs/setup.md, steps 2 and 8)", true],
			["core home: ok", false],
			['core controllers: missing: the user manager has the controllers "memory pids", not cpu and memory; without it: jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end; fix: delegate them (docs/setup.md, step 10), then reboot', false],
			["core env: ok", false],
			["core env ignored: ok", false],
			[`core sandbox: missing: no sandbox: ${why}; ${SANDBOX_FIX}`, false],
		],
	);
	assert.ok(existsSync(home), "a home that is not there yet is made");
	systemctl(bin, { manager: false });
	const agent = join(bin, "my-agent");
	writeFileSync(agent, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	const [, node, found, , controllers] = await doctor(coreRequirements({ home, envFile: "/elsewhere/.env", agent: { command: agent }, jobs: { unsandboxed: false } }, () => [], "24.0.0"), []);
	assert.deepEqual([node?.text, found?.text], ["core node: ok", "core my-agent: ok"], "Node 24.0.0 is enough; an agent by its path is found, never run");
	assert.equal(
		controllers?.text,
		`core controllers: missing: no systemd user manager, so no job scope and no user service (Failed to connect to bus: No medium found); without it: jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end; fix: sudo loginctl enable-linger ${USER}; none on macOS or in a container, where jobs run bare`,
	);
	assert.equal(controllers?.critical, false);
	const [opted] = await doctor(coreRequirements({ home, envFile: "/elsewhere/.env", agent: { command: agent }, jobs: { unsandboxed: true } }, () => [], "24.0.0").filter((requirement) => requirement.name === "sandbox"), []);
	assert.deepEqual([opted?.text, opted?.missing], [`core sandbox: ok (no sandbox: ${why}; core.jobs.unsandboxed is on, so a job writes wherever ${USER} can)`, false], "opted in, a host without the sandbox is no miss");
});

test("the env file inside the config's folder or a project's checkout is a miss, not critical, naming that folder; outside every one it is ok", async () => {
	const line = async (envFile: string, folders: readonly string[]) => {
		const [env] = coreRequirements({ home: "/unused", envFile, agent: { command: "omp" }, jobs: { unsandboxed: false } }, () => folders).filter((requirement) => requirement.name === "env");
		const [found] = await doctor(env === undefined ? [] : [env], []);
		return [found?.text, found?.critical];
	};
	const fix = "without it: a recursive search the coordinator or a job runs there prints its values into the agent's transcript, which the model provider keeps; fix: move it to ~/.config/arthur/.env and remove core.envFile from arthur.config.ts (docs/setup.md, step 6)";
	assert.deepEqual(await line("/srv/arthur/.env", ["/srv/arthur", "/srv/shop"]), [`core env: missing: the env file /srv/arthur/.env lies inside /srv/arthur; ${fix}`, false]);
	assert.deepEqual(await line("/srv/shop/deploy/.env", ["/srv/arthur", "/srv/shop"]), [`core env: missing: the env file /srv/shop/deploy/.env lies inside /srv/shop; ${fix}`, false]);
	assert.deepEqual(await line("/srv/arthur/..env", ["/srv/arthur"]), [`core env: missing: the env file /srv/arthur/..env lies inside /srv/arthur; ${fix}`, false], "a name that starts with two dots is still inside");
	assert.deepEqual(await line("/home/arthur/.config/arthur/.env", ["/home/arthur/arthur", "/srv/shop"]), ["core env: ok", false]);
	assert.deepEqual(await line("/srv/arthur-env/.env", ["/srv/arthur"]), ["core env: ok", false], "a sibling folder whose name starts with the config folder's is outside it");
	assert.deepEqual(await line("/srv/.env", ["/srv/arthur"]), ["core env: ok", false], "the folder above is outside");
});

test("arthur doctor: the env file by default lies outside; set beside the config, or in a project's checkout the projects provider lists, it is a miss", () => {
	const { folder, arthur } = project();
	const shop = temporaryFolder();
	const config = (core: string) =>
		writeFileSync(join(folder, "arthur.config.ts"), `export default { core: ${core}, plugins: [{ name: "orchestration", setup(host) { host.provide("projects", () => [{ name: "shop", path: ${JSON.stringify(shop)}, prefix: "SH" }]); } }] };\n`);
	const env = () => arthur("doctor").stdout.split("\n").find((text) => text.startsWith("core env: "));
	config("{}");
	assert.equal(env(), "core env: ok");
	config('{ envFile: ".env" }');
	assert.match(env() ?? "", new RegExp(`^core env: missing: the env file ${join(folder, ".env")} lies inside ${folder}; `));
	config(`{ envFile: ${JSON.stringify(join(shop, ".env"))} }`);
	assert.match(env() ?? "", new RegExp(`^core env: missing: the env file ${join(shop, ".env")} lies inside ${shop}; `));
});

test("arthur doctor: an env file in a Git checkout that does not ignore it is a critical miss; ignored, ok; outside any checkout, ok", () => {
	const { folder, arthur } = project();
	writeFileSync(join(folder, "arthur.config.ts"), 'export default { core: { envFile: "env" }, plugins: [{ name: "orchestration", setup() {} }] };\n');
	const git = (...args: string[]) => assert.equal(spawnSync("git", ["-C", folder, ...args], { encoding: "utf8" }).status, 0, args.join(" "));
	const line = () => {
		const run = arthur("doctor");
		return [run.status, run.stdout.split("\n").find((text) => text.startsWith("core env ignored: "))];
	};
	assert.deepEqual(line(), [0, "core env ignored: ok"], "outside any checkout");
	git("init", "-q");
	const missing = `core env ignored: missing: the env file ${join(folder, "env")} lies in the Git checkout ${folder}, which does not ignore it; without it: a commit there takes its values into the repository, and a push sends them to every clone; fix: printf '\\n%s\\n' 'env' >> '${join(folder, ".gitignore")}', or move it to ~/.config/arthur/.env and remove core.envFile from arthur.config.ts (docs/setup.md, step 6)`;
	assert.deepEqual(line(), [1, missing], "not ignored, even before the file exists");
	writeFileSync(join(folder, ".gitignore"), ".env\n");
	assert.deepEqual(line(), [1, missing], "a .gitignore that ignores .env only");
	writeFileSync(join(folder, ".gitignore"), "env\n");
	assert.deepEqual(line(), [0, "core env ignored: ok"]);
	writeFileSync(join(folder, "env"), "ARTHUR_X=1\n");
	git("add", "-f", "env");
	git("-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "env");
	const tracked = `core env ignored: missing: the env file ${join(folder, "env")} is tracked by the Git checkout ${folder}, so no .gitignore line ignores it, and every commit that holds it keeps its values; without it: a commit there takes its values into the repository, and a push sends them to every clone; fix: git -C '${folder}' rm --cached -- 'env', commit, and rotate every value it held: the history keeps them`;
	assert.deepEqual(line(), [1, tracked], "a file Git already tracks, though .gitignore names it");
	git("rm", "--cached", "--", "env");
	assert.deepEqual(line(), [0, "core env ignored: ok"], "untracked again, the .gitignore line holds");
	writeFileSync(join(folder, ".gitignore"), "");
	assert.deepEqual(line(), [1, missing], "untracked and not ignored: the .gitignore fix again");
	mkdirSync(join(folder, "secrets"));
	writeFileSync(join(folder, "arthur.config.ts"), 'export default { core: { envFile: "secrets/vars" }, plugins: [{ name: "orchestration", setup() {} }] };\n');
	assert.match(String(line()[1]), new RegExp(`^core env ignored: missing: the env file ${join(folder, "secrets", "vars")} lies in the Git checkout ${folder}, `), "in a folder below the checkout's top");
	writeFileSync(join(folder, ".gitignore"), "/secrets/\n");
	assert.deepEqual(line(), [0, "core env ignored: ok"], "a pattern at the checkout's top that ignores its folder");
});

test("each env file fix runs as printed, in a folder with a space, for a name with a quote or what a .gitignore line reads as its own syntax, and gives ok", async () => {
	const folder = join(temporaryFolder(), "my 'secret' files");
	mkdirSync(folder);
	const git = (...args: string[]) => assert.equal(spawnSync("git", ["-C", folder, ...args], { encoding: "utf8" }).status, 0, args.join(" "));
	git("init", "-q");
	for (const name of ["my env", "it's", "#env", "!env", "env ", "e[nv]", "e\\nv"]) {
		const envFile = join(folder, name);
		writeFileSync(envFile, "ARTHUR_X=1\n");
		const line = async () => (await doctor(coreRequirements({ home: "/unused", envFile, agent: { command: "omp" }, jobs: { unsandboxed: false } }, () => []).filter((requirement) => requirement.name === "env ignored"), []))[0]?.text ?? "";
		// Pasted as printed: the command before `, commit` or `, or move`, run by sh; then the check again.
		const fixed = async (kind: string) => {
			const command = /; fix: (.+?), (?:commit|or move)/.exec(await line())?.[1];
			assert.ok(command !== undefined, `${name}: a ${kind} fix is printed`);
			const run = spawnSync("sh", ["-c", command], { encoding: "utf8" });
			assert.equal(run.status, 0, `${name}: ${command}: ${run.stderr}`);
			return line();
		};
		assert.equal(await fixed(".gitignore"), "core env ignored: ok", `${name}: the .gitignore fix`);
		git("add", "-f", "--", name);
		git("-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", name);
		assert.match(await line(), /is tracked by/, `${name}: committed`);
		assert.equal(await fixed("tracked"), "core env ignored: ok", `${name}: the tracked fix`);
	}
});

test("the env file's own folder decides whether it lies in a Git checkout, not the folder arthur runs in", async (t) => {
	const cwd = process.cwd();
	t.after(() => process.chdir(cwd));
	const [repository, plain] = [temporaryFolder(), temporaryFolder()];
	assert.equal(spawnSync("git", ["-C", repository, "init", "-q"]).status, 0);
	const line = async (envFile: string) => {
		const ignored = coreRequirements({ home: "/unused", envFile, agent: { command: "omp" }, jobs: { unsandboxed: false } }, () => []).filter((requirement) => requirement.name === "env ignored");
		return (await doctor(ignored, []))[0]?.text;
	};
	process.chdir(plain);
	assert.match((await line(join(repository, "env"))) ?? "", new RegExp(`^core env ignored: missing: the env file ${join(repository, "env")} lies in the Git checkout ${repository}, `), "run outside any checkout, the file in one");
	process.chdir(repository);
	assert.equal(await line(join(plain, "env")), "core env ignored: ok", "run in a checkout, the file outside every one");
});

test("arthur doctor while the load refuses, a variable missing: the core's own lines still warn of an env file beside the config", () => {
	const { folder, arthur } = project();
	writeFileSync(join(folder, "arthur.config.ts"), 'export default { core: { envFile: ".env" }, plugins: [{ name: "orchestration", setup() {} }, { name: "telegram", options: { botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN" }, setup() {} }] };\n');
	const run = arthur("doctor");
	assert.match(run.stdout, new RegExp(`^core env: missing: the env file ${join(folder, ".env")} lies inside ${folder}; `, "m"));
	assert.match(run.stderr, /^arthur doctor: the requirements a plugin checks in its setup are not checked: .*\n[\s\S]*ARTHUR_TELEGRAM_BOT_TOKEN/);
});

test("arthur doctor: a model provider's key in Arthur's environment is one miss each, not critical, naming the variable, never its value; none set, or set empty, no line", () => {
	const { folder, env } = project();
	const doctorWith = (extra: Readonly<Record<string, string>>) => spawnSync(process.execPath, [CLI, "doctor"], { cwd: folder, encoding: "utf8", env: { ...env, ...extra }, timeout: 30_000 });
	const secret = "sk-ant-api03-not-a-real-key";
	const one = doctorWith({ ANTHROPIC_API_KEY: secret, ARTHUR_UNRELATED_KEY: secret });
	assert.deepEqual([one.status, one.stdout.split("\n").slice(0, CORE.length + 1)], [
		0,
		[
			...CORE,
			"core provider key ANTHROPIC_API_KEY: missing: ANTHROPIC_API_KEY is set in Arthur's environment, which every job and each of its tool calls inherits; without it: a program a job runs, or text from outside that steers it, can read the key and send it anywhere; fix: unset ANTHROPIC_API_KEY where arthur run starts; log omp in with its own login instead (omp login, kept in ~/.omp), or give a job its key through the models plugin's prepare (keyEnv, packages/models/docs/models.md)",
		],
	]);
	assert.ok(!one.stdout.includes(secret) && !one.stderr.includes(secret), "the key's value is never printed");
	const two = doctorWith({ OPENAI_API_KEY: secret, GEMINI_API_KEY: secret });
	assert.deepEqual(two.stdout.split("\n").filter((line) => line.startsWith("core provider key ")).map((line) => line.split(":")[0]), ["core provider key OPENAI_API_KEY", "core provider key GEMINI_API_KEY"]);
	for (const extra of [{}, { ANTHROPIC_API_KEY: "" }] as Record<string, string>[]) assert.deepEqual(doctorWith(extra).stdout.split("\n").filter((line) => line.includes("provider key")), [], JSON.stringify(extra));
});

test("a home that is not writable is a critical miss", { skip: ROOT && "root writes anywhere" }, async (t) => {
	const parent = temporaryFolder();
	chmodSync(parent, 0o555);
	t.after(() => chmodSync(parent, 0o755));
	const [, , , home] = await doctor(coreRequirements({ home: join(parent, "home"), envFile: "/elsewhere/.env", agent: { command: "omp" }, jobs: { unsandboxed: false } }, () => []), []);
	assert.equal(home?.text, `core home: missing: ${join(parent, "home")} is not writable (EACCES); without it: nothing is kept: no job record, no event log, no plugin's state; fix: sudo chown -R ${USER} ${join(parent, "home")}, or set core.home in arthur.config.ts to a folder ${USER} can write`);
	assert.equal(home?.critical, true);
});

test("under umask 022 the home is its user's alone: a new one is made 0700, one made 0755 earlier is 0700 once the check or arthur doctor ran", async (t) => {
	const mask = process.umask(0o022);
	t.after(() => process.umask(mask));
	const mode = (path: string) => statSync(path).mode & 0o777;
	const made = join(temporaryFolder(), "home");
	const earlier = join(temporaryFolder(), "home");
	mkdirSync(earlier);
	assert.equal(mode(earlier), 0o755, "the umask in force");
	for (const home of [made, earlier]) {
		const [, , , line] = await doctor(coreRequirements({ home, envFile: "/elsewhere/.env", agent: { command: "omp" }, jobs: { unsandboxed: false } }, () => []), []);
		assert.deepEqual([line?.text, mode(home)], ["core home: ok", 0o700], home);
	}
	const { home, arthur } = project();
	mkdirSync(home);
	assert.equal(arthur("doctor").status, 0);
	assert.equal(mode(home), 0o700, "arthur doctor");
});

test("a check that hangs is cut after 10 s, every check at once, and the others answer", async () => {
	const hang = (name: string) => ({ name, check: () => new Promise<string>(() => {}), costs: "c", fix: "f", critical: true });
	const started = Date.now();
	const lines = await doctor([], [{ plugin: "slow", value: [hang("one"), hang("two"), { name: "quick", check: () => "ok", costs: "c", fix: "f" }] }]);
	const took = Date.now() - started;
	assert.deepEqual(
		lines.map((line) => [line.text, line.critical]),
		[
			["slow one: missing: check timed out after 10 s; without it: c; fix: f", true],
			["slow two: missing: check timed out after 10 s; without it: c; fix: f", true],
			["slow quick: ok", false],
		],
	);
	// The cut runs on Node's timer clock, `took` on the wall clock, which can run a little slow (GitHub measured 9999 ms).
	assert.ok(took >= 9_950 && took < 15_000, `took ${took} ms`);
});

// `arthur run` in the background, until the test ends.
function start(t: TestContext, folder: string, env: Readonly<Record<string, string>>): { readonly child: ChildProcess; readonly output: () => string; readonly ended: Promise<number | null> } {
	const child = spawn(process.execPath, [CLI, "run"], { cwd: folder, env });
	let stdout = "";
	child.stdout.on("data", (chunk) => (stdout += chunk));
	t.after(() => child.kill("SIGKILL"));
	return { child, output: () => stdout, ended: once(child, "close").then(([status]) => status as number | null) };
}

const REFUSED = "arthur run: refused: a critical requirement is missing; fix each line above, then run arthur doctor\n";
const BROKEN = REST.filter((line) => line.includes(": missing: ")).map((line) => `arthur run: ${line}\n`).join("");
const notice = (...lines: string[]) => `notice ${JSON.stringify([`arthur run refused on ${hostname()}: a critical requirement is missing`, ...lines].join("\n"))}\n`;
const MISSING = REST.filter((line) => line.includes(": missing: "));

test("arthur run: a critical miss refuses the start before any plugin's, printed each time and sent once a day, unless a line changed or came back", () => {
	const { home, say, log, arthur } = project();
	say("tmux", "missing: tmux not found on PATH");
	const first = arthur("run");
	assert.deepEqual([first.status, first.stdout], [1, ""]);
	assert.equal(first.stderr, `arthur run: ${TMUX}\n${BROKEN}${REFUSED}`);
	assert.equal(log(), notice(TMUX, ...MISSING), "no plugin started; one notice with every missing line");
	assert.ok(!existsSync(join(home, "run.pid")));

	const again = arthur("run");
	assert.deepEqual([again.status, again.stderr], [1, first.stderr], "printed again, so the journal shows it");
	assert.equal(log(), notice(TMUX, ...MISSING), "the service starting it again every 5 s sends its refusal once");

	say("tmux");
	say("socket", "missing: no socket");
	arthur("run");
	assert.equal(log().split("\n").at(-2), notice(SOCKET).trim(), "only the new line; tmux, fixed, leaves the record");
	say("tmux", "missing: tmux not found on PATH");
	arthur("run");
	assert.equal(log().split("\n").at(-2), notice(TMUX).trim(), "tmux missing again is sent again; socket is not, sent within a day");
	say("tmux", "missing: tmux 2.1 is too old");
	arthur("run");
	assert.equal(log().split("\n").at(-2), notice(TMUX.replace("tmux not found on PATH", "tmux 2.1 is too old")).trim(), "a changed line is a new line");
	const record = JSON.parse(readFileSync(join(home, "doctor.json"), "utf8")) as Record<string, number>;
	for (const line of Object.keys(record)) record[line] = Date.now() - 24 * 60 * 60 * 1000 - 1000;
	writeFileSync(join(home, "doctor.json"), JSON.stringify(record));
	const count = log().split("\n").length;
	arthur("run");
	assert.equal(log().split("\n").at(-2), notice(TMUX.replace("tmux not found on PATH", "tmux 2.1 is too old"), SOCKET, ...MISSING).trim(), "a day later every line is sent again, in one notice");
	writeFileSync(join(home, "doctor.json"), "{ not json");
	arthur("run");
	assert.equal(log().split("\n").length, count + 2, "a record edited by hand counts as none");
	assert.ok(!log().includes("start "));
});

test("arthur run: missing lines that are not critical are printed, then sent as the doctor event before any start; once a day", async (t) => {
	const { folder, say, log, env } = project();
	say("token", "missing: no TOKEN set");
	const run = start(t, folder, env);
	await until("the start", () => run.output().includes("started"));
	assert.equal(run.output(), `arthur run: ${TOKEN}\n${BROKEN}arthur run: pid ${run.child.pid} started orchestration, channel, broken, noisy, shapeless\n`);
	assert.equal(log(), `doctor ${JSON.stringify({ lines: [TOKEN, ...MISSING] })}\nstart orchestration\nstart channel\n`);
	run.child.kill("SIGTERM");
	assert.equal(await run.ended, 0);
	const second = start(t, folder, env);
	await until("the second start", () => second.output().includes("started"));
	assert.equal(log(), `doctor ${JSON.stringify({ lines: [TOKEN, ...MISSING] })}\nstart orchestration\nstart channel\nstart orchestration\nstart channel\n`, "nothing new: no event");
	second.child.kill("SIGTERM");
	assert.equal(await second.ended, 0);
});

test("arthur run with a home it cannot write: the refusal is printed only", { skip: ROOT && "root writes anywhere" }, (t) => {
	// A home that cannot be made: the config loads, the plugins do not, the core's lines alone refuse.
	const parent = temporaryFolder();
	chmodSync(parent, 0o555);
	t.after(() => chmodSync(parent, 0o755));
	const unmade = project(join(parent, "home"));
	const refused = unmade.arthur("run");
	assert.equal(refused.status, 1);
	assert.match(refused.stderr, new RegExp(`^arthur run: core home: missing: ${join(parent, "home")} is not writable \\(EACCES\\); .*\n${REFUSED}$`));
	// A home that is there, read-only: the plugins load, and nothing is sent or recorded.
	const there = project();
	there.say("tmux", "missing: tmux not found on PATH");
	there.arthur("doctor");
	chmodSync(there.home, 0o555);
	t.after(() => chmodSync(there.home, 0o755));
	const readOnly = there.arthur("run");
	assert.equal(readOnly.status, 1);
	assert.match(readOnly.stderr, /^arthur run: core home: missing: .* is not writable \(EACCES\); /);
	assert.ok(readOnly.stderr.endsWith(REFUSED));
	assert.deepEqual([there.log(), existsSync(join(there.home, "doctor.json")), existsSync(join(there.home, "events.jsonl"))], ["", false, false]);
});
