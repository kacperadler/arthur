import assert from "node:assert/strict";
import { chmodSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import type { Requirement } from "@arthur/core/plugin";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { docker } from "../src/docker.ts";
import { fakeDocker, VERSION } from "./fake-docker.ts";

// Docker's data root for the resources plugin's disk floor, and the doctor lines, against the fake host and the fake docker
// and ssh first on PATH.

const bin = temporaryFolder();
const fake = fakeDocker(bin);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// Commands here run in a folder of the test's own, so a mutant that writes a relative path (npm run mutate) leaves nothing in the checkout.
process.chdir(temporaryFolder());

// The plugin with the test as the machines plugin: `labels` by machine, `gpu` registered, reached through the fake ssh.
async function load(labels: Readonly<Record<string, unknown>>) {
	const host = fakeHost({ name: "docker" });
	host.provide("machines.labels", (name: string) => labels[name]);
	host.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: temporaryFolder(), labels: {} });
	await host.setup(docker());
	const disk = async (machine: string) => (await Promise.all(host.collect<Promise<string[]>>("resources.disk", machine)))[0];
	const notices = () => host.emitted.flatMap((event) => (event.name === "notice" && typeof event.data === "object" && event.data !== null && "text" in event.data ? [event.data.text] : []));
	return { host, disk, notices };
}

// Each doctor line's machine, what its check answers and its fix.
async function doctor(labels: Readonly<Record<string, unknown>>): Promise<string[]> {
	const { host } = await load(labels);
	const lines = host.collect<readonly Requirement[]>("doctor").flat();
	return Promise.all(lines.map(async (line) => `${line.name}: ${await line.check()}${line.fix === "" ? "" : `; fix: ${line.fix}`}`));
}

// `work` run with PATH set to `path`.
async function withPath<T>(path: string, work: () => Promise<T>): Promise<T> {
	const saved = process.env.PATH;
	process.env.PATH = path;
	try {
		return await work();
	} finally {
		process.env.PATH = saved;
	}
}

test("resources.disk names Docker's data root on a labelled machine, read once; nothing elsewhere, nor for a daemon not on the machine's own socket", async () => {
	fake.state({});
	const { disk } = await load({ local: { tools: ["docker"] }, gpu: { tools: ["git", "docker"] }, plain: { tools: ["git"] } });
	const calls = fake.calls().length;
	assert.deepEqual(await disk("local"), ["/var/lib/docker"]);
	assert.deepEqual(await disk("gpu"), ["/var/lib/docker"], "over ssh on another machine");
	assert.equal(fake.calls().length, calls + 4, "docker context inspect, then docker info, on each");
	assert.deepEqual(await disk("local"), ["/var/lib/docker"]);
	assert.equal(fake.calls().length, calls + 4, "asked at every machine check, read once");
	assert.deepEqual(await disk("plain"), []);
	assert.equal(fake.calls().length, calls + 4, "a machine without the label is not asked");
	const remote = await load({ local: { tools: ["docker"] } });
	fake.state({ host: "tcp://10.0.0.2:2376" });
	assert.deepEqual(await remote.disk("local"), [], "a daemon over TCP keeps its data on another machine");
	fake.state({ host: "ssh://build@10.0.0.2" });
	assert.deepEqual(await remote.disk("local"), []);
	fake.state({});
	fake.down(true);
	assert.deepEqual(await remote.disk("local"), [], "Docker not running: nothing named");
	fake.down(false);
	assert.deepEqual(await remote.disk("local"), ["/var/lib/docker"], "and asked again at the next check");
	fake.state({ info: { DockerRootDir: "/home/arthur/.local/share/docker" } });
	assert.deepEqual(await (await load({ local: { tools: ["docker"] } })).disk("local"), ["/home/arthur/.local/share/docker"], "rootless Docker's root");
});

test("on macOS, Docker Desktop's data lives in its own virtual machine: not named for the disk floor, said once", async () => {
	fake.state({});
	const { disk, notices } = await load({ mac: { os: "macos", tools: ["docker"] } });
	const calls = fake.calls().length;
	assert.deepEqual([await disk("mac"), await disk("mac")], [[], []]);
	assert.equal(fake.calls().length, calls, "docker is not asked");
	assert.deepEqual(notices(), ["docker: machine mac runs Docker Desktop, whose data lives in its own virtual machine, so keepFree.disk does not count it there"]);
});

test("doctor: a line per labelled machine, ok with Docker's version, rootless said as such", async () => {
	fake.state({});
	assert.deepEqual(await doctor({ local: { tools: ["docker"] }, gpu: { tools: ["docker"] } }), [`local: ok (Docker ${VERSION})`, `gpu: ok (Docker ${VERSION})`]);
	assert.deepEqual(await doctor({ local: { tools: ["git"] } }), [], "no line without the label");
	fake.state({ info: { ServerVersion: VERSION, SecurityOptions: ["name=seccomp,profile=builtin", "name=rootless", "name=cgroupns"], Warnings: ["WARNING: No swap limit support"] } });
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), [`local: ok (Docker ${VERSION}, rootless)`]);
	fake.state({ info: { ServerVersion: VERSION, SecurityOptions: null, Warnings: null } });
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), [`local: ok (Docker ${VERSION})`], "null for an empty list");
});

test("doctor refuses as unsafe, naming each: the daemon on TCP without TLS, Arthur as root, a socket reachable only through sudo", { skip: process.getuid?.() === 0 && "root writes every file" }, async (t) => {
	const warning = "[DEPRECATION NOTICE]: API is accessible on http://0.0.0.0:2375 without encryption.\nIn future versions this will be a hard failure";
	fake.state({ info: { ServerVersion: VERSION, SecurityOptions: [], Warnings: ["WARNING: No swap limit support", warning] } });
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), [
		`local: missing: unsafe: the Docker daemon on local listens on TCP without TLS ([DEPRECATION NOTICE]: API is accessible on http://0.0.0.0:2375 without encryption.); fix: on local: remove the tcp:// host from dockerd's -H or daemon.json "hosts", or give it TLS (--tlsverify)`,
	]);
	fake.state({ info: { ServerVersion: VERSION, SecurityOptions: [], Warnings: [warning.replace("http://", "https://").replace("without encryption", "without TLS client verification")] } });
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), [`local: ok (Docker ${VERSION})`], "TLS without client verification is not refused here");
	fake.state({});
	const root = temporaryFolder();
	writeFileSync(join(root, "id"), "#!/bin/sh\necho 0\n", { mode: 0o755 });
	assert.deepEqual(await withPath([root, process.env.PATH].join(delimiter), () => doctor({ local: { tools: ["docker"] } })), [
		"local: missing: unsafe: Arthur runs as root on local, so each job's docker would be root's; fix: run Arthur on local as an ordinary user in the docker group, or with rootless Docker",
	]);
	// A job's sandbox, where these tests may run, opens no Unix socket; the probe asks only whether the path is there and writable.
	const socket = join(temporaryFolder(), "docker.sock");
	fake.state({ host: `unix://${socket}` });
	fake.down(true);
	t.after(() => fake.down(false));
	const daemon = `Cannot connect to the Docker daemon at unix://${socket}. Is the docker daemon running?`;
	const down = [`local: missing: docker info failed on local: ${daemon}; fix: start Docker on local (sudo systemctl start docker), or reach local over ssh by hand`];
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), down, "no socket: Docker is down");
	writeFileSync(socket, "", { mode: 0o600 });
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), down, "a socket it may write: Docker is down");
	chmodSync(socket, 0o000);
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), [
		`local: missing: unsafe: the Docker socket ${socket} on local is reachable only through sudo; fix: on local: sudo usermod -aG docker "$USER", then log in again; or rootless Docker (dockerd-rootless-setuptool.sh install)`,
	]);
});

test("doctor: no docker on the machine, Docker down there, ssh failing, an answer that is not Docker's JSON", async () => {
	fake.state({});
	const bare = temporaryFolder();
	symlinkSync("/bin/sh", join(bare, "sh"));
	symlinkSync("/usr/bin/id", join(bare, "id"));
	const missing = await withPath(bare, () => doctor({ local: { tools: ["docker"] } }));
	assert.deepEqual(missing, ["local: missing: command -v finds no docker on local; fix: install Docker Engine there (https://docs.docker.com/engine/install/), or drop docker from its tools label"]);
	fake.down(true);
	const down = await doctor({ gpu: { tools: ["docker"] } }).finally(() => fake.down(false));
	assert.deepEqual(down, ["gpu: missing: docker info failed on gpu: Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?; fix: start Docker on gpu (sudo systemctl start docker), or reach gpu over ssh by hand"]);
	fake.state({ info: { ServerVersion: VERSION, SecurityOptions: "name=rootless", Warnings: null } });
	assert.deepEqual(await doctor({ local: { tools: ["docker"] } }), [`local: missing: docker info on local answered "${VERSION}\\n\\"name=rootless\\"\\nnull", not its JSON; fix: install Docker Engine there (https://docs.docker.com/engine/install/), or drop docker from its tools label`]);
	fake.state({});
	const loud = temporaryFolder();
	writeFileSync(join(loud, "docker"), "#!/bin/sh\necho first >&2\necho 'the last line' >&2\nexit 1\n", { mode: 0o755 });
	assert.deepEqual(await withPath([loud, process.env.PATH].join(delimiter), () => doctor({ local: { tools: ["docker"] } })), ["local: missing: docker info failed on local: the last line; fix: start Docker on local (sudo systemctl start docker), or reach local over ssh by hand"]);
	writeFileSync(join(loud, "docker"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	assert.deepEqual(await withPath([loud, process.env.PATH].join(delimiter), () => doctor({ local: { tools: ["docker"] } })), ["local: missing: docker info failed on local: exit code 6; fix: start Docker on local (sudo systemctl start docker), or reach local over ssh by hand"], "nothing said: the exit code");
	fake.state({ info: { ServerVersion: `${VERSION}\nnot json`, SecurityOptions: [], Warnings: null } });
	await assert.rejects(doctor({ local: { tools: ["docker"] } }), SyntaxError, "an answer that is no JSON fails the line's check, which the doctor names");
	fake.state({});
	fake.offline("gpu");
	assert.deepEqual(await doctor({ gpu: { tools: ["docker"] } }), ["gpu: missing: docker info failed on gpu: ssh: connect to host gpu port 22: Connection refused; fix: start Docker on gpu (sudo systemctl start docker), or reach gpu over ssh by hand"]);
});
