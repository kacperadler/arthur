import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import type { Host } from "@arthur/core/plugin";
import { fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { docker } from "../src/docker.ts";
import { type DockerOptions } from "../src/docker-options.ts";
import { fakeDocker, row, type State } from "./fake-docker.ts";

// The cleanup of what a job made in Docker, right before its worktree goes (roadmap 71): real Git through the fake host's
// spawn and prune, and the fake docker and ssh first on PATH, holding the job's resources and another job's.

const bin = temporaryFolder();
const fake = fakeDocker(bin);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// Commands here run in a folder of the test's own, so a mutant that writes a relative path (npm run mutate) leaves nothing in the checkout.
process.chdir(temporaryFolder());
const ID = "2026-01-01-worker-0a1b2c3d";
const OTHER = "c0000000000c";

// What job `id` made: `web` running and `db` of its compose project, stopped; a network of each, `shared_net` holding another
// job's running container; its volume `data`, the anonymous volume of `web`, and `cache`, which the other container mounts; the
// image it built, `shop:latest`, and one its compose project built that the other container runs; `postgres:16`, pulled. Sizes
// in bytes; the build cache 1 GB over 10G.
function made(id: string): Partial<State> {
	const [mine, compose] = [`arthur.job=${id}`, `com.docker.compose.project=arthur-${id.slice(-8)}`];
	return {
		rows: {
			ps: [
				row("ps", { ID: "c0000000000a", Names: "web", State: "running", Labels: mine, Mounts: "data,f00d0000anon", Networks: "shop_net", Image: "shop:latest" }),
				row("ps", { ID: "c0000000000b", Names: "db", State: "exited", Labels: `${compose},com.docker.compose.service=db`, Networks: "shop_net", Image: "postgres:16" }),
				row("ps", { ID: OTHER, Names: "other-web", State: "running", Labels: "arthur.job=2026-01-01-worker-99999999", Mounts: "cache", Networks: "bridge,shared_net", Image: "1111aaaa2222" }),
			],
			"network-ls": [row("network-ls", { ID: "n0000000000a", Name: "shop_net", Labels: compose }), row("network-ls", { ID: "n0000000000b", Name: "shared_net", Labels: mine }), row("network-ls", { ID: "n0000000000c", Name: "bridge", Labels: "" })],
			"volume-ls": [row("volume-ls", { Name: "data", Labels: mine }), row("volume-ls", { Name: "f00d0000anon", Labels: "com.docker.volume.anonymous=" }), row("volume-ls", { Name: "cache", Labels: mine })],
			"image-ls": [row("image-ls", { ID: "aaaa0000000a", Repository: "shop", Tag: "latest" }), row("image-ls", { ID: "1111aaaa2222", Repository: "shop-tools", Tag: "latest" }), row("image-ls", { ID: "bbbb0000000b", Repository: "postgres", Tag: "16" })],
		},
		imageLabels: { aaaa0000000a: mine, "1111aaaa2222": `${compose},com.docker.compose.service=tools` },
		sizes: { c0000000000a: 100e6, c0000000000b: 50e6, [OTHER]: 5e6, data: 1e9, f00d0000anon: 200e6, cache: 10e6, aaaa0000000a: 300e6, "1111aaaa2222": 400e6, bbbb0000000b: 500e6 },
		cache: 10 * 1024 ** 3 + 1e9,
	};
}

const KEPT = [
	`kept network shared_net: Error response from daemon: error while removing network: network shared_net has active endpoints (name:"other-web" id:"${OTHER}")`,
	`kept volume cache: Error response from daemon: remove cache: volume is in use - [${OTHER}]`,
	`kept image shop-tools:latest: Error response from daemon: conflict: unable to delete 1111aaaa2222 (cannot be forced) - image is being used by running container ${OTHER}`,
];
// The calls that change something, as the fake docker got them.
const changes = (from: number) => fake.calls().slice(from).filter((args) => ["stop", "rm", "prune"].includes(args[1] ?? ""));
const names = (kind: "ps" | "network-ls" | "volume-ls" | "image-ls") => (fake.now().rows[kind] ?? []).map((each) => String(each.Names ?? each.Name ?? each.Repository));

// The plugin on the fake host on a repository of its own, the test as the machines plugin (`labels` by machine) and, given
// `pieces`, as projects; `gpu` and `far` registered, reached through the fake ssh; `run` in place of the core's when given.
// `hook(machine)` runs the cleanup hook it registered on job ID there.
async function load(labels: Readonly<Record<string, unknown>>, options: DockerOptions = {}, pieces?: unknown, run?: Host["jobs"]["run"]) {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	const host = fakeHost({ name: "docker", root, options: options as Readonly<Record<string, unknown>> });
	host.provide("machines.labels", (name: string) => labels[name]);
	if (pieces !== undefined) host.provide("projects", () => [{ name: "shop", path: root, prefix: "SH", pieces }]);
	const homes = { gpu: temporaryFolder(), far: temporaryFolder() };
	for (const [name, home] of Object.entries(homes)) host.host.jobs.registerMachine({ name, ssh: name, home, labels: {} });
	const hooks: Parameters<Host["jobs"]["cleanup"]>[0][] = [];
	const plugin = docker(options);
	await host.setup({ setup: (given) => plugin.setup({ ...given, jobs: { ...given.jobs, ...(run === undefined ? {} : { run }), cleanup: (fn) => (hooks.push(fn), given.jobs.cleanup(fn)) } }) });
	const job = { id: ID, kind: "worker", project: "shop", task: "", state: "ended", reason: "finished", branch: "", worktree: "" };
	const hook = async (machine = "local") => hooks[0]?.({ ...job, machine });
	return { host, homes, hook, home: dirname(host.host.folder) };
}

test("a pruned job's containers stop and go with their anonymous volumes, then its networks, volumes and images; what Docker refuses is kept and named; the cache is cut; one line", async () => {
	const { host, home } = await load({ local: { tools: ["docker"] } });
	host.provide("jobs.keep", () => "the test keeps it");
	const job = await host.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(home, "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	const folder = join(home, "docker", "jobs", job.id);
	assert.equal(existsSync(join(folder, "docker")), true, "the spawn wrote its script");
	fake.state(made(job.id));
	const from = fake.calls().length;
	const docker = `docker: removed 2 containers, 1 network, 1 volume, 1 image; ${KEPT.join("; ")}; build cache cut to 10G; 2.65GB freed`;
	assert.deepEqual(await host.host.jobs.prune([job.id]), [`${job.id}: ${docker}; worktree ${job.worktree} removed; branch ${job.branch} deleted; kept the record: the test keeps it`]);
	assert.deepEqual(changes(from), [
		["container", "stop", "--timeout", "10", "c0000000000a", "c0000000000b"],
		["container", "rm", "--volumes", "c0000000000a"],
		["container", "rm", "--volumes", "c0000000000b"],
		["network", "rm", "n0000000000b"],
		["network", "rm", "n0000000000a"],
		["volume", "rm", "data"],
		["volume", "rm", "cache"],
		["image", "rm", "aaaa0000000a"],
		["image", "rm", "1111aaaa2222"],
		["builder", "prune", "--force", "--max-used-space", "10G"],
	]);
	assert.deepEqual([names("ps"), names("network-ls"), names("volume-ls"), names("image-ls")], [["other-web"], ["shared_net", "bridge"], ["cache"], ["shop-tools", "postgres"]], "the anonymous volume went with web; the pulled image stays");
	assert.deepEqual([existsSync(folder), existsSync(job.worktree)], [false, false]);
	// The other job's container gone, the next prune takes what it held; then nothing is left, and only the cap runs.
	const state = fake.now();
	fake.state({ ...state, rows: { ...state.rows, ps: [] } });
	assert.deepEqual(await host.host.jobs.prune([job.id]), [`${job.id}: docker: removed 1 network, 1 volume, 1 image; build cache cut to 10G; 410MB freed; kept the record: the test keeps it`]);
	const again = fake.calls().length;
	assert.deepEqual(await host.host.jobs.prune([job.id]), [`${job.id}: docker: nothing of the job's in Docker; build cache cut to 10G; 0B freed; kept the record: the test keeps it`]);
	assert.deepEqual(changes(again), [["builder", "prune", "--force", "--max-used-space", "10G"]]);
});

test("Docker not running: the worktree goes all the same, one notice names the job, the machine and the reason, and nothing of the job's is touched", async () => {
	const { host, home } = await load({ local: { tools: ["docker"] } });
	const job = await host.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(home, "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	fake.state(made(job.id));
	fake.down(true);
	const from = fake.calls().length;
	const line = await host.host.jobs.prune([job.id]).finally(() => fake.down(false));
	assert.deepEqual(line, [`${job.id}: worktree ${job.worktree} removed; branch ${job.branch} deleted; record deleted`]);
	assert.deepEqual(changes(from), []);
	assert.deepEqual(names("ps"), ["web", "db", "other-web"]);
	const notices = readFileSync(join(home, "events.jsonl"), "utf8").trim().split("\n").map((each) => JSON.parse(each)).filter((event) => event.name === "notice");
	const daemon = "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?";
	assert.deepEqual(notices.map((event) => event.data.text), [`prune of job ${job.id} on machine local: docker's cleanup gave up: Docker does not answer: ${daemon}; what the job made there is left for the sweep; the prune went on without it`]);
});

test("Docker stopping half-way: what went stays gone, the rest is named for the sweep", async () => {
	const { hook } = await load({ local: { tools: ["docker"] } });
	fake.state({ ...made(ID), crash: "volume rm" });
	await assert.rejects(hook().finally(() => fake.down(false)), {
		message: "Docker stopped answering half-way: removed 2 containers, 1 network; left for the sweep: network shared_net, volume data, volume cache, image shop:latest, image shop-tools:latest",
	});
	assert.deepEqual([names("ps"), names("network-ls"), names("volume-ls")], [["other-web"], ["shared_net", "bridge"], ["data", "cache"]]);
});

test("a job on another machine is cleaned there, every command through host.jobs.run; that machine offline touches nothing", async () => {
	const machines: string[] = [];
	const run: Host["jobs"]["run"] = async (machine, argv, limit, input) => (machines.push(machine), host.host.jobs.run(machine, argv, limit, input));
	const { host, homes, hook } = await load({ gpu: { tools: ["docker"] }, far: { tools: ["docker"] } }, {}, undefined, run);
	fake.state(made(ID));
	mkdirSync(join(homes.gpu, "docker", "jobs", ID), { recursive: true });
	assert.equal(await hook("gpu"), `removed 2 containers, 1 network, 1 volume, 1 image; ${KEPT.join("; ")}; build cache cut to 10G; 2.65GB freed`);
	assert.deepEqual(machines, ["gpu", "gpu"]);
	assert.equal(existsSync(join(homes.gpu, "docker", "jobs", ID)), false);
	fake.state(made(ID));
	fake.offline("far");
	const from = fake.calls().length;
	await assert.rejects(hook("far"), { message: "listing what the job made exited 255: ssh: connect to host far port 22: Connection refused; what the job made there is left for the sweep" });
	assert.equal(fake.calls().length, from, "docker is not reached");
});

test("nothing to clean, and no line: no docker on the machine, a machine without the label, a project with docker.project(false)", async () => {
	fake.state(made(ID));
	const from = fake.calls().length;
	const bare = temporaryFolder();
	symlinkSync("/bin/sh", join(bare, "sh"));
	const { hook } = await load({ local: { tools: ["docker"] } });
	const saved = process.env.PATH;
	process.env.PATH = bare;
	const missing = await hook().finally(() => (process.env.PATH = saved));
	assert.equal(missing, undefined);
	assert.equal(await (await load({ local: { tools: ["git"] } })).hook(), undefined);
	assert.equal(await (await load({ local: { tools: ["docker"] } }, {}, { docker: false })).hook(), undefined);
	assert.equal(fake.calls().length, from, "docker is not asked");
	assert.match((await (await load({ local: { tools: ["docker"] } }, {}, {})).hook()) ?? "", /^removed 2 containers/, "another piece of the project leaves it on");
});

test("buildCache 0 cuts no cache; a builder without --max-used-space is named in the line, the rest done", async () => {
	fake.state(made(ID));
	const from = fake.calls().length;
	assert.equal(await (await load({ local: { tools: ["docker"] } }, { buildCache: 0 })).hook(), `removed 2 containers, 1 network, 1 volume, 1 image; ${KEPT.join("; ")}; 1.65GB freed`);
	assert.deepEqual(changes(from).filter((args) => args[0] === "builder"), []);
	fake.state({ ...made(ID), buildx: false });
	assert.equal(
		await (await load({ local: { tools: ["docker"] } }, { buildCache: "2G" })).hook(),
		`removed 2 containers, 1 network, 1 volume, 1 image; ${KEPT.join("; ")}; build cache not cut: unknown flag: --max-used-space; 1.65GB freed`,
	);
});

test("each call has its limit, both under the core's 2 minutes: the listing cut after 30 s, the removal after 85 s, naming what went", async () => {
	const limits: (number | undefined)[] = [];
	const hung: Host["jobs"]["run"] = async (_machine, _argv, limit) => (limits.push(limit), { code: null, stdout: "", stderr: `timed out after ${limit} s\n` });
	fake.state(made(ID));
	await assert.rejects((await load({ local: { tools: ["docker"] } }, {}, undefined, hung)).hook(), { message: "listing what the job made timed out after 30 s; what the job made there is left for the sweep" });
	let calls = 0;
	const late: Host["jobs"]["run"] = async (machine, argv, limit, input) => {
		limits.push(limit);
		if (calls++ === 0) return loaded.host.host.jobs.run(machine, argv, limit, input);
		return { code: null, stdout: "removed container:c0000000000a\nkept container:c0000000000b no\n", stderr: `timed out after ${limit} s\n` };
	};
	const loaded = await load({ local: { tools: ["docker"] } }, {}, undefined, late);
	await assert.rejects(loaded.hook(), {
		message: "the removal timed out after 85 s half-way: removed 1 container; left for the sweep: container db, network shared_net, network shop_net, volume data, volume cache, image shop:latest, image shop-tools:latest",
	});
	assert.deepEqual(limits, [30, 30, 85]);
});
