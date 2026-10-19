import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
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

// The line of free CPU and memory a machine's `node -e` prints in its check.
const FREE_LINE = JSON.stringify({ cores: 8, load: 1.5, free: 6 * 2 ** 30, total: 16 * 2 ** 30 });

// A machine reached as `ssh <host>`, whose `uname -sm` says `system` and whose `arthur version` prints `version`; no `arthur`
// when null. Its `node -e` prints FREE_LINE.
function machine(host: string, system = "Linux x86_64", version: string | null = coreVersion()): string {
	const there = join(root, host);
	rmSync(there, { recursive: true, force: true });
	mkdirSync(join(there, "bin"), { recursive: true });
	writeFileSync(join(there, "bin/uname"), `#!/bin/sh\necho '${system}'\n`, { mode: 0o755 });
	writeFileSync(join(there, "bin/node"), `#!/bin/sh\n[ "$1" = -e ] && echo '${FREE_LINE}'\n`, { mode: 0o755 });
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

const MAC = { name: "mac", ssh: "mac-mini", home: "/Users/arthur/.arthur", labels: { os: "macos", arch: "arm64", tools: ["xcodebuild"] }, maxJobs: 2 };
const BUILD = { name: "build", ssh: "build-box", home: "/home/arthur/.arthur", labels: { os: "linux", arch: "x64" } };

type Requirement = { readonly name: string; check(): Promise<string>; readonly costs: string; readonly fix: string; readonly critical: boolean };
const requirements = (fake: FakeHost) => fake.collect<Requirement[]>("doctor").flat();
const events = (fake: FakeHost) => fake.emitted.map((event) => [event.name, event.data]);
// The one command of a machine's check over ssh, as the core quotes it, before its `node -e` script (`FREE`) and its tools labels.
const CHECK = `'sh' '-c' 'uname -sm && arthur version && node -e "$1" && shift && for tool do command -v "$tool" >/dev/null || echo "missing $tool"; done'`;
const FREE = "'[^']+'";
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
		for (const call of calls()) assert.match(call, new RegExp(`^-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 (mac-mini ${escape(CHECK)} 'sh' ${FREE} 'xcodebuild'|build-box ${escape(CHECK)} 'sh' ${FREE})$`));
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

test("each round hands machines.round every listed machine's check as it begins: its free CPU and memory, or why it is offline, from its one ssh call, and check.everySeconds", async () => {
	// The real node there, so the line is what the check's own script measures.
	writeFileSync(join(machine("mac-mini", "Darwin arm64"), "bin/node"), `#!/bin/sh\nexec '${process.execPath}' "$@"\n`, { mode: 0o755 });
	writeFileSync(join(machine("build-box"), "fail"), KEY_REFUSED.replace("mac-mini", "build-box"));
	const { fake } = await load({ list: [MAC, BUILD], check: { everySeconds: 300 } });
	const rounds: ReadonlyMap<string, Promise<{ readonly free?: string; readonly error?: string }>>[] = [];
	const begun: Promise<unknown>[] = [];
	const cadence: unknown[] = [];
	fake.provide("machines.round", (checks: (typeof rounds)[number], everySeconds: unknown) => {
		rounds.push(checks);
		cadence.push(everySeconds);
		begun.push(Promise.race([...checks.values(), Promise.resolve("pending")]));
	});
	await fake.host.commands.route("/machines");
	assert.equal(rounds.length, 1, "one hook per round");
	assert.deepEqual(cadence, [300], "the round's cadence, so a check counts as long as the next round is not due");
	assert.equal(await begun[0], "pending", "handed over before any check ended");
	assert.deepEqual([...(rounds[0]?.keys() ?? [])], ["mac", "build"]);
	assert.deepEqual(await rounds[0]?.get("build"), { error: "ssh build-box: arthur@build-box: Permission denied (publickey)." });
	const free = JSON.parse((await rounds[0]?.get("mac"))?.free ?? "");
	assert.deepEqual([free.cores, free.total, typeof free.load, typeof free.free], [availableParallelism(), totalmem(), "number", "number"]);
	assert.equal(calls().length, 2, "one ssh call per machine and round serves both");
	await Promise.all(requirements(fake).map((requirement) => requirement.check()));
	assert.equal(rounds.length, 2, "the doctor's round is handed over too");
});

test("a machine whose node -e fails in the check is offline with its line, so it takes no job without its free CPU and memory", async () => {
	writeFileSync(join(machine("build-box"), "bin/node"), "#!/bin/sh\necho 'node: bad option: -e' >&2\nexit 9\n", { mode: 0o755 });
	const { fake } = await load({ list: [BUILD] });
	const [requirement] = requirements(fake);
	assert.equal(await requirement?.check(), "missing: uname -sm && arthur version && node -e failed there: node: bad option: -e");
	assert.equal(requirement?.fix, "ssh build-box 'uname -sm && arthur version && node -v', by hand");
});

test("each way a machine is offline, with its reason and its fix, and each tools label command -v does not find there, as the doctor says it", async () => {
	machine("mac-mini", "Linux x86_64");
	writeFileSync(join(machine("build-box"), "fail"), HOST_KEY);
	machine("old-box", "Linux x86_64", "0123456789ab");
	machine("bare-box", "Linux aarch64", null);
	// The tools labels name commands: arm has its docker; gpu has docker and neither of the other two.
	for (const host of ["arm-box", "gpu-box"]) writeFileSync(join(machine(host, host === "arm-box" ? "Linux aarch64" : "Linux x86_64"), "bin/docker"), "#!/bin/sh\n", { mode: 0o755 });
	const list = [
		MAC,
		BUILD,
		{ name: "old", ssh: "old-box", home: "/home/arthur/.arthur" },
		{ name: "bare", ssh: "bare-box", home: "/home/arthur/.arthur" },
		{ name: "arm", ssh: "arm-box", home: "/home/arthur/.arthur", labels: { arch: "arm64", tools: ["docker"] } },
		{ name: "gpu", ssh: "gpu-box", home: "/home/arthur/.arthur", labels: { tools: ["docker", "nvidia-smi", "xcodebuild"] } },
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
		[
			"gpu",
			`missing: command -v finds no nvidia-smi, xcodebuild there (linux x64, arthur ${coreVersion()})`,
			"install nvidia-smi, xcodebuild on gpu, on the PATH of a command over ssh (docs/deploy.md), or drop what it does not need from its tools label",
			"no job that needs nvidia-smi, xcodebuild runs on gpu",
			false,
		],
	]);
	assert.ok(calls().every((call) => call.startsWith("-o BatchMode=yes -o StrictHostKeyChecking=yes ")), "a host key is never accepted on its own");
	assert.ok(calls().some((call) => new RegExp(`gpu-box ${escape(CHECK)} 'sh' ${FREE} 'docker' 'nvidia-smi' 'xcodebuild'$`).test(call)), "each tool label is asked of command -v, in the one check over ssh");
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
	// Below the 20 s of two checks in a row, with room for a slow runner.
	assert.ok(took >= 9_900 && took < 19_000, `took ${took} ms`);
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
		"  labels: os macos, arch arm64, tools xcodebuild; maxJobs: 2; jobs: 2026-10-18-worker-0000000a (working)",
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

test("local's tools labels are checked with command -v on the PATH of arthur run, its line first, in a listed machine's shape", async () => {
	machine("build-box");
	const here = `${platform === "darwin" ? "macos" : platform} ${arch}, arthur ${coreVersion()}`;
	const { fake } = await load({ local: { labels: { tools: ["sh", "no-such-tool-ar0172", "no-such-tool-ar0172b"] } }, list: [BUILD] });
	const lines = await Promise.all(requirements(fake).map(async (requirement) => [requirement.name, await requirement.check(), requirement.fix, requirement.costs, requirement.critical]));
	assert.deepEqual(lines, [
		[
			"local",
			`missing: command -v finds no no-such-tool-ar0172, no-such-tool-ar0172b here (${here})`,
			"install no-such-tool-ar0172, no-such-tool-ar0172b on the PATH of arthur run, or drop what it does not need from local's tools label",
			"no job that needs no-such-tool-ar0172, no-such-tool-ar0172b runs on local",
			false,
		],
		["build", `ok (linux x64, arthur ${coreVersion()})`, "ssh build-box true, by hand", "no job runs on build", false],
	]);
	assert.deepEqual(calls().filter((call) => !call.startsWith("-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 build-box ")), [], "local is checked here, never over ssh");
	// A tool only in a folder of this process's PATH, which `arthur run` passes on to what it runs.
	writeFileSync(join(bin, "ar0172-tool"), "#!/bin/sh\n", { mode: 0o755 });
	const { fake: found } = await load({ local: { labels: { tools: ["ar0172-tool", "sh"] } } });
	assert.deepEqual(await Promise.all(requirements(found).map(async (requirement) => [requirement.name, await requirement.check()])), [["local", `ok (${here})`]]);
	assert.deepEqual(calls(), []);
});

// Placing a job by labels (roadmap entry 31). `local` here has its detected os and arch and the tool docker, room for 3 jobs.
const OS = platform === "darwin" ? "macos" : platform;
const LOCAL = { labels: { tools: ["docker"] }, maxJobs: 3 };
const LOCAL_TEXT = `local (os ${OS}, arch ${arch}, tools docker)`;

type Placing = { readonly fake: FakeHost; readonly home: string; projects: unknown[] };

// The plugin with `local`, mac and build, each online, and the list `projects` holds as the projects plugin's; none provided
// when `provided` is false.
async function placing(provided = true): Promise<Placing> {
	machine("mac-mini", "Darwin arm64");
	machine("build-box");
	const { fake } = await load({ local: LOCAL, list: [MAC, BUILD] });
	const at: Placing = { fake, home: dirname(fake.host.folder), projects: [] };
	if (provided) fake.provide("projects", () => at.projects);
	return at;
}

// The project `acme` as the projects plugin serves it, with `requires` when given: a repository with one commit holding
// ticket AC0001, whose `ticket.md` has `json` as its JSON block, none when undefined.
function acme(requires?: unknown, json?: string): Readonly<Record<string, unknown>> {
	const folder = join(temporaryFolder(), "acme");
	mkdirSync(join(folder, "spec/features/AC0001-one"), { recursive: true });
	writeFileSync(join(folder, "spec/features/AC0001-one/ticket.md"), `# AC0001 - One\n${json === undefined ? "" : `\n\`\`\`json\n${json}\n\`\`\`\n`}\n## Goal\n`);
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", folder]);
	execFileSync("git", ["-C", folder, "add", "--all"]);
	execFileSync("git", ["-C", folder, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first"]);
	return { name: "acme", path: folder, prefix: "AC", ...(requires === undefined ? {} : { requires }) };
}

const TICKET = "spec/features/AC0001-one/ticket.md";
// What the core asks `jobs.place` (packages/core/src/jobs.ts), with `asked` over it.
const place = (at: Placing, asked: Readonly<Record<string, unknown>> = {}) =>
	at.fake.call<Promise<string>>("jobs.place", { task: "Go.", kind: "worker", project: "acme", model: undefined, thinking: undefined, quick: undefined, timeoutMinutes: 120, budgetUsd: 2, tickets: [], machine: undefined, requires: undefined, ...asked });

// A job's record on `machine` in `state`, as the core's runner writes it.
function job(at: Placing, id: string, machine: string, state = "working"): void {
	const folder = join(at.home, "jobs", `2026-10-18-worker-${id}`);
	mkdirSync(folder, { recursive: true });
	for (const [name, text] of Object.entries({ kind: "worker", project: "acme", machine, state })) writeFileSync(join(folder, name), text);
}

test("a job's labels: --requires, else its ticket's, else its project's; a ticket's replaces the project's whole, an empty one clears it", async () => {
	const at = await placing();
	at.projects = [acme({ tools: ["xcodebuild"] }, '{ "id": "AC0001", "title": "One" }')];
	assert.equal(await place(at, { tickets: [TICKET] }), "mac", "a ticket without requires: the project's");
	assert.equal(await place(at), "mac", "no ticket: the project's");
	at.projects = [acme({ tools: ["xcodebuild"] }, '{ "id": "AC0001", "requires": { "tools": ["docker"] } }')];
	assert.equal(await place(at, { tickets: [TICKET] }), "local", "the ticket's alone: docker, which only local has");
	assert.equal(await place(at, { tickets: ["spec/features/AC0001-one/plan.md"] }), "local", "any file of the ticket's folder names it");
	assert.equal(await place(at, { tickets: [TICKET], requires: { os: "macos", tools: ["xcodebuild"] } }), "mac", "--requires over the ticket's");
	job(at, "0000000a", "local");
	at.projects = [acme({ tools: ["xcodebuild"] }, '{ "id": "AC0001", "requires": {} }')];
	assert.equal(await place(at, { tickets: [TICKET] }), "mac", "an empty requires clears the project's: the fewest jobs");
	at.projects = [acme({ tools: ["xcodebuild"] })];
	assert.equal(await place(at, { tickets: [TICKET] }), "mac", "a ticket without a JSON block: the project's");
	at.projects = [acme(undefined, '{ "requires": { "tools": ["docker"] } }')];
	assert.equal(await place(at, { tickets: [TICKET], project: "shop" }), "mac", "a project not in the list requires nothing, its ticket unread");
});

test("without a requirement any machine: the fewest jobs in a run, local and then the list's order on a tie; no project list, no requirement", async () => {
	const at = await placing(false);
	assert.equal(await place(at, { tickets: [TICKET] }), "local");
	job(at, "0000000a", "local");
	assert.equal(await place(at), "mac");
	job(at, "0000000b", "mac");
	job(at, "0000000c", "build", "ended");
	job(at, "0000000d", "build", "blocked");
	assert.equal(await place(at), "build", "an ended job and one blocked out of its run take no room");
	writeFileSync(join(root, "build-box", "fail"), "ssh: connect to host build-box port 22: Connection timed out");
	assert.equal(await place(at), "local", "an offline machine takes no job");
});

test("the most room from resources.free when the resources plugin provides it, local and then the list's order on a tie", async () => {
	const at = await placing(false);
	const free: Record<string, number> = { local: 1, mac: 3, build: 3 };
	at.fake.provide("resources.free", (name: string) => Promise.resolve(free[name]));
	job(at, "0000000a", "mac");
	assert.equal(await place(at), "mac", "room, not the fewest jobs");
	free.local = 3;
	assert.equal(await place(at), "local");
});

test("refused before any record exists, naming the labels and each machine with its labels and state", async () => {
	const at = await placing();
	const project = acme(undefined, '{ "id": "AC0001", "requires": { "os": "macos", "tools": ["xcodebuild"] } }');
	at.projects = [project];
	writeFileSync(join(root, "build-box", "fail"), "arthur@build-box: Permission denied (publickey).");
	job(at, "0000000a", "mac");
	job(at, "0000000b", "mac", "idle");
	const machines = `${LOCAL_TEXT}: online, 0 of 3 jobs; mac (os macos, arch arm64, tools xcodebuild): online, full: 2 of 2 jobs; build (os linux, arch x64): offline: ssh build-box: arthur@build-box: Permission denied (publickey).`;
	const spawn = (request: Readonly<Record<string, unknown>>) => at.fake.host.jobs.spawn({ task: "Go.", kind: "worker", ...request });
	await assert.rejects(spawn({ requires: { tools: ["gpu", "docker"] } }), { message: `no machine has the labels; the job needs tools gpu docker (--requires); machines: ${machines}` });
	await assert.rejects(spawn({ task: `Ticket: ${TICKET}. Go.` }), { message: `every machine with the labels is offline or full; the job needs os macos, tools xcodebuild (ticket AC0001); machines: ${machines}` });
	await assert.rejects(spawn({ task: `Ticket: ${TICKET}. Go.`, machine: "build" }), { message: `machine build lacks os macos, tools xcodebuild; the job needs os macos, tools xcodebuild (ticket AC0001); machines: ${machines}` });
	await assert.rejects(spawn({ machine: "gpu" }), { message: "unknown machine gpu; machines: build, local, mac" });
	rmSync(join(at.home, "jobs", "2026-10-18-worker-0000000b"), { recursive: true });
	writeFileSync(join(root, "mac-mini", "fail"), KEY_REFUSED);
	await assert.rejects(spawn({ task: `Ticket: ${TICKET}. Go.` }), { message: /^every machine with the labels is offline or full; .*mac \(os macos, arch arm64, tools xcodebuild\): offline: ssh mac-mini: arthur@mac-mini: Permission denied/ });
	for (const id of ["0000000c", "0000000d", "0000000e"]) job(at, id, "local");
	const offline = `mac (os macos, arch arm64, tools xcodebuild): offline: ssh mac-mini: ${KEY_REFUSED}; build (os linux, arch x64): offline: ssh build-box: arthur@build-box: Permission denied (publickey).`;
	await assert.rejects(spawn({ requires: { tools: ["docker"] } }), { message: `every machine with the labels is offline or full; the job needs tools docker (--requires); machines: ${LOCAL_TEXT}: online, full: 3 of 3 jobs; ${offline}` });
	assert.deepEqual(readdirSync(join(at.home, "jobs")), ["0000000a", "0000000c", "0000000d", "0000000e"].map((id) => `2026-10-18-worker-${id}`), "no record made");
	assert.equal(existsSync(join(dirname(String(project.path)), ".arthur-worktrees")), false, "no worktree made");
});

test("--machine with the labels goes there unchecked; a ticket's broken JSON block or a requires of another shape is refused, naming it", async () => {
	const at = await placing();
	const project = acme(undefined, '{ "id": "AC0001", "requires": { "tools": ["xcodebuild"] } }');
	at.projects = [project];
	writeFileSync(join(root, "mac-mini", "fail"), KEY_REFUSED);
	assert.equal(await place(at, { tickets: [TICKET], machine: "mac" }), "mac");
	assert.deepEqual(calls(), [], "a named machine with the labels is not checked");
	const file = join(String(project.path), TICKET);
	writeFileSync(file, '# AC0001\n\n```json\n{ "id": "AC0001", }\n```\n');
	await assert.rejects(place(at, { tickets: [TICKET] }), { message: new RegExp(`^${file}: its JSON block is not JSON \\(.+\\); fix it by hand$`) });
	writeFileSync(file, '# AC0001\n\n```json\n{ "requires": { "tools": "xcodebuild" } }\n```\n');
	const shape = "requires must be { os?, arch?, tools? }, os and arch non-empty strings, tools a list of them; got";
	await assert.rejects(place(at, { tickets: [TICKET] }), { message: `ticket AC0001 (${file}): ${shape} an object` });
	await assert.rejects(place(at, { requires: { gpu: true } }), { message: `--requires: ${shape} an object` });
	at.projects = [{ ...project, requires: ["macos"] }];
	await assert.rejects(place(at), { message: `project acme: ${shape} a list` });
});
