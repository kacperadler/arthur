import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import type { Host, Job, Prepare } from "@arthur/core/plugin";
import { fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { docker } from "../src/docker.ts";
import { labelled } from "../src/docker-label.ts";
import { fakeDocker } from "./fake-docker.ts";

// The labels on what a job creates (spec/roadmap.md, entry 70): the argument rewrite, and the prepare that writes each job's
// `docker` script on its machine, against the fake host, the fake docker and ssh first on PATH, and real Git.

const ID = "2026-11-09-worker-0a1b2c3d";
const LABEL = ["--label", `arthur.job=${ID}`];
// What a command that makes a container gets: the job's label, then the container's.
const RUN = [...LABEL, "--label", `arthur.container=${ID}`];
// What a build gets: the job's label, then both marks of a container, empty.
const BUILD = [...LABEL, "--label", "arthur.container=", "--label", "com.docker.compose.config-hash="];
const BUILDS = [["build"], ["buildx", "build"], ["buildx", "b"], ["image", "build"], ["builder", "build"]];
// What a commit gets, twice, before its container: both marks of a container set empty by its last changes.
const CHANGE = ["--change", 'LABEL arthur.container="" com.docker.compose.config-hash=""'];
const COMMIT = [...CHANGE, ...CHANGE];

test("each command that creates something gets the job's label right after its words, one that makes a container its container label too, a build both marks of a container empty; every other command passes unchanged", () => {
	for (const words of [["run"], ["create"], ["container", "run"], ["container", "create"]]) assert.deepEqual(labelled([...words, "x"], ID), [...words, ...RUN, "x"], words.join(" "));
	for (const words of BUILDS) assert.deepEqual(labelled([...words, "x"], ID), [...words, ...BUILD, "x"], words.join(" "));
	for (const words of [["network", "create"], ["volume", "create"]]) assert.deepEqual(labelled([...words, "x"], ID), [...words, ...LABEL, "x"], words.join(" "));
	const same = [["ps", "-a"], ["compose", "up", "-d"], ["image", "ls"], ["network", "ls"], ["volume", "rm", "x"], ["buildx", "ls"], ["exec", "c", "run"], ["start", "run"], [], ["--version"], ["--", "ps"], ["-", "run"]];
	for (const args of [...same, ["builder", "prune"], ["buildx", "bake"], ["image", "commit", "c"], ["exec", "c", "commit"], ["-", "commit", "c"]]) assert.deepEqual(labelled(args, ID), args, args.join(" "));
});

test("a commit gets both marks of a container set empty by its last two changes, right before its container, after every option of the job's own", () => {
	const mine = "LABEL arthur.container=2026-11-09-worker-ffffffff com.docker.compose.config-hash=9f8e";
	const rows: [string[], string[]][] = [
		[["commit", "web"], ["commit", ...COMMIT, "web"]],
		[["commit", "web", "shop:snap"], ["commit", ...COMMIT, "web", "shop:snap"]],
		[["container", "commit", "web"], ["container", "commit", ...COMMIT, "web"]],
		[["commit"], ["commit", ...COMMIT]],
		// A change of the job's own, in each spelling: the script's come after it.
		[["commit", "--change", mine, "web"], ["commit", "--change", mine, ...COMMIT, "web"]],
		[["commit", "-c", mine, `-c${mine}`, `--change=${mine}`, `-pc${mine}`, "web", "repo"], ["commit", "-c", mine, `-c${mine}`, `--change=${mine}`, `-pc${mine}`, ...COMMIT, "web", "repo"]],
		// An option that takes the next word takes it whatever it looks like: an option, a `--`, the container's name.
		[["commit", "-m", "--", "web"], ["commit", "-m", "--", ...COMMIT, "web"]],
		[["commit", "--author", "-c", "web"], ["commit", "--author", "-c", ...COMMIT, "web"]],
		[["commit", "--message", "web", "c1", "repo"], ["commit", "--message", "web", ...COMMIT, "c1", "repo"]],
		[["commit", "-a", "web", "c1"], ["commit", "-a", "web", ...COMMIT, "c1"]],
		[["commit", "-pm", "web", "c1"], ["commit", "-pm", "web", ...COMMIT, "c1"]],
		[["commit", "-c"], ["commit", "-c", ...COMMIT]],
		// One that holds its value, or takes none, takes no word.
		[["commit", "-pmnote", "c1"], ["commit", "-pmnote", ...COMMIT, "c1"]],
		[["commit", "-mc", "c1"], ["commit", "-mc", ...COMMIT, "c1"]],
		[["commit", "--message=note", "--author=me", "c1"], ["commit", "--message=note", "--author=me", ...COMMIT, "c1"]],
		[["commit", "-p=false", "--no-pause", "--pause", "c1"], ["commit", "-p=false", "--no-pause", "--pause", ...COMMIT, "c1"]],
		// The options end at a `--`, a `-` or the first other word; a change after that is no option, and Docker refuses the third word.
		[["commit", "-m", "x", "--", "web", "repo"], ["commit", "-m", "x", ...COMMIT, "--", "web", "repo"]],
		[["commit", "-", "repo"], ["commit", ...COMMIT, "-", "repo"]],
		[["commit", "web", "--change", mine], ["commit", ...COMMIT, "web", "--change", mine]],
		// Docker's own options before the command.
		[["-D", "--", "commit", "web"], ["-D", "--", "commit", ...COMMIT, "web"]],
		[["--context", "commit", "container", "commit", "-m", "note", "web"], ["--context", "commit", "container", "commit", "-m", "note", ...COMMIT, "web"]],
	];
	for (const [args, expected] of rows) assert.deepEqual(labelled(args, ID), expected, args.join(" "));
});

test("a build drops every word that sets compose's config hash too, in each spelling; any other command keeps it", () => {
	const hash = "com.docker.compose.config-hash";
	for (const given of [["--label", `${hash}=9f8e`], [`--label=${hash}=9f8e`], ["-l", `${hash}=9f8e`], [`-l${hash}=9f8e`], [`-l=${hash}=9f8e`], ["--label", hash], [`--label=${hash}=`], [`${hash}=9f8e`]]) {
		for (const words of BUILDS) assert.deepEqual(labelled([...words, ...given, "."], ID), [...words, ...BUILD, "."], `${words.join(" ")} ${given.join(" ")}`);
		assert.deepEqual(labelled(["build", "--", ".", ...given], ID), ["build", ...BUILD, "--", "."], `after a -- ${given.join(" ")}`);
		for (const [words, own] of [[["run"], RUN], [["container", "create"], RUN], [["network", "create"], LABEL], [["volume", "create"], LABEL]] as const)
			assert.deepEqual(labelled([...words, ...given, "x"], ID), [...words, ...own, ...given, "x"], `${words.join(" ")} ${given.join(" ")}`);
	}
	for (const kept of [["--label", `${hash}es=1`], ["--label", `x.${hash}=1`], ["--label", "com.docker.compose.project=arthur-0a1b2c3d"], ["--build-arg", `HASH=${hash}=1`]])
		assert.deepEqual(labelled(["build", ...kept, "."], ID), ["build", ...BUILD, ...kept, "."], kept.join(" "));
});

test("global options before the command keep their values, and the label still goes after the command", () => {
	for (const globals of [["--log-level", "debug"], ["-l", "debug"], ["--log-level=debug"], ["-H", "unix:///run/docker.sock"], ["-Hunix:///run/docker.sock"], ["--context", "run"], ["-c", "run"], ["-D"], ["--tls", "--tlscert", "run"], ["--config", "/c", "--debug"]])
		assert.deepEqual(labelled([...globals, "run", "img"], ID), [...globals, "run", ...RUN, "img"], globals.join(" "));
	for (const valued of ["--config", "--context", "--host", "--log-level", "--tlscacert", "--tlscert", "--tlskey", "-c", "-H", "-l"])
		assert.deepEqual(labelled([valued, "run", "run", "img"], ID), [valued, "run", "run", ...RUN, "img"], `${valued} takes the next word as its value`);
	assert.deepEqual(labelled(["--", "run", "-l", "arthur.job=other", "img"], ID), ["--", "run", ...RUN, "img"], "docker runs the command after a leading --");
	assert.deepEqual(labelled(["-D", "--", "volume", "create", "v"], ID), ["-D", "--", "volume", "create", ...LABEL, "v"]);
});

test("buildx's own options before build keep their place, the label goes after build, and a foreign arthur.job goes", () => {
	const other = "arthur.job=2026-11-09-worker-ffffffff";
	for (const own of [["--builder", "x"], ["--debug"], ["-D"], ["--builder=x"], ["--debug=true"], ["--builder", "build"], ["--builder", "-D", "-D"], ["--builder", "x", "-D"]])
		assert.deepEqual(labelled(["buildx", ...own, "build", "--label", other, "."], ID), ["buildx", ...own, "build", ...BUILD, "."], own.join(" "));
	assert.deepEqual(labelled(["-D", "buildx", "--builder", "x", "build", "."], ID), ["-D", "buildx", "--builder", "x", "build", ...BUILD, "."]);
	assert.deepEqual(labelled(["buildx", "--builder", "x", "b", "."], ID), ["buildx", "--builder", "x", "b", ...BUILD, "."]);
	for (const args of [["buildx", "--builder", "x", "ls"], ["buildx", "-D", "bake"], ["buildx", "--builder"], ["buildx", "--", "build", "."], ["buildx", "--debug", "-", "build"]])
		assert.deepEqual(labelled(args, ID), args, args.join(" "));
});

test("every word that sets arthur.job or arthur.container goes, in each spelling and wherever it stands; a label with another key is kept", () => {
	for (const other of ["arthur.job=2026-11-09-worker-ffffffff", "arthur.container=2026-11-09-worker-ffffffff"]) {
		const key = other.slice(0, other.indexOf("="));
		for (const given of [["--label", other], [`--label=${other}`], ["-l", other], [`-l${other}`], [`-l=${other}`], ["--label", key], [`--label=${key}=`], [other]])
			for (const [command, own] of [[["run"], RUN], [["create"], RUN], [["container", "run"], RUN], [["build"], BUILD], [["volume", "create"], LABEL]] as const)
				assert.deepEqual(labelled([...command, ...given, "img"], ID), [...command, ...own, "img"], `${command.join(" ")} ${given.join(" ")}`);
	}
	const other = "arthur.job=2026-11-09-worker-ffffffff";
	assert.deepEqual(labelled(["run", "-dl", other, "img"], ID), ["run", ...RUN, "-d", "img"], "-dl: its l taken out, -d kept");
	assert.deepEqual(labelled(["run", `-itl${other}`, "img"], ID), ["run", ...RUN, "-it", "img"]);
	assert.deepEqual(labelled(["build", "--label", other, ".", `--label=${other}`, "-t", "app"], ID), ["build", ...BUILD, ".", "-t", "app"]);
	// `--env=X=arthur.job=1`: as long as `--label=` before the key, and no label.
	for (const kept of [["--label", "arthur.jobs=1"], ["--label", "arthur.containers=1"], ["--label", "com.example=arthur.job=x"], ["-l", "arthur.keep"], ["--label-file", "labels"], ["--label", "x.arthur.job=1"], ["-e", "A=1", "-p", "80:80"], ["--rm", "-it"], ["--env=X=arthur.job=1"]])
		assert.deepEqual(labelled(["run", ...kept, "img", "sh", "-c", "echo"], ID), ["run", ...RUN, ...kept, "img", "sh", "-c", "echo"], kept.join(" "));
	// Words after the image or a `--`: what sets arthur.job goes there too, as Docker may read it as an option (review 3).
	const after = ["--label", "arthur.job=x", "-l", "arthur.job=y", `--label=${other}`, "arthur.job=z", "--label", "arthur.container=x"];
	assert.deepEqual(labelled(["run", "img", "echo", ...after, "done"], ID), ["run", ...RUN, "img", "echo", "done"]);
	assert.deepEqual(labelled(["create", "--", "img", ...after], ID), ["create", ...RUN, "--", "img"]);
	assert.deepEqual(labelled(["build", "--", ...after, "."], ID), ["build", ...BUILD, "--", "."]);
	// A literal --label or -- as another option's value, then the job's own try at another label: that label never stays.
	const rows: [string[], string[]][] = [
		[["build", "--build-arg", "--label", `--label=${other}`, "."], ["build", ...BUILD, "--build-arg", "--label", "."]],
		[["build", "-f", "--label", "--label", other, "."], ["build", ...BUILD, "-f", "--label", "."]],
		[["buildx", "build", "--tag", "--label", `--label=${other}`, "."], ["buildx", "build", ...BUILD, "--tag", "--label", "."]],
		[["image", "build", "--target", "--label", "--label", other, "."], ["image", "build", ...BUILD, "--target", "--label", "."]],
		[["network", "create", "--driver", "--label", `--label=${other}`, "net"], ["network", "create", ...LABEL, "--driver", "--label", "net"]],
		[["volume", "create", "-o", "--label", `--label=${other}`, "v"], ["volume", "create", ...LABEL, "-o", "--label", "v"]],
		[["network", "create", "-l", other, "net"], ["network", "create", ...LABEL, "net"]],
	];
	for (const [command, option] of [[["build"], "--build-arg"], [["volume", "create"], "--label"], [["network", "create"], "--driver"], [["buildx", "build"], "-t"], [["image", "build"], "--label"], [["run"], "-e"], [["create"], "--name"]] as const) {
		const own = command[0] === "run" || command[0] === "create" ? RUN : command.at(-1) === "build" ? BUILD : LABEL;
		rows.push([[...command, option, "--", `--label=${other}`, "x"], [...command, ...own, option, "--", "x"]]);
		rows.push([[...command, option, "--", "--label", other, "x"], [...command, ...own, option, "--", "x"]]);
		rows.push([[...command, option, "--", "-l", other, "x"], [...command, ...own, option, "--", "x"]]);
	}
	for (const [args, expected] of rows) assert.deepEqual(labelled(args, ID), expected, args.join(" "));
	assert.deepEqual(labelled(["run", "--label"], ID), ["run", ...RUN, "--label"], "a label without its value is Docker's to refuse");
});

// The fake docker, ssh and `omp` on PATH: the agent notes its environment in its worktree, then plays the fake agent.
const bin = temporaryFolder();
const fake = fakeDocker(bin);
const agent = fakeAgent({ steps: [{ message: "Done." }] });
writeFileSync(join(bin, "omp"), `#!/bin/sh\nenv > "$PWD/.agent-env"\nexec '${agent}' "$@"\n`, { mode: 0o755 });
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// Commands here run in a folder of the test's own, so a mutant that writes a relative path (npm run mutate) leaves nothing in the checkout.
process.chdir(temporaryFolder());
// A PATH with `sh` alone: a machine without docker.
const bare = temporaryFolder();
symlinkSync("/bin/sh", join(bare, "sh"));
symlinkSync(join(bin, "ssh"), join(bare, "ssh"));

function repository(): string {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	return root;
}

// The plugin on the fake host, the test as the machines plugin answering `labels`, and as projects when `pieces` are given;
// `prepare` runs the plugin's prepare as the core does at a spawn, on a job of `project` on `machine`.
async function load(labels: Readonly<Record<string, unknown>>, pieces?: unknown, run?: Host["jobs"]["run"]) {
	const root = repository();
	const host = fakeHost({ name: "docker", root });
	host.provide("machines.labels", (name: string) => labels[name]);
	if (pieces !== undefined) host.provide("projects", () => [{ name: "shop", path: root, prefix: "SH", pieces }]);
	const prepares: Prepare[] = [];
	await docker().setup({ ...host.host, jobs: { ...host.host.jobs, ...(run === undefined ? {} : { run }), prepare: (fn: Prepare) => void prepares.push(fn) } } as Host);
	// The fields of a Job the prepare reads; the rest are the spawn's.
	const job = (id: string, machine: string, project: string) => ({ id, machine, project }) as Job;
	const prepare = async (machine = "local", env: Readonly<Record<string, string>> = {}, project = "shop", id = ID) => prepares[0]?.(job(id, machine, project), env, false);
	const notices = () => host.emitted.flatMap((event) => (event.name === "notice" && typeof event.data === "object" && event.data !== null && "text" in event.data ? [event.data.text] : []));
	return { host, prepare, notices, home: dirname(host.host.folder) };
}

test("a job on a machine labelled tools: docker gets its script first on PATH and its own compose project; the script labels and passes the rest", async () => {
	const { host, prepare, home } = await load({ local: { os: "linux", tools: ["git", "docker"] } });
	const folder = join(home, "docker", "jobs", ID);
	assert.deepEqual(await prepare(), { PATH: `${folder}:${process.env.PATH}`, COMPOSE_PROJECT_NAME: "arthur-0a1b2c3d" });
	assert.deepEqual(await prepare("local", { PATH: "/opt/node/bin:/usr/bin" }), { PATH: `${folder}:/opt/node/bin:/usr/bin`, COMPOSE_PROJECT_NAME: "arthur-0a1b2c3d" }, "before the PATH a prepare before it gave");
	assert.equal(statSync(join(folder, "docker")).mode & 0o777, 0o755);
	assert.equal(readFileSync(join(folder, "docker-label.ts"), "utf8"), readFileSync(new URL("../src/docker-label.ts", import.meta.url), "utf8"));
	const run = (...args: string[]) => spawnSync(join(folder, "docker"), args, { encoding: "utf8" });
	const ran = run("-D", "--log-level", "debug", "run", "-l", "arthur.job=other", "--rm", "img", "--label", "arthur.job=x");
	assert.deepEqual([ran.status, ran.stdout.length], [0, 65], "docker's output and exit code pass through: the container's full ID");
	assert.deepEqual(fake.calls().at(-1), ["-D", "--log-level", "debug", "run", ...RUN, "--rm", "img"]);
	assert.deepEqual([run("nope").status, run("nope").stderr], [1, "docker: 'nope' is not a docker command.\nSee 'docker --help'\n"]);
	assert.deepEqual(host.emitted.filter((event) => event.name === "notice"), []);
});

test("nothing for a project with docker.project(false), a machine without the label, or no machines plugin: no script, no variable", async () => {
	const off = await load({ local: { tools: ["docker"] } }, { docker: false });
	assert.equal(await off.prepare(), undefined);
	assert.equal(existsSync(join(off.home, "docker", "jobs")), false);
	const other = await load({ local: { tools: ["docker"] } }, {});
	assert.equal((await other.prepare("local", {}, "web"))?.COMPOSE_PROJECT_NAME, "arthur-0a1b2c3d", "another project's piece is not this one's");
	for (const labels of [{ local: { tools: ["git"] } }, { local: {} }, { local: { tools: "docker" } }, {}]) {
		const { prepare, home } = await load(labels);
		assert.equal(await prepare(), undefined, JSON.stringify(labels));
		assert.equal(existsSync(join(home, "docker", "jobs")), false);
	}
	const root = repository();
	const alone = fakeHost({ name: "docker", root });
	await alone.setup(docker());
	const job = await alone.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(dirname(alone.host.folder), "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	assert.doesNotMatch(readFileSync(join(job.worktree, ".agent-env"), "utf8"), /COMPOSE_PROJECT_NAME|docker\/jobs/, "without machines.labels, no machine has the label");
});

test("the label but no docker on the machine: no script, no variable, and one notice per machine, said once", async () => {
	const { host, prepare, notices, home } = await load({ local: { tools: ["docker"] }, gpu: { tools: ["docker"] } });
	host.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: temporaryFolder(), labels: {} });
	const saved = process.env.PATH;
	process.env.PATH = bare;
	try {
		for (const machine of ["local", "local", "gpu", "gpu"]) assert.equal(await prepare(machine), undefined, machine);
	} finally {
		process.env.PATH = saved;
	}
	assert.equal(existsSync(join(home, "docker", "jobs")), false);
	const said = (machine: string) => `docker: machine ${machine} is labelled tools: docker, but command -v finds no docker there; its jobs get no docker script, so what they create is not labelled`;
	assert.deepEqual(notices(), [said("local"), said("gpu")]);
	assert.equal(readFileSync(join(home, "docker", "told"), "utf8"), "no-docker local\nno-docker gpu\n");
});

test("a job on another machine gets its script in Arthur's home there, written over ssh; a failed write refuses the spawn, naming the job and machine", { skip: process.getuid?.() === 0 && "root writes every folder" }, async (t) => {
	const { host, prepare } = await load({ gpu: { os: "linux", tools: ["docker"] } });
	const there = join(temporaryFolder(), "arthur-home");
	host.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: there, labels: {} });
	const folder = join(there, "docker", "jobs", ID);
	assert.deepEqual(await prepare("gpu"), { PATH: `${folder}:${process.env.PATH}`, COMPOSE_PROJECT_NAME: "arthur-0a1b2c3d" });
	assert.equal(spawnSync(join(folder, "docker"), ["volume", "create", "data"], { encoding: "utf8" }).status, 0);
	assert.deepEqual(fake.calls().at(-1), ["volume", "create", ...LABEL, "data"]);
	const jobs = join(there, "docker", "jobs");
	chmodSync(jobs, 0o500);
	t.after(() => chmodSync(jobs, 0o700));
	await assert.rejects(prepare("gpu", {}, "shop", "2026-11-09-worker-22222222"), { message: /^writing the docker script of 2026-11-09-worker-22222222 on machine gpu exited 1: mkdir: cannot create directory .*Permission denied$/ });
	fake.offline("gpu");
	await assert.rejects(prepare("gpu"), { message: /^writing the docker script of 2026-11-09-worker-0a1b2c3d on machine gpu exited 255: ssh: connect to host gpu port 22: Connection refused$/ });
});

test("refused, naming why: no node on the machine to run the script, and a path holding a ' the script could not quote", async () => {
	const { host, prepare } = await load({ local: { tools: ["docker"] }, quoted: { tools: ["docker"] } });
	const tools = temporaryFolder();
	symlinkSync("/bin/sh", join(tools, "sh"));
	symlinkSync(join(bin, "docker"), join(tools, "docker"));
	const saved = process.env.PATH;
	process.env.PATH = tools;
	const nodeless = await prepare().then(() => "prepared", (error: Error) => error.message).finally(() => (process.env.PATH = saved));
	assert.equal(nodeless, `writing the docker script of ${ID} on machine local exited 4: command -v finds no node, which runs the script`);
	const there = join(temporaryFolder(), "it's home");
	host.host.jobs.registerMachine({ name: "quoted", ssh: "quoted", home: there, labels: {} });
	const quoted = await prepare("quoted").then(() => "prepared", (error: Error) => error.message);
	assert.ok(quoted.startsWith(`writing the docker script of ${ID} on machine quoted exited 4: a path with a ' in it: ${there}/docker/jobs/${ID}, /`), quoted);
	assert.ok(quoted.endsWith(` or ${bin}/docker`), quoted);
	assert.equal(existsSync(there), false, "nothing written there");
});

test("the script's write is cut after 30 s on a machine that hangs, refusing the spawn with the limit named", async () => {
	// As the core's `run` answers a command it cut: code null, its line last on stderr; no real wait.
	const limits: (number | undefined)[] = [];
	const hung: Host["jobs"]["run"] = async (_machine, _argv, limitSeconds) => (limits.push(limitSeconds), { code: null, stdout: "", stderr: `timed out after ${limitSeconds} s\n` });
	const { prepare } = await load({ local: { tools: ["docker"] } }, undefined, hung);
	await assert.rejects(prepare(), { message: `writing the docker script of ${ID} on machine local timed out after 30 s` });
	assert.deepEqual(limits, [30]);
});

test("a spawned job's agent gets the variables the prepare returned", async () => {
	const root = repository();
	const host = fakeHost({ name: "docker", root });
	host.provide("machines.labels", () => ({ tools: ["docker"] }));
	await host.setup(docker());
	const job = await host.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => readFileSync(join(dirname(host.host.folder), "jobs", job.id, "state"), "utf8") === "ended" || undefined);
	const env = readFileSync(join(job.worktree, ".agent-env"), "utf8");
	assert.match(env, new RegExp(`^COMPOSE_PROJECT_NAME=arthur-${job.id.slice(-8)}$`, "m"));
	assert.match(env, new RegExp(`^PATH=${join(dirname(host.host.folder), "docker", "jobs", job.id)}:`, "m"));
});
