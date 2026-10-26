import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { runPlugins } from "../src/run.ts";
import { temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const BOOT_ID = "/proc/sys/kernel/random/boot_id";
// A user manager with the CPU and memory controllers delegated, as systemd answers, so `arthur run`'s doctor misses nothing.
const BIN = temporaryFolder();
writeFileSync(join(BIN, "systemctl"), `#!/bin/sh\n[ "$1" = --user ] && exit 0\necho 'cpu memory pids'\n`, { mode: 0o755 });
const ENV = { PATH: `${BIN}:${process.env.PATH ?? ""}`, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? "" };

// Each plugin logs its `start` and `stop` to `log.txt` beside the config; `more` replaces any of its parts.
const HEAD = `import { appendFileSync, existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const log = (line) => appendFileSync(new URL("./log.txt", import.meta.url), line + "\\n");
const plugin = (name, more = {}) => ({ name, setup() {}, start() { log("start " + name); }, stop() { log("stop " + name); }, ...more });
`;

function project(plugins: string): { readonly folder: string; readonly home: string; readonly log: () => string } {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), `${HEAD}export default { plugins: [${plugins}] };\n`);
	const log = () => (existsSync(join(folder, "log.txt")) ? readFileSync(join(folder, "log.txt"), "utf8") : "");
	return { folder, home: join(folder, ".arthur"), log };
}

type Ended = { readonly status: number | null; readonly stdout: string; readonly stderr: string };

// `arthur run` in the background; killed at the end of the test if it still runs.
function start(t: TestContext, folder: string): { readonly child: ChildProcess; readonly output: () => string; readonly ended: Promise<Ended> } {
	const child = spawn(process.execPath, [CLI, "run"], { cwd: folder, env: ENV });
	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (chunk) => (stdout += chunk));
	child.stderr.on("data", (chunk) => (stderr += chunk));
	const ended = once(child, "close").then(([status]) => ({ status: status as number | null, stdout, stderr }));
	t.after(() => child.kill("SIGKILL"));
	return { child, output: () => stdout, ended };
}

function runOnce(folder: string, ...args: string[]): Ended {
	return spawnSync(process.execPath, [CLI, "run", ...args], { cwd: folder, encoding: "utf8", env: ENV });
}

async function until(holds: () => boolean, what: string): Promise<void> {
	for (const deadline = Date.now() + 10_000; !holds(); await sleep(10)) if (Date.now() > deadline) assert.fail(`waited 10 s for ${what}`);
}

test("arthur run starts in dependency order, refuses a second run on the home naming the pid, and stops in reverse on SIGTERM", async (t) => {
	const { folder, home, log } = project('plugin("a", { requires: ["b"] }), plugin("orchestration"), plugin("b", { stop: undefined })');
	const run = start(t, folder);
	await until(() => run.output().includes("started"), "the start");
	assert.equal(log(), "start b\nstart a\nstart orchestration\n");
	assert.equal(run.output(), `arthur run: pid ${run.child.pid} started b, a, orchestration\n`);
	assert.match(readFileSync(join(home, "run.pid"), "utf8"), new RegExp(`^${run.child.pid}( |$)`));

	const second = runOnce(folder);
	assert.deepEqual(
		[second.status, second.stdout, second.stderr],
		[1, "", `arthur run: ${home} is already run by pid ${run.child.pid}; one arthur run per home folder\n`],
	);
	assert.equal(log(), "start b\nstart a\nstart orchestration\n", "the second run started nothing");

	run.child.kill("SIGTERM");
	const ended = await run.ended;
	assert.deepEqual([ended.status, ended.stderr], [0, ""]);
	assert.equal(log(), "start b\nstart a\nstart orchestration\nstop orchestration\nstop a\n");
	assert.match(ended.stdout, /\narthur run: SIGTERM: stopping orchestration, a, b\narthur run: stopped\n$/);
	assert.ok(!existsSync(join(home, "run.pid")), "the lock is gone after a clean stop");
});

test("a lock of a dead pid, one that names no pid, or one written in an earlier boot is taken over", async (t) => {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	// The test's own pid is alive: only the boot it names makes the lock stale.
	const stale = [String(dead), "not a pid", ...(existsSync(BOOT_ID) ? [`${process.pid} 00000000-0000-0000-0000-000000000000`] : [])];
	for (const text of stale) {
		const { folder, home, log } = project('plugin("orchestration")');
		mkdirSync(home);
		writeFileSync(join(home, "run.pid"), text);
		const run = start(t, folder);
		await until(() => run.output().includes("started"), `the start over a lock holding ${JSON.stringify(text)}`);
		assert.match(readFileSync(join(home, "run.pid"), "utf8"), new RegExp(`^${run.child.pid}( |$)`));
		run.child.kill("SIGTERM");
		assert.equal((await run.ended).status, 0);
		assert.equal(log(), "start orchestration\nstop orchestration\n");
	}
});

test("a lock of a live pid written in this boot refuses the run", { skip: !existsSync(BOOT_ID) }, () => {
	const { folder, home, log } = project('plugin("orchestration")');
	mkdirSync(home);
	writeFileSync(join(home, "run.pid"), `${process.pid} ${readFileSync(BOOT_ID, "utf8").trim()}`);
	const run = runOnce(folder);
	assert.deepEqual([run.status, run.stderr], [1, `arthur run: ${home} is already run by pid ${process.pid}; one arthur run per home folder\n`]);
	assert.equal(log(), "");
	assert.ok(existsSync(join(home, "run.pid")), "the live holder's lock is kept");
});

test("a start that throws stops the plugins started before it, in reverse, starts none after it, and exits 1 naming the plugin", () => {
	const { folder, home, log } = project(
		'plugin("orchestration"), plugin("a"), plugin("b", { start() { log("start b"); throw new Error("no socket"); } }), plugin("c")',
	);
	const run = runOnce(folder);
	assert.deepEqual([run.status, run.stderr], [1, "arthur run: plugin b: start failed: no socket\n"]);
	assert.equal(log(), "start orchestration\nstart a\nstart b\nstop a\nstop orchestration\n");
	assert.equal(run.stdout, "arthur run: a start failed: stopping a, orchestration\narthur run: stopped\n");
	assert.ok(!existsSync(join(home, "run.pid")));
});

test("under umask 022 arthur run leaves the home its user's alone: a new one 0700, one made 0755 earlier 0700", async (t) => {
	const mask = process.umask(0o022);
	t.after(() => process.umask(mask));
	const fails = 'plugin("orchestration", { start() { throw new Error("no socket"); } })';
	const made = project(fails);
	const earlier = project(fails);
	mkdirSync(earlier.home);
	assert.equal(statSync(earlier.home).mode & 0o777, 0o755, "the umask in force");
	for (const { folder, home } of [made, earlier]) {
		assert.equal(runOnce(folder).status, 1);
		assert.equal(statSync(home).mode & 0o777, 0o700, home);
	}
	// Without the load and the doctor's own check, which make it so too: the run's own step.
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", () => {});
	const { home } = project("");
	mkdirSync(home);
	const plugin = { name: "orchestration", setup() {}, start() { throw new Error("no socket"); } };
	assert.equal(await runPlugins([plugin], home, () => () => {}, () => {}, async () => [], () => {}), 1);
	assert.equal(statSync(home).mode & 0o777, 0o700, "runPlugins");
});

test("SIGINT stops like SIGTERM; a stop that throws is named, the other plugins still stop, and the exit code is 1", async (t) => {
	const { folder, home, log } = project('plugin("orchestration"), plugin("a", { stop() { log("stop a"); throw new Error("stuck"); } }), plugin("b")');
	const run = start(t, folder);
	await until(() => run.output().includes("started"), "the start");
	run.child.kill("SIGINT");
	const ended = await run.ended;
	assert.deepEqual([ended.status, ended.stderr], [1, "arthur run: plugin a: stop failed: stuck\n"]);
	assert.match(ended.stdout, /\narthur run: SIGINT: stopping b, a, orchestration\n/);
	assert.equal(log(), "start orchestration\nstart a\nstart b\nstop b\nstop a\nstop orchestration\n");
	assert.ok(!existsSync(join(home, "run.pid")));
});

test("SIGTERM during a start lets it finish, stops it and those before it, and starts no other", async (t) => {
	// b's start ends once it has seen the signal itself; Arthur's listener came first, so by then Arthur has seen it too.
	const slow = `plugin("b", { async start() {
		const seen = new Promise((resolve) => process.once("SIGTERM", resolve));
		log("start b");
		await seen;
		log("started b");
	} })`;
	const { folder, home, log } = project(`plugin("orchestration"), ${slow}, plugin("c")`);
	const run = start(t, folder);
	await until(() => log().includes("start b"), "b's start");
	run.child.kill("SIGTERM");
	const ended = await run.ended;
	assert.deepEqual([ended.status, ended.stderr], [0, ""]);
	assert.equal(log(), "start orchestration\nstart b\nstarted b\nstop b\nstop orchestration\n");
	assert.equal(ended.stdout, "arthur run: SIGTERM: stopping b, orchestration\narthur run: stopped\n");
	assert.ok(!existsSync(join(home, "run.pid")));
});

test("arthur run refuses arguments, and a config that does not load, starting nothing", () => {
	const { folder, home } = project('plugin("schedule")');
	const broken = runOnce(folder);
	assert.equal(broken.status, 1);
	assert.match(broken.stderr, /^arthur run: arthur\.config\.ts did not load:\n.*orchestration is required and missing/);
	const extra = runOnce(project('plugin("orchestration")').folder, "now");
	assert.deepEqual([extra.status, extra.stderr], [2, "usage: arthur run\n"]);
	assert.ok(!existsSync(join(home, "run.pid")));
});

test("an event a command emits reaches the daemon's subscribers once, from the daemon's start until its plugins stop", async (t) => {
	// The daemon answers each `pinged` with a `ponged`. Its stop waits until a command has pinged during it, then 1.5 s, three
	// follows of 500 ms: an event that does not arrive gives no signal to wait for, so this one wait is real time.
	const orchestration = `plugin("orchestration", {
		setup(host) {
			host.events.on("pinged", (event) => {
				log(process.pid + " pinged " + event.seq + " " + event.data);
				if (process.argv.includes("run")) host.events.emit("ponged", event.seq);
			});
			host.events.on("ponged", (event) => log(process.pid + " ponged " + event.seq));
			host.commands.register({ name: "ping", doc: new URL("./ping.md", import.meta.url), run: ({ args }) => void host.events.emit("pinged", args[0]) });
		},
		async stop() {
			log("stop orchestration");
			while (!existsSync(new URL("./pinged-in-stop", import.meta.url))) await sleep(10);
			await sleep(1500);
			log("stopped orchestration");
		},
	})`;
	const { folder, log } = project(orchestration);
	writeFileSync(join(folder, "ping.md"), "# arthur ping\n");
	const ping = (data: string) => {
		const command = spawnSync(process.execPath, [CLI, "ping", data], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
		assert.deepEqual([command.status, command.stderr], [0, ""]);
		return command.pid;
	};
	const before = ping("a");
	const run = start(t, folder);
	await until(() => run.output().includes("started"), "the start");
	const daemon = run.child.pid;
	const b = ping("b");
	await until(() => log().includes(`${daemon} ponged 3`), "the daemon's answer to b");
	const c = ping("c");
	await until(() => log().includes(`${daemon} ponged 5`), "the daemon's answer to c");
	run.child.kill("SIGTERM");
	await until(() => log().includes("stop orchestration"), "the stop");
	const d = ping("d");
	writeFileSync(join(folder, "pinged-in-stop"), "");
	assert.equal((await run.ended).status, 0);
	// A command delivers its event to its own subscribers after it appended it to the log, so the daemon, following the log, may
	// log it first: the daemon's lines are checked in order, and each command's own line once, between its run and the next.
	const lines = log().split("\n");
	const [ownB, ownC] = [`${b} pinged 2 b`, `${c} pinged 4 c`];
	const at = (line: string) => (lines.indexOf(line) === lines.lastIndexOf(line) ? lines.indexOf(line) : -1);
	assert.ok(at("start orchestration") < at(ownB) && at(ownB) < at(`${daemon} pinged 4 c`) && at(`${daemon} ponged 3`) < at(ownC) && at(ownC) < at("stop orchestration"), log());
	assert.deepEqual(
		lines.filter((line) => line !== ownB && line !== ownC),
		[
			`${before} pinged 1 a`,
			"start orchestration",
			`${daemon} pinged 2 b`,
			`${daemon} ponged 3`,
			`${daemon} pinged 4 c`,
			`${daemon} ponged 5`,
			"stop orchestration",
			`${d} pinged 6 d`,
			"stopped orchestration",
			"",
		],
	);
});

test("the events appended while no daemon runs reach the next one once, a crash mid-delivery repeats it, a stop does not", async (t) => {
	// Only the daemon logs what it gets. `slow` holds its handler 1 s, long enough to stop the daemon during it.
	const orchestration = `plugin("orchestration", {
		setup(host) {
			const daemon = process.argv.includes("run");
			host.events.on("pinged", (event) => daemon && log(process.pid + " pinged " + event.seq + " " + event.data));
			host.events.on("slow", (event) => {
				if (!daemon) return;
				log(process.pid + " slow begun " + event.seq);
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
				log(process.pid + " slow done " + event.seq);
			});
			for (const name of ["pinged", "slow"])
				host.commands.register({ name, doc: new URL("./ping.md", import.meta.url), run: ({ args }) => void host.events.emit(name, args[0]) });
		},
	})`;
	const { folder, home, log } = project(orchestration);
	writeFileSync(join(folder, "ping.md"), "# arthur ping\n");
	const emit = (name: string, data: string) => {
		const command = spawnSync(process.execPath, [CLI, name, data], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
		assert.deepEqual([command.status, command.stderr], [0, ""]);
	};
	const daemon = async () => {
		const run = start(t, folder);
		await until(() => run.output().includes("started"), "the start");
		return { ...run, pid: run.child.pid };
	};
	emit("pinged", "before any daemon");
	const first = await daemon();
	emit("pinged", "b");
	await until(() => log().includes(`${first.pid} pinged 2 b`), "b");
	first.child.kill("SIGTERM");
	assert.equal((await first.ended).status, 0);
	assert.equal(readFileSync(join(home, "events.delivered"), "utf8"), "2\n");

	emit("pinged", "c");
	emit("pinged", "d");
	const second = await daemon();
	await until(() => log().includes(`${second.pid} pinged 4 d`), "the replay of c and d");
	emit("slow", "crash");
	await until(() => log().includes(`${second.pid} slow begun 5`), "the slow handler");
	second.child.kill("SIGKILL");
	await second.ended;

	const third = await daemon();
	await until(() => log().includes(`${third.pid} slow done 5`), "the replay of the event the crash cut");
	emit("slow", "stop");
	await until(() => log().includes(`${third.pid} slow begun 6`), "the slow handler");
	third.child.kill("SIGTERM");
	assert.equal((await third.ended).status, 0);

	const fourth = await daemon();
	emit("pinged", "e");
	await until(() => log().includes(`${fourth.pid} pinged 7 e`), "e");
	fourth.child.kill("SIGTERM");
	assert.equal((await fourth.ended).status, 0);
	assert.equal(
		log(),
		[
			"start orchestration",
			`${first.pid} pinged 2 b`,
			"stop orchestration",
			// The replay comes before the starts.
			`${second.pid} pinged 3 c`,
			`${second.pid} pinged 4 d`,
			"start orchestration",
			`${second.pid} slow begun 5`,
			`${third.pid} slow begun 5`,
			`${third.pid} slow done 5`,
			"start orchestration",
			`${third.pid} slow begun 6`,
			`${third.pid} slow done 6`,
			"stop orchestration",
			"start orchestration",
			`${fourth.pid} pinged 7 e`,
			"stop orchestration",
			"",
		].join("\n"),
	);
});
