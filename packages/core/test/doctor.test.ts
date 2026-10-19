import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { delimiter, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { doctor } from "../src/doctor.ts";
import { coreRequirements } from "../src/requirements.ts";
import { temporaryFolder } from "../src/testing.ts";

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
	{ name: "orchestration", setup(host) {
		host.provide("doctor", () => [need("tmux", true)]);
		host.events.on("doctor", (event) => log("doctor " + JSON.stringify(event.data)));
		host.events.on("notice", (event) => log("notice " + JSON.stringify(event.data.text)));
	}, start() { log("start orchestration"); } },
	{ name: "channel", setup(host) {
		host.provide("doctor", async () => [need("token", false), need("socket", true), { name: "bot", check: async () => "ok (@arthur_bot)", costs: "-", fix: "-" }]);
	}, start() { log("start channel"); } },
	{ name: "broken", setup(host) {
		host.provide("doctor", () => [{ name: "throws", check() { throw new Error("boom\\nat line 2"); }, costs: "c", fix: "f" }, { name: "odd", check: () => "fine", costs: "c", fix: "f" }]);
	} },
	{ name: "noisy", setup(host) { host.provide("doctor", () => { throw new Error("no list today"); }); } },
	{ name: "shapeless", setup(host) { host.provide("doctor", () => "a string"); } },
	{ name: "off", options: { enabled: false }, setup(host) { host.provide("doctor", () => [need("never", true)]); } },
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
	const env = { PATH: [bin, PATH].join(delimiter) };
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env });
	return { folder, home: home ?? join(folder, ".arthur"), say, log, arthur, env };
}

const CORE = ["core git: ok", "core node: ok", "core omp: ok", "core home: ok", "core controllers: ok"];
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

test("arthur doctor: one line per requirement, the core's then each enabled plugin's in setup order; a throw costs its line only; exit 1 only on a critical miss", () => {
	const { say, arthur, home } = project();
	const all = arthur("doctor");
	assert.deepEqual([all.status, all.stdout, all.stderr], [0, [...CORE, ...REST, ""].join("\n"), ""], "a throwing check is not critical: its line is missing, the exit code 0");
	say("token", "missing: no TOKEN set");
	const token = arthur("doctor");
	assert.deepEqual([token.status, token.stdout.split("\n")[6]], [0, TOKEN], "only a non-critical miss: exit 0");
	say("tmux", "missing: tmux not found on PATH");
	const tmux = arthur("doctor");
	assert.deepEqual([tmux.status, tmux.stdout.split("\n")[5]], [1, TMUX], "one critical miss: exit 1");
	assert.equal(tmux.stdout.split("\n").length, CORE.length + REST.length + 1, "every line is still printed");
	assert.ok(!existsSync(join(home, "events.jsonl")) && !existsSync(join(home, "doctor.json")), "arthur doctor sends nothing and records nothing");
	assert.deepEqual([arthur("doctor", "now").status, arthur("doctor", "now").stderr], [2, "usage: arthur doctor\n"]);
});

test("arthur doctor without the plugins: the core's own lines, then why the plugins' are not checked; a config that does not load, the reason alone", () => {
	const { folder, arthur } = project();
	writeFileSync(join(folder, "arthur.config.ts"), 'export default { plugins: [{ name: "orchestration", setup() { throw new Error("no socket"); } }] };\n');
	const failed = arthur("doctor");
	assert.deepEqual([failed.status, failed.stdout], [1, [...CORE, ""].join("\n")]);
	assert.equal(failed.stderr, "arthur doctor: the plugins' requirements are not checked: arthur.config.ts did not load:\nplugin orchestration: setup failed: no socket\n");
	writeFileSync(join(folder, "arthur.config.ts"), "export default {\n");
	const broken = arthur("doctor");
	assert.deepEqual([broken.status, broken.stdout], [1, ""]);
	assert.match(broken.stderr, /^arthur doctor: arthur\.config\.ts did not load:\n/);
});

test("the core's requirements: git, Node 24, the agent, a writable home, critical; the controllers delegated, not; each missing with its reason and fix", async (t) => {
	t.after(() => void (process.env.PATH = PATH));
	const bin = temporaryFolder();
	symlinkSync("/bin/sh", join(bin, "sh"));
	systemctl(bin, { controllers: "memory pids" });
	process.env.PATH = bin;
	const home = join(temporaryFolder(), "home");
	const lines = await doctor(coreRequirements(home, "omp", "22.11.0"), []);
	assert.deepEqual(
		lines.map((line) => [line.text, line.critical]),
		[
			["core git: missing: git not found on PATH; without it: no worktree, so no job, and no ticket board; fix: sudo apt-get install -y git (docs/setup.md, step 2)", true],
			["core node: missing: Node 22.11.0 runs arthur; it needs 24 or newer; without it: Arthur's code may not run; fix: nvm install 24 && nvm alias default 24, then write ~/.config/arthur.env again (docs/setup.md, steps 2 and 8)", true],
			["core omp: missing: omp not found on PATH; without it: no coordinator and no job; fix: install omp on the PATH arthur run has (docs/setup.md, steps 2 and 8)", true],
			["core home: ok", false],
			['core controllers: missing: the user manager has the controllers "memory pids", not cpu and memory; without it: jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end; fix: delegate them (docs/setup.md, step 10), then reboot', false],
		],
	);
	assert.ok(existsSync(home), "a home that is not there yet is made");
	systemctl(bin, { manager: false });
	const agent = join(bin, "my-agent");
	writeFileSync(agent, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	const [, node, found, , controllers] = await doctor(coreRequirements(home, agent, "24.0.0"), []);
	assert.deepEqual([node?.text, found?.text], ["core node: ok", "core my-agent: ok"], "Node 24.0.0 is enough; an agent by its path is found, never run");
	assert.equal(
		controllers?.text,
		`core controllers: missing: no systemd user manager, so no job scope and no user service (Failed to connect to bus: No medium found); without it: jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end; fix: sudo loginctl enable-linger ${USER}; none on macOS or in a container, where jobs run bare`,
	);
	assert.equal(controllers?.critical, false);
});

test("a home that is not writable is a critical miss", { skip: ROOT && "root writes anywhere" }, async (t) => {
	const parent = temporaryFolder();
	chmodSync(parent, 0o555);
	t.after(() => chmodSync(parent, 0o755));
	const [, , , home] = await doctor(coreRequirements(join(parent, "home"), "omp"), []);
	assert.equal(home?.text, `core home: missing: ${join(parent, "home")} is not writable (EACCES); without it: nothing is kept: no job record, no event log, no plugin's state; fix: sudo chown -R ${USER} ${join(parent, "home")}, or set core.home in arthur.config.ts to a folder ${USER} can write`);
	assert.equal(home?.critical, true);
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
	assert.ok(took >= 10_000 && took < 15_000, `took ${took} ms`);
});

// `arthur run` in the background, until the test ends.
function start(t: TestContext, folder: string, env: Readonly<Record<string, string>>): { readonly child: ChildProcess; readonly output: () => string; readonly ended: Promise<number | null> } {
	const child = spawn(process.execPath, [CLI, "run"], { cwd: folder, env });
	let stdout = "";
	child.stdout.on("data", (chunk) => (stdout += chunk));
	t.after(() => child.kill("SIGKILL"));
	return { child, output: () => stdout, ended: once(child, "close").then(([status]) => status as number | null) };
}

async function until(holds: () => boolean, what: string): Promise<void> {
	for (const deadline = Date.now() + 20_000; !holds(); await sleep(20)) if (Date.now() > deadline) assert.fail(`waited 20 s for ${what}`);
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
	await until(() => run.output().includes("started"), "the start");
	assert.equal(run.output(), `arthur run: ${TOKEN}\n${BROKEN}arthur run: pid ${run.child.pid} started orchestration, channel, broken, noisy, shapeless\n`);
	assert.equal(log(), `doctor ${JSON.stringify({ lines: [TOKEN, ...MISSING] })}\nstart orchestration\nstart channel\n`);
	run.child.kill("SIGTERM");
	assert.equal(await run.ended, 0);
	const second = start(t, folder, env);
	await until(() => second.output().includes("started"), "the second start");
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
