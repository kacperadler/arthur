import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:process";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { coreVersion, loadConfig } from "@arthur/core";
import type { Plugin } from "@arthur/core/plugin";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type MachinesOptions, machines } from "../src/machines.ts";

// The fake `ssh` on PATH, for this file. `ssh -G <host>` prints its config as ssh does, `hostname` read from
// `<machines>/<host>/hostname` (default a Tailscale address). Any other call is noted in `ssh.log`, one line, and runs its
// command as ssh runs one in a login's home: in `<machines>/<host>`, `<host>/bin` first on PATH, where the test puts `uname`
// and `arthur`. A file `fail` in that folder holds ssh's own line instead: ssh prints it and exits 255; `hang` makes it hang,
// its pid in `pid` there.
const bin = temporaryFolder();
const root = temporaryFolder();
const sshLog = join(bin, "ssh.log");
// The core's options as an empty config loads them, which a plugin's `check` gets beside its own.
const config = join(temporaryFolder(), "arthur.config.ts");
writeFileSync(config, "export default {};\n");
const core = (await loadConfig(config)).core;
// The machine's PATH has the system's tools and no `arthur` but the one in its own bin.
const machinePath = ["/usr/bin", "/bin"].join(delimiter);
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
if [ "$1" = -G ]; then
  name=$(cat '${root}'/"$2"/hostname 2>/dev/null || echo 100.101.102.103)
  printf 'host %s\\nuser arthur\\nhostname %s\\nport 22\\naddressfamily any\\nbatchmode no\\nconnecttimeout none\\n' "$2" "$name"
  exit 0
fi
printf '%s\\n' "$*" >> '${sshLog}'
while [ $# -gt 0 ]; do case "$1" in -o|-p|-l) shift 2;; -*) shift;; *) break;; esac; done
there='${root}'/"$1"; shift
if [ -e "$there/hang" ]; then echo $$ > "$there/pid"; exec sleep 30; fi
if [ -e "$there/fail" ]; then cat "$there/fail" >&2; exit 255; fi
cd "$there" && PATH="$there/bin:${machinePath}" exec sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
const calls = () => (existsSync(sshLog) ? readFileSync(sshLog, "utf8").split("\n").filter((line) => line !== "") : []);

// A machine reached as `ssh <host>`, whose `uname -sm` says `system` and whose `arthur version` prints `version`; no `arthur` when null.
function machine(host: string, system = "Linux x86_64", version: string | null = coreVersion()): string {
	const there = join(root, host);
	rmSync(there, { recursive: true, force: true });
	mkdirSync(join(there, "bin"), { recursive: true });
	writeFileSync(join(there, "bin/uname"), `#!/bin/sh\necho '${system}'\n`, { mode: 0o755 });
	if (version !== null) writeFileSync(join(there, "bin/arthur"), `#!/bin/sh\n[ "$1" = version ] && echo '${version}'\n`, { mode: 0o755 });
	return there;
}

const KEY_REFUSED = "arthur@mac-mini: Permission denied (publickey).";
const HOST_KEY = "No ED25519 host key is known for build-box and you have requested strict checking.\nHost key verification failed.";

type Loaded = { readonly fake: FakeHost; readonly plugin: Plugin };

// The plugin set up on a fake host with these options, as the host loads it: its options checked first.
async function load(options: MachinesOptions): Promise<Loaded> {
	rmSync(sshLog, { force: true });
	const plugin = machines(options);
	assert.deepEqual(plugin.check?.(options, core), []);
	const fake = fakeHost({ name: "machines", options });
	await fake.setup(plugin);
	return { fake, plugin };
}

const MAC = { name: "mac", ssh: "mac-mini", home: "/Users/arthur/.arthur", labels: { os: "macos", arch: "arm64", tools: ["xcode"] }, maxJobs: 2 };
const BUILD = { name: "build", ssh: "build-box", home: "/home/arthur/.arthur", labels: { os: "linux", arch: "x64" } };

type Requirement = { readonly name: string; check(): Promise<string>; readonly costs: string; readonly fix: string; readonly critical: boolean };
const requirements = (fake: FakeHost) => fake.collect<Requirement[]>("doctor").flat();
const events = (fake: FakeHost) => fake.emitted.map((event) => [event.name, event.data]);

async function until<T>(what: string, predicate: () => T | undefined | false): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

test("each listed machine is registered with the core's job runner; a job's commands reach it over ssh's batch mode", async () => {
	machine("mac-mini", "Darwin arm64");
	const { fake } = await load({ list: [MAC, BUILD] });
	assert.deepEqual(await fake.host.jobs.run("mac", ["sh", "-c", "pwd"]), { code: 0, stdout: `${join(root, "mac-mini")}\n`, stderr: "" });
	await assert.rejects(fake.host.jobs.run("gpu", ["true"]), { message: "unknown machine gpu; machines: build, local, mac" });
	assert.match(calls()[0] ?? "", /^-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 mac-mini /);
});

test("at start every machine is checked and told once; a key refused stays offline, said once, never asked for a password", async () => {
	machine("mac-mini", "Darwin arm64");
	writeFileSync(join(machine("build-box"), "fail"), KEY_REFUSED.replace("mac-mini", "build-box"));
	const { fake, plugin } = await load({ list: [MAC, BUILD] });
	assert.deepEqual(events(fake), [], "setup checks nothing");
	await plugin.start?.();
	try {
		await until("both told", () => fake.emitted.length === 2);
		const offline = { machine: "build", reason: "ssh build-box: arthur@build-box: Permission denied (publickey)." };
		const told = [["machine-online", { machine: "mac", os: "macos", arch: "arm64", version: coreVersion() }], ["machine-offline", offline]];
		assert.deepEqual(events(fake), told);
		for (const call of calls()) assert.match(call, /^-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 (mac|build)-\w+ 'sh' '-c' 'uname -sm && arthur version'$/);
		// Two more rounds, as the doctor and the command ask for them: nothing changed, nothing told.
		await Promise.all(requirements(fake).map((requirement) => requirement.check()));
		assert.equal((await fake.host.commands.route("/machines")).split("\n").length, 6);
		assert.deepEqual(events(fake), told, "a machine that stays offline is told once");
		assert.equal(calls().length, 6, "one ssh call per machine and round, none retried");

		rmSync(join(root, "build-box", "fail"));
		await Promise.all(requirements(fake).map((requirement) => requirement.check()));
		writeFileSync(join(root, "build-box", "fail"), "ssh: connect to host build-box port 22: Connection timed out");
		await Promise.all(requirements(fake).map((requirement) => requirement.check()));
		await Promise.all(requirements(fake).map((requirement) => requirement.check()));
		const back = ["machine-online", { machine: "build", os: "linux", arch: "x64", version: coreVersion() }];
		const gone = ["machine-offline", { machine: "build", reason: "ssh build-box: ssh: connect to host build-box port 22: Connection timed out" }];
		assert.deepEqual(events(fake), [...told, back, gone], "offline and back: each change told once");
	} finally {
		await plugin.stop?.();
	}
});

test("a check outside arthur run (the command, the doctor) tells nothing; arthur run then tells the state all the same", async () => {
	machine("mac-mini", "Darwin arm64");
	const { fake, plugin } = await load({ list: [MAC] });
	await fake.host.commands.route("/machines");
	assert.deepEqual(events(fake), []);
	await plugin.start?.();
	try {
		await until("mac told", () => fake.emitted.length === 1);
		assert.equal(fake.emitted[0]?.name, "machine-online");
	} finally {
		await plugin.stop?.();
	}
});

test("each way a machine is offline, with its reason and its fix, as the doctor says it", async () => {
	machine("mac-mini", "Linux x86_64");
	writeFileSync(join(machine("build-box"), "fail"), HOST_KEY);
	machine("old-box", "Linux x86_64", "0123456789ab");
	machine("bare-box", "Linux aarch64", null);
	machine("arm-box", "Linux aarch64");
	const list = [
		MAC,
		BUILD,
		{ name: "old", ssh: "old-box", home: "/home/arthur/.arthur" },
		{ name: "bare", ssh: "bare-box", home: "/home/arthur/.arthur" },
		{ name: "arm", ssh: "arm-box", home: "/home/arthur/.arthur", labels: { arch: "arm64", tools: ["docker"] } },
	];
	const { fake } = await load({ list });
	const lines = await Promise.all(requirements(fake).map(async (requirement) => [requirement.name, await requirement.check(), requirement.fix, requirement.costs, requirement.critical]));
	assert.deepEqual(lines, [
		["mac", "missing: its labels say os macos, arch arm64; the machine says linux x64", "set the labels of mac in arthur.config.ts to what ssh mac-mini reaches", "no job runs on mac", false],
		[
			"build",
			"missing: ssh build-box: Host key verification failed.",
			"compare ssh-keyscan build-box with the key the machine itself shows, then add it to ~/.ssh/known_hosts",
			"no job runs on build",
			false,
		],
		["old", `missing: it runs arthur 0123456789ab, this one is ${coreVersion()}; both need the same version`, "update Arthur there to this commit (docs/deploy.md)", "no job runs on old", false],
		[
			"bare",
			"missing: arthur is not there (sh: 1: arthur: not found)",
			"install Arthur's core there at this commit, arthur on the PATH of a command over ssh (docs/deploy.md)",
			"no job runs on bare",
			false,
		],
		["arm", `ok (linux arm64, arthur ${coreVersion()})`, "ssh arm-box true, by hand", "no job runs on arm", false],
	]);
	assert.ok(calls().every((call) => call.startsWith("-o BatchMode=yes -o StrictHostKeyChecking=yes ")), "a host key is never accepted on its own");
});

test("a machine whose ssh resolves to a public address is refused at load; one that turns public later is offline", async () => {
	machine("mac-mini");
	writeFileSync(join(root, "mac-mini", "hostname"), "8.8.8.8");
	writeFileSync(join(machine("build-box"), "hostname"), "localhost");
	const options = { list: [{ ...MAC, labels: {} }, BUILD] };
	const fake = fakeHost({ name: "machines", options });
	await assert.rejects(fake.setup(machines(options)), {
		message: "machine mac: ssh mac-mini resolves to 8.8.8.8, a public address; Arthur reaches its machines only over a private network (loopback, RFC 1918, Tailscale)",
	});
	await assert.rejects(fake.host.jobs.run("mac", ["true"]), { message: "unknown machine mac; machines: local" }, "nothing registered");

	const verdicts = [["192.168.1.20", "ok"], ["10.0.0.7", "ok"], ["172.31.0.1", "ok"], ["fd7a:115c:a1e0::1", "ok"], ["::1", "ok"], ["172.32.0.1", "public"], ["100.128.0.1", "public"], ["fd7a:115c:a1e1::1", "public"]] as const;
	for (const [address, verdict] of verdicts) {
		writeFileSync(join(root, "mac-mini", "hostname"), address);
		const loaded = await load({ list: [{ ...MAC, labels: {} }] }).then(
			() => "ok",
			() => "public",
		);
		assert.equal(loaded, verdict, address);
	}
	writeFileSync(join(root, "mac-mini", "hostname"), "no-such-machine.invalid");
	const { fake: later } = await load({ list: [{ ...MAC, labels: {} }, BUILD] });
	const [mac, build] = requirements(later);
	assert.match((await mac?.check()) ?? "", /^missing: getaddrinfo ENOTFOUND no-such-machine\.invalid$/, "a name not found loads, and is offline");
	assert.equal(await build?.check(), `ok (linux x64, arthur ${coreVersion()})`, "localhost is loopback");
	writeFileSync(join(root, "mac-mini", "hostname"), "1.1.1.1");
	assert.equal(await requirements(later)[0]?.check(), "missing: ssh mac-mini resolves to 1.1.1.1, not a private address", "checked again at the next doctor run");
	assert.equal(calls().filter((call) => call.includes("mac-mini")).length, 0, "nothing is sent to a public address");
});

test("ten machines that hang cost one check of 10 s, each cut and its ssh killed", async () => {
	const list = Array.from({ length: 10 }, (_, index) => {
		writeFileSync(join(machine(`hung-${index}`), "hang"), "");
		return { name: `hung${index}`, ssh: `hung-${index}`, home: "/home/arthur/.arthur" };
	});
	const { fake } = await load({ list });
	const started = Date.now();
	// One after another, as a doctor may ask: the first starts every machine's check.
	for (const requirement of requirements(fake)) assert.equal(await requirement.check(), "missing: check timed out after 10 s");
	const took = Date.now() - started;
	assert.ok(took >= 9_900 && took < 14_000, `took ${took} ms`);
	assert.equal(calls().length, 10);
	const alive = (pid: number) => {
		try {
			return process.kill(pid, 0);
		} catch {
			return false;
		}
	};
	const pids = list.map((entry) => Number(readFileSync(join(root, entry.ssh, "pid"), "utf8")));
	await until("every hung ssh gone", () => pids.every((pid) => !alive(pid)));
});

test("arthur machines and /machines: local first with its detected labels, then each machine, its state and its jobs", async (t) => {
	machine("mac-mini", "Darwin arm64");
	writeFileSync(join(machine("build-box"), "fail"), KEY_REFUSED.replace("mac-mini", "build-box"));
	const { fake } = await load({ local: { labels: { tools: ["docker"] }, maxJobs: 3 }, list: [MAC, BUILD] });
	const home = dirname(fake.host.folder);
	const record = (id: string, files: Readonly<Record<string, string>>) => {
		mkdirSync(join(home, "jobs", id), { recursive: true });
		for (const [name, text] of Object.entries({ kind: "worker", project: "acme", ...files })) writeFileSync(join(home, "jobs", id, name), text);
	};
	record("2026-10-18-worker-0000000a", { state: "working", machine: "mac" });
	record("2026-10-18-worker-0000000b", { state: "ended", reason: "finished", machine: "mac" });
	record("2026-10-18-worker-0000000c", { state: "blocked", reason: "user: which?" });
	const os = platform === "darwin" ? "macos" : platform;
	const expected = [
		`local: online (${os} ${arch}, arthur ${coreVersion()})`,
		`  labels: os ${os}, arch ${arch}, tools docker; maxJobs: 3; jobs: 2026-10-18-worker-0000000c (blocked)`,
		`mac (ssh mac-mini): online (macos arm64, arthur ${coreVersion()})`,
		"  labels: os macos, arch arm64, tools xcode; maxJobs: 2; jobs: 2026-10-18-worker-0000000a (working)",
		"build (ssh build-box): offline: ssh build-box: arthur@build-box: Permission denied (publickey).; fix: ssh-copy-id build-box",
		"  labels: os linux, arch x64; maxJobs: not set; no jobs",
	].join("\n");
	const log = t.mock.method(console, "log", () => {});
	const [command] = fake.commands;
	assert.equal(await command?.run({ args: [], project: undefined }), undefined);
	assert.deepEqual(log.mock.calls.map((call) => call.arguments), [[expected]]);
	assert.equal(await fake.host.commands.route("/machines"), expected, "the phone reply is the shell's output");
	assert.equal(await fake.host.commands.route("/machines all"), "usage: /machines");
	const error = t.mock.method(console, "error", () => {});
	assert.equal(await command?.run({ args: ["all"], project: undefined }), 2);
	assert.deepEqual(error.mock.calls.map((call) => call.arguments), [["usage: arthur machines"]]);
	assert.deepEqual(fake.host.commands.phone(), [{ name: "machines", about: "every machine: its labels, online or why not, its jobs" }]);
});

test("without a list only local is there, and the doctor has no line", async () => {
	const { fake } = await load({});
	assert.deepEqual(requirements(fake), []);
	assert.match(await fake.host.commands.route("/machines"), /^local: online \(\w+ \w+, arthur \w+\)\n {2}labels: os \w+, arch \w+; maxJobs: not set; no jobs$/);
	assert.deepEqual(calls(), []);
});
