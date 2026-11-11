import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { fakeDocker, type Kind, row, VERSION } from "./fake-docker.ts";

// The keys of each answer of the fake docker, recorded in docker-shapes.json from docker/cli and moby at v29.9.2 (its `sources`,
// read on its `recorded` day). The fake changes shape only through a reviewed change of that file.
const { shapes, texts } = JSON.parse(readFileSync(new URL("docker-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown>; texts: Record<string, string> };

// Each key path where `got` and the recorded `shape` differ, as dokploy's shape test reads them: `-` a key the record shows and
// the fake leaves out, `+` one the fake adds; each item of a list held to the recorded first item; null, or a value recorded
// as neither list nor object, not compared.
const drift = (got: unknown, shape: unknown, at = ""): string[] => {
	if (got === null || shape === null || typeof shape !== "object") return [];
	if (Array.isArray(shape)) return Array.isArray(got) ? got.flatMap((item, index) => drift(item, shape[0], `${at}[${index}]`)) : [`${at}: not a list`];
	if (typeof got !== "object" || Array.isArray(got)) return [`${at}: not an object`];
	const [has, shown] = [got as Record<string, unknown>, shape as Record<string, unknown>];
	return [
		...Object.keys(shown).filter((key) => !(key in has)).map((key) => `- ${at}.${key}`),
		...Object.keys(has).filter((key) => !(key in shown)).map((key) => `+ ${at}.${key}`),
		...Object.keys(shown).filter((key) => key in has).flatMap((key) => drift(has[key], shown[key], `${at}.${key}`)),
	];
};

test("every answer of the fake docker has the keys docker/cli and moby v29.9.2 print, and Docker's own texts", () => {
	const fake = fakeDocker(temporaryFolder());
	const kinds: Kind[] = ["ps", "network-ls", "volume-ls", "image-ls", "system-df"];
	const volume = { CreatedAt: "2026-11-09T08:00:00Z", Driver: "local", Labels: { "arthur.job": "2026-11-09-worker-0a1b2c3d" }, Mountpoint: "/var/lib/docker/volumes/data/_data", Name: "data", Options: null, Scope: "local" };
	const labelled = (kind: Kind) => (kind === "system-df" ? { Type: "Images" } : kind === "image-ls" ? { ID: "0a1b2c3d4e5f" } : { Labels: "arthur.job=2026-11-09-worker-0a1b2c3d" });
	fake.state({ rows: Object.fromEntries(kinds.map((kind) => [kind, [row(kind, labelled(kind))]])), volumes: [volume], imageLabels: { "0a1b2c3d4e5f": "arthur.job=2026-11-09-worker-0a1b2c3d,arthur.keep=" } });
	const docker = (...args: string[]) => spawnSync(join(fake.bin, "docker"), args, { encoding: "utf8" });
	const lines = (...args: string[]) => docker(...args, "--format", "{{json .}}").stdout.trim().split("\n").map((line) => JSON.parse(line));
	const answers: [string, unknown][] = [
		["ps", lines("ps", "-a")[0]],
		["ps", lines("container", "ls")[0]],
		["network-ls", lines("network", "ls")[0]],
		["volume-ls", lines("volume", "ls")[0]],
		["image-ls", lines("image", "ls")[0]],
		["image-ls", lines("images")[0]],
		["system-df", lines("system", "df")[0]],
		["volume-inspect", JSON.parse(docker("volume", "inspect", "data").stdout)],
		["info", JSON.parse(`{${["DockerRootDir", "SecurityOptions", "ServerVersion", "SystemTime", "Warnings"].map((key) => `"${key}": ${docker("info", "--format", `{{json .${key}}}`).stdout.trim()}`).join(", ")}}`)],
		["context-inspect", { Endpoints: { docker: { Host: docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}").stdout.trim() } } }],
		...docker("image", "inspect", "--format", "{{.Id}} {{json .Config.Labels}}", "0a1b2c3d4e5f").stdout.trim().split("\n").map((line): [string, unknown] => {
			const [id = "", labels = ""] = line.split(" ");
			return ["image-inspect", { Id: id, Config: { Labels: JSON.parse(labels) } }];
		}),
	];
	assert.equal(docker("image", "ls", "--format", "{{.ID}}").stdout, "0a1b2c3d4e5f\n", "the IDs image inspect takes");
	// `system df` summed from the sizes the fake keeps, when no row of it is given.
	fake.state({ sizes: {}, cache: 1500 });
	const summed = lines("system", "df");
	answers.push(...summed.map((each): [string, unknown] => ["system-df", each]));
	assert.deepEqual(summed.map((each) => [each.Type, each.Size]), [["Images", "0B"], ["Containers", "0B"], ["Local Volumes", "0B"], ["Build Cache", "1.5kB"]]);
	assert.deepEqual(answers.flatMap(([name, got]) => drift(got, shapes[name], name)), []);
	assert.equal((answers[7]?.[1] as unknown[]).length, 1, "volume inspect answers the volume named");
	assert.deepEqual(answers[10]?.[1], { Id: `sha256:0a1b2c3d4e5f${"0".repeat(52)}`, Config: { Labels: { "arthur.job": "2026-11-09-worker-0a1b2c3d", "arthur.keep": "" } } }, "image inspect's ID starts with the ID image ls prints");
	assert.equal(docker("--version").stdout, `Docker version ${VERSION}, build a82e528\n`);
	assert.equal(docker("builder", "prune", "--force", "--max-used-space", "10G").stdout, "Total:\t0B\n");
	assert.equal(docker("info", "--format", '{{.DockerRootDir}}{{"\\n"}}{{.ServerVersion}}').stdout, `/var/lib/docker\n${VERSION}\n`);
	assert.equal(texts.daemon, "Cannot connect to the Docker daemon at %s. Is the docker daemon running?");
	fake.down(true);
	const down = docker("ps", "--format", "{{json .}}");
	assert.deepEqual([down.status, down.stderr], [1, "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?\n"]);
	assert.equal(docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}").status, 0, "the context needs no daemon");
	assert.equal(docker("--version").status, 0, "nor does the version");
	assert.equal(fake.calls().length, 23, "each call noted");
});
