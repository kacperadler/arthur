import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Host } from "@arthur/core/plugin";
import { type FakeHost, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { docker } from "../src/docker.ts";
import type { DockerOptions } from "../src/docker-options.ts";
import { fakeDocker, row, type State } from "./fake-docker.ts";

// The sweep of Docker's leftovers (roadmap 72) and `arthur docker`, against the fake host and the fake docker and ssh first on
// PATH, holding resources of known ages and labels; the daemon's clock, `info.SystemTime`, stands at NOW.

const bin = temporaryFolder();
const fake = fakeDocker(bin);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// Commands here run in a folder of the test's own, so a mutant that writes a relative path (npm run mutate) leaves nothing in the checkout.
process.chdir(temporaryFolder());
const NOW = "2026-01-03T00:00:00Z";
// Exactly 48 hours before NOW, said in another zone; and one minute younger.
const [OLD, YOUNG] = ["2026-01-01 01:00:00 +0100 CET", "2026-01-01 00:01:00.5 +0000 UTC"];
const GONE = "2026-01-01-worker-99999999";
const DOWN = "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?";
const ROOT = temporaryFolder();
// A whole sweep runs some 25 fake docker processes, each a node start, which a loaded machine can stretch past until's 20 s.
const SWEEP = { deadlineMs: 120_000 };

// What Docker holds: of job GONE, whose record no longer exists, and of its compose project `arthur-77777777`; of job `live`,
// which has a record; the owner's own; dangling images and unused networks, old and young; and `arthur.keep`.
function world(live: string): Partial<State> {
	const [gone, mine, keep] = [`arthur.job=${GONE}`, `arthur.job=${live}`, "arthur.keep="];
	return {
		info: { DockerRootDir: ROOT, SecurityOptions: [], ServerVersion: "29.9.2", SystemTime: NOW, Warnings: null },
		rows: {
			ps: [
				row("ps", { ID: "c01", Names: "old-web", State: "exited", Labels: gone, Mounts: "f00danon", Networks: "old_net" }),
				row("ps", { ID: "c02", Names: "old-run", State: "running", Labels: gone, Networks: "run_net" }),
				row("ps", { ID: "c03", Names: "old-db", State: "created", Labels: "com.docker.compose.project=arthur-77777777,com.docker.compose.service=db" }),
				row("ps", { ID: "c04", Names: "live-web", State: "exited", Labels: mine }),
				row("ps", { ID: "c05", Names: "live-db", State: "exited", Labels: `com.docker.compose.project=arthur-${live.slice(-8)}` }),
				row("ps", { ID: "c06", Names: "mysql", State: "exited", Labels: "", Mounts: "mysql_data", Networks: "owner_net", CreatedAt: OLD }),
				row("ps", { ID: "c07", Names: "kept-web", State: "exited", Labels: `${gone},${keep}` }),
				row("ps", { ID: "c08", Names: "old-paused", State: "paused", Labels: gone }),
				row("ps", { ID: "c09", Names: "old-dead", State: "dead", Labels: gone }),
			],
			"network-ls": [
				row("network-ls", { ID: "n01", Name: "old_net", Labels: gone }),
				row("network-ls", { ID: "n02", Name: "run_net", Labels: gone }),
				row("network-ls", { ID: "n03", Name: "stale_net", Labels: "", CreatedAt: OLD }),
				row("network-ls", { ID: "n04", Name: "young_net", Labels: "", CreatedAt: YOUNG }),
				row("network-ls", { ID: "n05", Name: "owner_net", Labels: "", CreatedAt: OLD }),
				row("network-ls", { ID: "n06", Name: "bridge", Labels: "", CreatedAt: OLD }),
				row("network-ls", { ID: "n07", Name: "keep_net", Labels: keep, CreatedAt: OLD }),
				row("network-ls", { ID: "n08", Name: "live_net", Labels: mine, CreatedAt: OLD }),
			],
			"volume-ls": [
				row("volume-ls", { Name: "old_data", Labels: gone }),
				row("volume-ls", { Name: "f00danon", Labels: "com.docker.volume.anonymous=" }),
				row("volume-ls", { Name: "stray_anon", Labels: "com.docker.volume.anonymous=" }),
				row("volume-ls", { Name: "mysql_data", Labels: "" }),
				row("volume-ls", { Name: "keep_data", Labels: `${gone},${keep}` }),
				row("volume-ls", { Name: "live_data", Labels: mine }),
			],
			"image-ls": [
				row("image-ls", { ID: "a00000000001", Repository: "old", Tag: "latest", CreatedAt: YOUNG }),
				row("image-ls", { ID: "a00000000002", Repository: "oldcompose-db", Tag: "latest", CreatedAt: YOUNG }),
				row("image-ls", { ID: "a00000000003", Repository: "<none>", Tag: "<none>", CreatedAt: OLD }),
				row("image-ls", { ID: "a00000000004", Repository: "<none>", Tag: "<none>", CreatedAt: YOUNG }),
				row("image-ls", { ID: "a00000000005", Repository: "<none>", Tag: "<none>", CreatedAt: OLD }),
				row("image-ls", { ID: "a00000000006", Repository: "<none>", Tag: "<none>", CreatedAt: OLD }),
				row("image-ls", { ID: "a00000000007", Repository: "postgres", Tag: "16", CreatedAt: OLD }),
				// Pulled by digest: a repository and no tag, so not dangling.
				row("image-ls", { ID: "a00000000008", Repository: "postgres", Tag: "<none>", CreatedAt: OLD }),
			],
		},
		imageLabels: { a00000000001: gone, a00000000002: "com.docker.compose.project=arthur-77777777", a00000000005: keep, a00000000006: mine },
		sizes: { c01: 100e6, c03: 50e6, old_data: 1e9, f00danon: 200e6, a00000000001: 300e6, a00000000002: 400e6, a00000000003: 100e6, a00000000007: 500e6 },
		cache: 12 * 1024 ** 3,
		cacheUsedAt: "2026-01-01T00:00:00Z",
	};
}

// The calls that change something, as the fake docker got them.
const changes = (from: number) => fake.calls().slice(from).filter((args) => ["stop", "rm", "prune"].includes(args[1] ?? ""));
const names = (kind: "ps" | "network-ls" | "volume-ls" | "image-ls") => (fake.now().rows[kind] ?? []).map((each) => String(each.Names ?? each.Name ?? `${each.Repository}:${each.Tag}:${each.ID}`));
// The free space df measures changes between runs: said as <n>.
const steady = (text: string) => text.replace(/\d+(\.\d)? GB free on/g, "<n> GB free on");

// The plugin on the fake host on a repository of its own, the test as the machines plugin (`labels` by machine) and, unless
// `schedule` is false, as the schedule plugin; `gpu` and `far` registered, reached through the fake ssh; `run` in place of the core's.
async function load(labels: Readonly<Record<string, unknown>>, options: DockerOptions = {}, schedule = true, run?: Host["jobs"]["run"]) {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	const host = fakeHost({ name: "docker", root, options: options as Readonly<Record<string, unknown>> });
	host.provide("machines.labels", (name: string) => labels[name]);
	const entries: { readonly id: string; readonly at: string; readonly option: string; readonly run: () => Promise<void> }[] = [];
	if (schedule) host.provide("schedule.register", (_plugin: string, list: typeof entries) => void entries.push(...list));
	const homes = { gpu: temporaryFolder(), far: temporaryFolder() };
	for (const [name, home] of Object.entries(homes)) host.host.jobs.registerMachine({ name, ssh: name, home, labels: {} });
	const plugin = docker(options);
	await host.setup({ setup: (given) => plugin.setup(run === undefined ? given : { ...given, jobs: { ...given.jobs, run } }) });
	const home = dirname(host.host.folder);
	const notices = () => host.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text);
	return { host, plugin, entries, homes, home, notices };
}

// `arthur docker <args>` as the CLI runs it: what it printed and its exit code.
async function arthur(t: TestContext, host: FakeHost, ...args: string[]) {
	const [out, err] = [[] as string[], [] as string[]];
	const log = t.mock.method(console, "log", (line: string) => out.push(line));
	const error = t.mock.method(console, "error", (line: string) => err.push(line));
	const code = await host.commands.find((command) => command.name === "docker")?.run({ args, project: undefined });
	log.mock.restore();
	error.mock.restore();
	return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
}

// A job of the test's own with a record, ended; its prepare wrote its script folder.
async function liveJob(host: FakeHost, home: string): Promise<string> {
	const job = await host.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(home, "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	return job.id;
}

test("--dry-run lists what a real run removes and why, removing nothing; the run removes just that, keeps the rest, and a second finds nothing", async (t) => {
	const { host, home } = await load({ local: { tools: ["docker"] } });
	const live = await liveJob(host, home);
	fake.state(world(live));
	const folders = join(home, "docker", "jobs");
	mkdirSync(join(folders, GONE), { recursive: true });
	mkdirSync(join(folders, "not.a.job"));
	let from = fake.calls().length;
	const reason = `its job ${GONE} no longer exists`;
	assert.deepEqual(await arthur(t, host, "sweep", "--dry-run"), {
		code: 0,
		out: [
			`local: would remove container old-web (${reason})`,
			"local: would remove container old-db (its job arthur-77777777 no longer exists)",
			`local: would remove container old-dead (${reason})`,
			`local: would remove network old_net (${reason})`,
			`local: would remove network run_net (${reason})`,
			"local: would remove network stale_net (unused, 48 h old)",
			`local: would remove volume old_data (${reason})`,
			`local: would remove image old:latest (${reason})`,
			"local: would remove image oldcompose-db:latest (its job arthur-77777777 no longer exists)",
			"local: would remove image a00000000003 (dangling, 48 h old)",
			`local: would remove script folder ${folders}/${GONE}`,
			"local: would prune the build cache unused for 48 h, then cut it to 10G",
			"local: --dry-run: 11 would be removed; nothing removed",
		].join("\n"),
		err: "",
	});
	assert.deepEqual(changes(from), []);
	assert.equal(existsSync(join(folders, GONE)), true);
	from = fake.calls().length;
	const swept = await arthur(t, host, "sweep");
	const refused = `kept network run_net: Error response from daemon: error while removing network: network run_net has active endpoints (name:"old-run" id:"c02")`;
	assert.deepEqual({ ...swept, out: steady(swept.out) }, {
		code: 0,
		out: `local: removed 3 containers, 2 networks, 1 volume, 3 images, 1 script folder; ${refused}; build cache cut to 10G; 15.03GB reclaimed; <n> GB free on ${ROOT}`,
		err: "",
	});
	assert.deepEqual(changes(from), [
		["container", "rm", "--volumes", "c01"],
		["container", "rm", "--volumes", "c03"],
		["container", "rm", "--volumes", "c09"],
		["network", "rm", "n01"],
		["network", "rm", "n02"],
		["network", "rm", "n03"],
		["volume", "rm", "old_data"],
		["image", "rm", "a00000000001"],
		["image", "rm", "a00000000002"],
		["image", "rm", "a00000000003"],
		["builder", "prune", "--force", "--filter", "until=48h"],
		["builder", "prune", "--force", "--max-used-space", "10G"],
	]);
	assert.deepEqual(
		[names("ps"), names("network-ls"), names("volume-ls"), names("image-ls")],
		[
			["old-run", "live-web", "live-db", "mysql", "kept-web", "old-paused"],
			["run_net", "young_net", "owner_net", "bridge", "keep_net", "live_net"],
			["stray_anon", "mysql_data", "keep_data", "live_data"],
			["<none>:<none>:a00000000004", "<none>:<none>:a00000000005", "<none>:<none>:a00000000006", "postgres:16:a00000000007", "postgres:<none>:a00000000008"],
		],
		"the created and dead containers went, the anonymous volume with old-web; a running or paused container, the owner's own, an image pulled by digest, the young, arthur.keep and the live job's stay",
	);
	assert.deepEqual([existsSync(join(folders, GONE)), existsSync(join(folders, live)), existsSync(join(folders, "not.a.job"))], [false, true, true]);
	assert.equal(fake.now().cache, 0, "the cache unused for 48 h went");
	const again = await arthur(t, host, "sweep");
	assert.equal(steady(again.out), `local: nothing to remove; ${refused}; build cache cut to 10G; 0B reclaimed; <n> GB free on ${ROOT}`);
});

test("arthur docker: Docker's usage and what each job labelled on each machine, the jobs that no longer exist marked", async (t) => {
	const { host, home } = await load({ local: { tools: ["docker"] }, gpu: { tools: ["docker"] } });
	const live = await liveJob(host, home);
	fake.state(world(live));
	fake.offline("gpu");
	const from = fake.calls().length;
	assert.deepEqual(await arthur(t, host), {
		code: 1,
		out: [
			`local: Docker's data root ${ROOT}`,
			"  Images: 8 (0 active), 1.3GB, 1.3GB reclaimable",
			"  Containers: 9 (0 active), 150MB, 150MB reclaimable",
			"  Local Volumes: 6 (0 active), 1.2GB, 1.2GB reclaimable",
			"  Build Cache: 0 (0 active), 12.88GB, 12.88GB reclaimable",
			`  ${GONE} (no longer exists, so the sweep removes them): 5 containers, 2 networks, 2 volumes, 1 image`,
			"  arthur-77777777 (no longer exists, so the sweep removes them): 1 container, 1 image",
			`  ${live}: 2 containers, 1 network, 1 volume, 1 image`,
			"gpu: offline: ssh: connect to host gpu port 22: Connection refused",
		].join("\n"),
		err: "",
	});
	assert.deepEqual(changes(from), [], "it only reads");
	const bare = await load({ local: { tools: ["git"] } });
	assert.deepEqual(await arthur(t, bare.host), { code: 0, out: "no machine is labelled tools: docker (the machines plugin's labels), so the docker plugin acts on none", err: "" });
});

test("sweep.at registers a daily entry, refused at load without the schedule plugin; one notice per sweep, none when it changed nothing", async () => {
	const { host, entries, home, notices } = await load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" }, buildCache: 0 });
	assert.deepEqual(entries.map(({ id, at, option }) => ({ id, at, option })), [{ id: "sweep", at: "04:00", option: "sweep.at" }]);
	fake.state(world(await liveJob(host, home)));
	await entries[0]?.run();
	assert.deepEqual(notices().map(steady), [
		[
			"docker: the sweep (daily):",
			`- local: removed 3 containers, 2 networks, 1 volume, 3 images; kept network run_net: Error response from daemon: error while removing network: network run_net has active endpoints (name:"old-run" id:"c02"); 15.03GB reclaimed; <n> GB free on ${ROOT}`,
		].join("\n"),
	]);
	await entries[0]?.run();
	assert.equal(notices().length, 1, "nothing reclaimed, nothing failed, no machine under its floor");
	assert.deepEqual((await load({ local: { tools: ["docker"] } })).entries, [], "no entry without sweep.at");
	await assert.rejects(load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" } }, false), {
		message: "sweep.at needs the schedule plugin, which runs the daily sweep; add schedule() to the config's plugins, or leave sweep out",
	});
});

test("a sweep that removes nothing still sends its notice when a machine failed, one stays under its floor, or the build cache alone gave space back", async () => {
	// Nothing to remove, the cache used just now: only a failure or a floor can make the notice.
	const bare: Partial<State> = { info: { DockerRootDir: ROOT, SecurityOptions: [], ServerVersion: "29.9.2", SystemTime: NOW, Warnings: null }, rows: {}, cache: 0 };
	fake.state(bare);
	fake.offline("gpu");
	const offline = await load({ gpu: { tools: ["docker"] } }, { sweep: { at: "04:00" } });
	await offline.entries[0]?.run();
	assert.deepEqual(offline.notices(), ["docker: the sweep (daily):\n- gpu: offline: ssh: connect to host gpu port 22: Connection refused; not swept"]);
	const low = await load({ local: { tools: ["docker"] } });
	await low.plugin.start?.();
	low.host.emit("disk-low", { machine: "local", path: ROOT, free: 5, floor: 1e18 });
	const [floor = ""] = await until("the floor's notice", () => (low.notices().length > 0 ? low.notices() : undefined), SWEEP);
	assert.match(floor, /^docker: the sweep \(disk-low on local\):\n- local: nothing to remove; build cache cut to 10G; 0B reclaimed; [\d.]+ GB free on \S+; still under the floor: [\d.]+ GB free on \S+, floor 931322574\.6 GB$/);
	// The cache unused for 48 h, 2 GB of it: the sweep's only gain.
	fake.state({ ...bare, cache: 2e9, cacheUsedAt: "2026-01-01T00:00:00Z" });
	const cache = await load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" } });
	await cache.entries[0]?.run();
	assert.deepEqual(cache.notices().map(steady), [`docker: the sweep (daily):\n- local: nothing to remove; build cache cut to 10G; 2GB reclaimed; <n> GB free on ${ROOT}`]);
});

test("a labelled machine where command -v finds no docker is no failure: no notice, exit 0 for arthur docker and its sweep", async (t) => {
	const { host, entries, notices } = await load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" } });
	const bare = temporaryFolder();
	symlinkSync("/bin/sh", join(bare, "sh"));
	const saved = process.env.PATH;
	process.env.PATH = bare;
	t.after(() => void (process.env.PATH = saved));
	const from = fake.calls().length;
	await entries[0]?.run();
	assert.deepEqual(notices(), [], "nothing failed");
	assert.deepEqual(await arthur(t, host), { code: 0, out: "local: command -v finds no docker there", err: "" });
	assert.deepEqual(await arthur(t, host, "sweep"), { code: 0, out: "local: command -v finds no docker there", err: "" });
	assert.equal(fake.calls().length, from, "docker is not reached");
});

test("a config that lists the schedule plugin after docker loads: docker's setup runs after schedule's, so sweep.at finds it", () => {
	const folder = temporaryFolder();
	execFileSync("git", ["init", "--quiet", folder]);
	const plugin = JSON.stringify(fileURLToPath(new URL("../src/docker.ts", import.meta.url)));
	const schedule = `{ name: "schedule", setup(host) { host.provide("schedule.register", () => undefined); } }`;
	writeFileSync(join(folder, "arthur.config.ts"), `import { docker } from ${plugin};\nexport default { plugins: [{ name: "orchestration", setup() {} }, docker({ sweep: { at: "04:00" } }), ${schedule}] };\n`);
	const env = { PATH: process.env.PATH ?? "", HOME: folder, XDG_CONFIG_HOME: join(folder, ".config"), ARTHUR_JOB: "" };
	const run = spawnSync(process.execPath, [fileURLToPath(import.meta.resolve("@arthur/core/cli")), "docker", "--help"], { cwd: folder, encoding: "utf8", env });
	assert.equal(run.status, 0, run.stderr);
	assert.match(run.stdout, /^# arthur docker\n/);
});

test("disk-low sweeps that machine in arthur run, and the notice says it is still under its floor; another machine's, or before the start, nothing", async (t) => {
	const { host, plugin, home, notices } = await load({ local: { tools: ["docker"] }, gpu: { tools: ["docker"] } });
	fake.state(world(await liveJob(host, home)));
	const from = fake.calls().length;
	host.emit("disk-low", { machine: "local", path: ROOT, free: 5, floor: 1e18 });
	host.emit("disk-low", { machine: "far", path: ROOT, free: 5, floor: 1e18 });
	await plugin.start?.();
	host.emit("disk-low", { machine: "far", path: ROOT, free: 5, floor: 1e18 });
	assert.equal(fake.calls().length, from, "before the start, or on a machine without the label, docker is not asked");
	host.emit("disk-low", { machine: "local", path: ROOT, free: 5, floor: 1e18 });
	const [notice = ""] = await until("the disk-low sweep's notice", () => (notices().length > 0 ? notices() : undefined), SWEEP);
	assert.match(notice, /^docker: the sweep \(disk-low on local\):\n- local: removed 3 containers, 2 networks, 1 volume, 3 images; .*; build cache cut to 10G; 15\.03GB reclaimed; [\d.]+ GB free on (\S+); still under the floor: [\d.]+ GB free on \1, floor 931322574\.6 GB$/);
	assert.match((await arthur(t, host, "sweep", "--machine", "local")).out, /; still under the floor: [\d.]+ GB free on .*, floor 931322574\.6 GB$/, "the floor kept for the sweep by hand");
	host.emit("disk-low", { machine: "local", path: ROOT, free: 5, floor: 1 });
	// The disk-low's sweep took the machine's lock at the emit; a sweep by hand waits for it to end, notice included.
	assert.doesNotMatch((await arthur(t, host, "sweep", "--machine", "local")).out, /under the floor/, "the floor the last disk-low named");
	assert.equal(notices().length, 1, "back above its floor and nothing to reclaim: no notice");
});

test("a machine offline is skipped and Docker stopped on another is named, the rest swept; exit 1 by hand", async (t) => {
	const { host, homes, notices, entries } = await load({ local: { tools: ["docker"] }, gpu: { tools: ["docker"] }, far: { tools: ["docker"] } }, { sweep: { at: "04:00" } });
	fake.state(world("2026-01-01-worker-0a1b2c3d"));
	mkdirSync(join(homes.gpu, "docker", "jobs", GONE), { recursive: true });
	fake.offline("gpu");
	fake.stopped("far", true);
	t.after(() => fake.stopped("far", false));
	await entries[0]?.run();
	const [notice = ""] = notices();
	assert.deepEqual(notice.split("\n").slice(2), ["- gpu: offline: ssh: connect to host gpu port 22: Connection refused; not swept", `- far: Docker does not answer: ${DOWN}; not swept`]);
	assert.match(notice.split("\n")[1] ?? "", /^- local: removed 5 containers, 3 networks, 2 volumes, 4 images; /, "the job of the world has no record here");
	assert.equal(existsSync(join(homes.gpu, "docker", "jobs", GONE)), true);
	const swept = await arthur(t, host, "sweep", "--machine", "far", "--dry-run");
	assert.deepEqual(swept, { code: 1, out: `far: Docker does not answer: ${DOWN}; not swept`, err: "" });
});

test("a disk-low during the daily sweep waits for it: never two sweeps of one machine at once", async () => {
	const order: string[] = [];
	const { promise: held, resolve: release } = Promise.withResolvers<void>();
	const run: Host["jobs"]["run"] = async (machine, argv, limit, input) => {
		const call = order.filter((step) => step.startsWith("start")).length;
		order.push(`start ${call}`);
		if (call === 0) await held;
		const ran = await loaded.host.host.jobs.run(machine, argv, limit, input);
		order.push(`end ${call}`);
		return ran;
	};
	const loaded = await load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" } }, true, run);
	fake.state(world("2026-01-01-worker-0a1b2c3d"));
	await loaded.plugin.start?.();
	const daily = loaded.entries[0]?.run();
	await until("the daily sweep's listing", () => (order.length > 0 ? true : undefined));
	loaded.host.emit("disk-low", { machine: "local", path: ROOT, free: 5, floor: 1 });
	// Every step a disk-low's sweep takes before its first command, had it no lock to wait for.
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(order, ["start 0"], "the second waits");
	release();
	await daily;
	await until("the disk-low's sweep", () => (order.length === 8 ? true : undefined), SWEEP);
	assert.deepEqual(order, ["start 0", "end 0", "start 1", "end 1", "start 2", "end 2", "start 3", "end 3"]);
});

test("Docker stopping half-way, or the removal cut by its limit: what went is named, and what is left", async () => {
	fake.state({ ...world("2026-01-01-worker-0a1b2c3d"), crash: "network rm" });
	const { entries, notices } = await load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" } });
	await entries[0]?.run();
	fake.down(false);
	const left = "network old_net, network run_net, network stale_net, network live_net, volume old_data, volume live_data, image old:latest, image oldcompose-db:latest, image a00000000003, image a00000000006";
	assert.equal(notices()[0], `docker: the sweep (daily):\n- local: Docker stopped answering half-way: removed 5 containers; left: ${left}`);
	const limits: (number | undefined)[] = [];
	const late: Host["jobs"]["run"] = async (machine, argv, limit, input) => {
		limits.push(limit);
		if (limits.length === 1) return cut.host.host.jobs.run(machine, argv, limit, input);
		return { code: null, stdout: "removed container:c01\n", stderr: `timed out after ${limit} s\n` };
	};
	fake.state(world("2026-01-01-worker-0a1b2c3d"));
	const cut = await load({ local: { tools: ["docker"] } }, { sweep: { at: "04:00" } }, true, late);
	await cut.entries[0]?.run();
	assert.match(cut.notices()[0] ?? "", /\n- local: the removal timed out after 600 s half-way: removed 1 container; left: container old-db, container live-web, /);
	assert.deepEqual(limits, [60, 600]);
});

test("buildCache 0 cuts nothing; the legacy builder's refusal of --max-used-space is named, the rest done", async (t) => {
	const { host } = await load({ local: { tools: ["docker"] } }, { buildCache: "2G", leftoverHours: 49 });
	fake.state({ ...world("2026-01-01-worker-0a1b2c3d"), buildx: false });
	const from = fake.calls().length;
	const swept = await arthur(t, host, "sweep");
	assert.match(swept.out, /; build cache not cut: unknown flag: --max-used-space; /);
	assert.deepEqual(changes(from).filter((args) => args[0] === "network").map((args) => args[2]), ["n01", "n02", "n08"], "49 h: the 48 h old unlabelled network stays");
	assert.deepEqual(changes(from).at(-2), ["builder", "prune", "--force", "--filter", "until=49h"]);
	const none = await load({ local: { tools: ["docker"] } }, { buildCache: 0 });
	fake.state(world("2026-01-01-worker-0a1b2c3d"));
	const before = fake.calls().length;
	await arthur(t, none.host, "sweep");
	assert.deepEqual(changes(before).filter((args) => args[0] === "builder"), [["builder", "prune", "--force", "--filter", "until=48h"]]);
});

test("arthur docker sweep refuses an unknown or unlabelled machine and a flag it does not take, sweeping nothing", async (t) => {
	const { host } = await load({ local: { tools: ["docker"] } });
	fake.state(world("2026-01-01-worker-0a1b2c3d"));
	const from = fake.calls().length;
	const usage = "usage: arthur docker [sweep [--machine <name>] [--dry-run]]";
	assert.deepEqual(await arthur(t, host, "sweep", "--machine", "nope"), { code: 2, out: "", err: "arthur docker sweep: unknown machine nope; machines: local, gpu, far" });
	assert.deepEqual(await arthur(t, host, "sweep", "--machine", "gpu"), { code: 2, out: "", err: "arthur docker sweep: machine gpu is not labelled tools: docker; labelled: local" });
	for (const args of [["nope"], ["--dry-run"], ["sweep", "--machine"], ["sweep", "--dry-run", "--dry-run"], ["sweep", "--machine", "local", "--machine", "local"], ["sweep", "--force"], ["sweep", "local"]])
		assert.deepEqual(await arthur(t, host, ...args), { code: 2, out: "", err: usage }, args.join(" "));
	assert.deepEqual(fake.calls().length, from, "docker is not asked");
});
