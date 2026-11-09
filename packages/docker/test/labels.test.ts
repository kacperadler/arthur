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

test("each command that creates something gets the job's label right after its words; every other command passes unchanged", () => {
	for (const words of [["run"], ["create"], ["container", "run"], ["container", "create"], ["build"], ["buildx", "build"], ["image", "build"], ["network", "create"], ["volume", "create"]])
		assert.deepEqual(labelled([...words, "x"], ID), [...words, ...LABEL, "x"], words.join(" "));
	for (const args of [["ps", "-a"], ["compose", "up", "-d"], ["image", "ls"], ["network", "ls"], ["volume", "rm", "x"], ["buildx", "ls"], ["exec", "c", "run"], ["start", "run"], [], ["--version"], ["--", "run"], ["-", "run"]])
		assert.deepEqual(labelled(args, ID), args, args.join(" "));
});

test("global options before the command keep their values, and the label still goes after the command", () => {
	for (const globals of [["--log-level", "debug"], ["-l", "debug"], ["--log-level=debug"], ["-H", "unix:///run/docker.sock"], ["-Hunix:///run/docker.sock"], ["--context", "run"], ["-c", "run"], ["-D"], ["--tls", "--tlscert", "run"], ["--config", "/c", "--debug"]])
		assert.deepEqual(labelled([...globals, "run", "img"], ID), [...globals, "run", ...LABEL, "img"], globals.join(" "));
});

test("an arthur.job label the job gives is taken out, in each spelling; a label with another key is kept", () => {
	const other = "arthur.job=2026-11-09-worker-ffffffff";
	for (const given of [["--label", other], [`--label=${other}`], ["-l", other], [`-l${other}`], [`-l=${other}`], ["--label", "arthur.job"], ["--label=arthur.job="]])
		assert.deepEqual(labelled(["run", ...given, "img"], ID), ["run", ...LABEL, "img"], given.join(" "));
	assert.deepEqual(labelled(["run", "-dl", other, "img"], ID), ["run", ...LABEL, "-d", "img"], "-dl: its l taken out, -d kept");
	assert.deepEqual(labelled(["run", `-itl${other}`, "img"], ID), ["run", ...LABEL, "-it", "img"]);
	assert.deepEqual(labelled(["build", "--label", other, ".", `--label=${other}`, "-t", "app"], ID), ["build", ...LABEL, ".", "-t", "app"], "build takes options after its context");
	for (const kept of [["--label", "arthur.jobs=1"], ["--label", "com.example=arthur.job=x"], ["-l", "arthur.keep"], ["--label-file", "labels"], ["--label", "x.arthur.job=1"]])
		assert.deepEqual(labelled(["run", ...kept, "img"], ID), ["run", ...LABEL, ...kept, "img"], kept.join(" "));
	assert.deepEqual(labelled(["network", "create", "-l", other, "net"], ID), ["network", "create", ...LABEL, "-l", other, "net"], "-l is no label of network create");
});

test("what follows the image belongs to the container: run's and create's options with values and without are told apart", () => {
	const after = ["--label", "arthur.job=x", "-l", "arthur.job=y"];
	assert.deepEqual(labelled(["run", "img", ...after], ID), ["run", ...LABEL, "img", ...after]);
	assert.deepEqual(labelled(["run", "--rm", "-it", "img", ...after], ID), ["run", ...LABEL, "--rm", "-it", "img", ...after], "bare options");
	assert.deepEqual(labelled(["run", "-e", "A=1", "-p", "80:80", "--name", "web", "-v", "/a:/b", "img", ...after], ID), ["run", ...LABEL, "-e", "A=1", "-p", "80:80", "--name", "web", "-v", "/a:/b", "img", ...after], "options with values");
	assert.deepEqual(labelled(["run", "-dp", "80:80", "--sig-proxy=false", "-wC:/", "img", ...after], ID), ["run", ...LABEL, "-dp", "80:80", "--sig-proxy=false", "-wC:/", "img", ...after]);
	assert.deepEqual(labelled(["create", "--label", "arthur.job=z", "--", "img", ...after], ID), ["create", ...LABEL, "--", "img", ...after], "after --, nothing is an option");
	assert.deepEqual(labelled(["build", "--", "--label", "arthur.job=z"], ID), ["build", ...LABEL, "--", "--label", "arthur.job=z"]);
	assert.deepEqual(labelled(["run", "--label"], ID), ["run", ...LABEL, "--label"], "a label without its value is Docker's to refuse");
});

// The fake docker, ssh and `omp` on PATH: the agent notes its environment in its worktree, then plays the fake agent.
const bin = temporaryFolder();
const fake = fakeDocker(bin);
const agent = fakeAgent({ steps: [{ message: "Done." }] });
writeFileSync(join(bin, "omp"), `#!/bin/sh\nenv > "$PWD/.agent-env"\nexec '${agent}' "$@"\n`, { mode: 0o755 });
process.env.PATH = [bin, process.env.PATH].join(delimiter);
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
async function load(labels: Readonly<Record<string, unknown>>, pieces?: unknown) {
	const root = repository();
	const host = fakeHost({ name: "docker", root });
	host.provide("machines.labels", (name: string) => labels[name]);
	if (pieces !== undefined) host.provide("projects", () => [{ name: "shop", path: root, prefix: "SH", pieces }]);
	const prepares: Prepare[] = [];
	await docker().setup({ ...host.host, jobs: { ...host.host.jobs, prepare: (fn: Prepare) => void prepares.push(fn) } } as Host);
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
	const ran = run("--log-level", "debug", "run", "-l", "arthur.job=other", "--rm", "img", "--label", "arthur.job=x");
	assert.deepEqual([ran.status, ran.stdout], [0, `${"0123456789abcdef".repeat(4)}\n`], "docker's output and exit code pass through");
	assert.deepEqual(fake.calls().at(-1), ["--log-level", "debug", "run", ...LABEL, "--rm", "img", "--label", "arthur.job=x"]);
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
