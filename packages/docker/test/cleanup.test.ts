import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
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

// What job `id` made: `web` running, by its script, and `db` of its compose project, stopped; a network of each, `shared_net` holding
// another job's running container; its volume `data`, the anonymous volume of `web`, and `cache`, which the other container mounts;
// the image it built, `shop:latest`, and one its compose project built that the other container runs; `postgres:16`, pulled. Sizes
// in bytes; the build cache 1 GB over 10G.
function made(id: string): Partial<State> {
	const [mine, compose] = [`arthur.job=${id}`, `com.docker.compose.project=arthur-${id.slice(-8)}`];
	return {
		rows: {
			ps: [
				row("ps", { ID: "c0000000000a", Names: "web", State: "running", Labels: `${mine},arthur.container=${id}`, Mounts: "data,f00d0000anon", Networks: "shop_net", Image: "shop:latest" }),
				row("ps", { ID: "c0000000000b", Names: "db", State: "exited", Labels: `${compose},com.docker.compose.service=db,com.docker.compose.config-hash=9f8e`, Networks: "shop_net", Image: "postgres:16" }),
				row("ps", { ID: OTHER, Names: "other-web", State: "running", Labels: "arthur.job=2026-01-01-worker-99999999,arthur.container=2026-01-01-worker-99999999", Mounts: "cache", Networks: "bridge,shared_net", Image: "1111aaaa2222" }),
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
	`kept image shop-tools:latest: Error response from daemon: conflict: unable to remove repository reference "shop-tools:latest" (must force) - container ${OTHER} is using its referenced image 1111aaaa2222`,
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
		["image", "rm", "shop:latest"],
		["image", "rm", "shop-tools:latest"],
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

test("the owner's containers from the job's images stay, running or stopped, with their volumes; the container the job made goes", async () => {
	const { host, home } = await load({ local: { tools: ["docker"] } });
	host.provide("jobs.keep", () => "the test keeps it");
	const job = await host.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(home, "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	// The image the job built, and one its compose project built, each with the labels its builder gave it.
	const images = [row("image-ls", { ID: "aaaa0000000a", Repository: "shop", Tag: "latest" }), row("image-ls", { ID: "bbbb0000000b", Repository: "shop-db", Tag: "latest" })];
	const compose = `com.docker.compose.project=arthur-${job.id.slice(-8)},com.docker.compose.service=db,com.docker.compose.version=2.40.0`;
	fake.state({ rows: { "image-ls": images }, imageLabels: { aaaa0000000a: `arthur.job=${job.id}`, bbbb0000000b: compose } });
	execFileSync(join(home, "docker", "jobs", job.id, "docker"), ["run", "-d", "--name", "web", "-v", "/cache", "shop:latest"]);
	execFileSync(join(fake.bin, "docker"), ["run", "-d", "--name", "owner-web", "-v", "/data", "shop:latest"]);
	execFileSync(join(fake.bin, "docker"), ["create", "--name", "owner-db", "-v", "owner_data:/var/lib/postgresql/data", "shop-db:latest"]);
	const [web, owner, ownerDb] = fake.now().rows.ps ?? [];
	assert.deepEqual([web?.Labels, owner?.Labels, ownerDb?.Labels], [`arthur.job=${job.id},arthur.container=${job.id}`, `arthur.job=${job.id}`, compose], "each took its image's labels");
	const from = fake.calls().length;
	const conflict = "Error response from daemon: conflict: unable to remove repository reference";
	const kept = `kept image shop:latest: ${conflict} "shop:latest" (must force) - container ${owner?.ID} is using its referenced image aaaa0000000a; kept image shop-db:latest: ${conflict} "shop-db:latest" (must force) - container ${ownerDb?.ID} is using its referenced image bbbb0000000b`;
	const line = `docker: removed 1 container; ${kept}; build cache cut to 10G; 0B freed`;
	assert.deepEqual(await host.host.jobs.prune([job.id]), [`${job.id}: ${line}; worktree ${job.worktree} removed; branch ${job.branch} deleted; kept the record: the test keeps it`]);
	assert.deepEqual(changes(from).slice(0, 2), [["container", "stop", "--timeout", "10", web?.ID], ["container", "rm", "--volumes", web?.ID]]);
	assert.deepEqual(fake.now().rows.ps, [owner, ownerDb], "the owner's containers untouched, the running one still running");
	assert.deepEqual(names("volume-ls"), [owner?.Mounts, "owner_data"], "web's anonymous volume went with it; the owner's stay");
});

test("an image the job built or committed gives no container the job's marks, whatever its Dockerfile, a --label-file, the committed container or a change of the job's own held: the owner's containers from it stay, the job's own go", async () => {
	const { host, home } = await load({ local: { tools: ["docker"] } });
	host.provide("jobs.keep", () => "the test keeps it");
	const job = await host.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(home, "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	// Both marks of a container of the job's: the script's, and compose's config hash beside its project.
	const [project, hash] = [`com.docker.compose.project=arthur-${job.id.slice(-8)}`, "com.docker.compose.config-hash"];
	const marks = [`arthur.container=${job.id}`, project, `${hash}=9f8e`];
	const folder = temporaryFolder();
	writeFileSync(join(folder, "Dockerfile"), `FROM postgres:16\nLABEL ${marks.join(" ")}\n`);
	writeFileSync(join(folder, "marks"), `${marks.join("\n")}\n`);
	fake.state({ rows: { "image-ls": [row("image-ls", { ID: "bbbb0000000b", Repository: "postgres", Tag: "16" })] } });
	const mine = (...args: string[]) => execFileSync(join(home, "docker", "jobs", job.id, "docker"), args);
	const owner = (...args: string[]) => execFileSync(join(fake.bin, "docker"), args);
	// The job's images: built from a Dockerfile that sets the marks; committed from its container run with a --label-file of them,
	// from its compose container (compose makes it through Docker's API, past the script), and with a change of its own that sets them
	// before one that ends in a line continuation.
	mine("build", "-t", "shop:built", folder);
	mine("run", "-d", "--name", "web", "--label-file", join(folder, "marks"), "postgres:16");
	owner("create", "--name", "db", "--label", project, "--label", `${hash}=9f8e`, "postgres:16");
	mine("commit", "web", "shop:filed");
	mine("container", "commit", "db", "shop:db");
	mine("commit", "-c", `LABEL ${marks.join(" ")}`, "--change", "ENV a=\\", "db", "shop:changed");
	// The owner's container from each, and two more of the job's from them: one its script made, one its compose project made.
	owner("run", "-d", "--name", "owner-built", "-v", "/data", "shop:built");
	for (const name of ["filed", "db", "changed"]) owner("create", "--name", `owner-${name}`, `shop:${name}`);
	mine("create", "--name", "again", "shop:filed");
	owner("create", "--name", "db-again", "--label", project, "--label", `${hash}=77aa`, "shop:built");
	const [web, db, ...rest] = fake.now().rows.ps ?? [];
	const [owners, [again, dbAgain]] = [rest.slice(0, 4), rest.slice(4)];
	const read = (labels: unknown) => Object.fromEntries(String(labels).split(",").map((pair) => [pair.split("=")[0], pair.slice(pair.indexOf("=") + 1)]));
	assert.deepEqual(
		owners.map((each) => [each.Names, read(each.Labels)["arthur.container"], read(each.Labels)[hash], read(each.Labels)["com.docker.compose.project"]]),
		["built", "filed", "db", "changed"].map((name) => [`owner-${name}`, "", "", `arthur-${job.id.slice(-8)}`]),
		"each took its image's labels: the job's compose project, and both marks empty",
	);
	assert.deepEqual([read(again?.Labels)["arthur.container"], read(dbAgain?.Labels)[hash]], [job.id, "77aa"], "the job's own carry the mark their maker gave them");
	const from = fake.calls().length;
	const image = (tag: string) => (fake.now().rows["image-ls"] ?? []).find((each) => each.Repository === "shop" && each.Tag === tag)?.ID;
	const kept = owners.map((each) => {
		const tag = `shop:${String(each.Names).slice(6)}`;
		return `kept image ${tag}: Error response from daemon: conflict: unable to remove repository reference "${tag}" (must force) - container ${each.ID} is using its referenced image ${image(tag.slice(5))}`;
	});
	const line = `docker: removed 4 containers; ${kept.join("; ")}; build cache cut to 10G; 0B freed`;
	assert.deepEqual(await host.host.jobs.prune([job.id]), [`${job.id}: ${line}; worktree ${job.worktree} removed; branch ${job.branch} deleted; kept the record: the test keeps it`]);
	assert.deepEqual(changes(from)[0], ["container", "stop", "--timeout", "10", web?.ID, again?.ID, db?.ID, dbAgain?.ID]);
	assert.deepEqual(fake.now().rows.ps, owners, "the owner's containers untouched, the running one still running");
	assert.deepEqual(names("volume-ls"), [owners[0]?.Mounts], "the owner's anonymous volume stays");
});

test("an image the job built with two tags goes by each tag and counts once, a dangling one by its ID; one the owner's container uses keeps its last tag", async () => {
	const { hook } = await load({ local: { tools: ["docker"] } });
	const compose = `com.docker.compose.project=arthur-${ID.slice(-8)},com.docker.compose.service=db`;
	const tagged = (id: string, repository: string, ...tags: string[]) => tags.map((tag) => row("image-ls", { ID: id, Repository: repository, Tag: tag }));
	const images = [...tagged("aaaa0000000a", "app", "latest", "abc1234"), ...tagged("cccc0000000c", "db", "latest", "v1"), ...tagged("dddd0000000d", "<none>", "<none>")];
	const owner = row("ps", { ID: "c0000000000d", Names: "owner-db", State: "exited", Labels: compose, Image: "db:v1" });
	fake.state({ rows: { ps: [owner], "image-ls": images }, imageLabels: { aaaa0000000a: `arthur.job=${ID}`, cccc0000000c: compose, dddd0000000d: `arthur.job=${ID}` } });
	const from = fake.calls().length;
	const kept = `kept image db:v1: Error response from daemon: conflict: unable to remove repository reference "db:v1" (must force) - container c0000000000d is using its referenced image cccc0000000c`;
	assert.equal(await hook(), `removed 2 images; ${kept}; build cache cut to 10G; 0B freed`);
	const removals = [["image", "rm", "app:latest"], ["image", "rm", "app:abc1234"], ["image", "rm", "dddd0000000d"], ["image", "rm", "db:latest"], ["image", "rm", "db:v1"]];
	assert.deepEqual(changes(from).slice(0, 5), removals);
	assert.deepEqual(fake.now().rows["image-ls"], [images[3]], "app and the dangling image went; db lost the tag no container uses");
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

test("one listing Docker refuses while it answers the rest: the hook gives up on the job, touching nothing", async () => {
	const { hook } = await load({ local: { tools: ["docker"] } });
	fake.state(made(ID));
	// A docker first on PATH that refuses one listing alone, by the job's label or by its compose project, and passes every other call to the fake.
	for (const listing of ["container ls --all --filter label=arthur.container=", "container ls --all --filter label=com.docker.compose.project=", "image ls --filter label=com.docker.compose.project="]) {
		const refusing = temporaryFolder();
		const script = `case "$*" in "${listing}"*) echo "Error response from daemon: invalid filter" >&2; exit 1;; esac`;
		writeFileSync(join(refusing, "docker"), `#!/bin/sh\n${script}\nexec '${join(fake.bin, "docker")}' "$@"\n`, { mode: 0o755 });
		const [path, from] = [process.env.PATH, fake.calls().length];
		process.env.PATH = [refusing, path].join(delimiter);
		await assert.rejects(hook().finally(() => (process.env.PATH = path)), { message: "listing what the job made exited 1: Error response from daemon: invalid filter; what the job made there is left for the sweep" }, listing);
		assert.deepEqual(changes(from), [], listing);
		assert.deepEqual(names("ps"), ["web", "db", "other-web"], listing);
	}
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

test("the space freed counts what other jobs add meanwhile, and is never below 0B", async () => {
	fake.state(made(ID));
	let calls = 0;
	// Another job pulls 5 GB on the machine while the removal runs.
	const busy: Host["jobs"]["run"] = async (machine, argv, limit, input) => {
		if (calls++ === 1) fake.state({ ...fake.now(), sizes: { ...fake.now().sizes, bbbb0000000b: 5.5e9 } });
		return loaded.host.host.jobs.run(machine, argv, limit, input);
	};
	const loaded = await load({ local: { tools: ["docker"] } }, { buildCache: 0 }, undefined, busy);
	assert.equal(await loaded.hook(), `removed 2 containers, 1 network, 1 volume, 1 image; ${KEPT.join("; ")}; 0B freed`);
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

test("a removal cut after an image's first tag leaves that image to the sweep by its other tag; one cut after its last tag leaves nothing", async () => {
	const images = ["latest", "abc1234"].map((tag) => row("image-ls", { ID: "aaaa0000000a", Repository: "app", Tag: tag }));
	fake.state({ rows: { "image-ls": images }, imageLabels: { aaaa0000000a: `arthur.job=${ID}` } });
	const said = ["removed image:app:latest\n", "removed image:app:latest\nremoved image:app:abc1234\n"];
	let calls = 0;
	const late: Host["jobs"]["run"] = async (machine, argv, limit, input) =>
		calls++ % 2 === 0 ? loaded.host.host.jobs.run(machine, argv, limit, input) : { code: null, stdout: said.shift() ?? "", stderr: `timed out after ${limit} s\n` };
	const loaded = await load({ local: { tools: ["docker"] } }, {}, undefined, late);
	await assert.rejects(loaded.hook(), { message: "the removal timed out after 85 s half-way: nothing of the job's in Docker; left for the sweep: image app:abc1234" });
	await assert.rejects(loaded.hook(), { message: "the removal timed out after 85 s half-way: removed 1 image" });
});
