import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
	assert.match(docker("info", "--format", "{{.SystemTime}}").stdout, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{9}Z\n$/, "Docker's clock, RFC 3339 with nanoseconds");
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
	assert.equal(fake.calls().length, 24, "each call noted");
	// `run` and `create` add a container in `ps`'s keys, which takes its image's labels under its own, as the daemon merges them.
	fake.down(false);
	fake.state({ rows: { "image-ls": [row("image-ls", { ID: "0a1b2c3d4e5f", Repository: "shop", Tag: "latest" })] }, imageLabels: { "0a1b2c3d4e5f": "arthur.job=2026-11-09-worker-0a1b2c3d,arthur.keep=" } });
	assert.match(docker("run", "-d", "--label", "arthur.keep=1", "-l", "own", "shop:latest").stdout, /^[0-9a-f]{64}\n$/, "run -d prints the full ID");
	assert.match(docker("container", "create", "0a1b2c3d4e5f").stdout, /^[0-9a-f]{64}\n$/);
	const created = lines("ps", "-a");
	assert.deepEqual(created.flatMap((each) => drift(each, shapes.ps, "ps")), []);
	assert.deepEqual(
		created.map((each) => [each.Labels, each.State, each.Image]),
		[
			["arthur.job=2026-11-09-worker-0a1b2c3d,arthur.keep=1,own=", "running", "shop:latest"],
			["arthur.job=2026-11-09-worker-0a1b2c3d,arthur.keep=", "created", "0a1b2c3d4e5f"],
		],
	);
});

test("image rm as moby's image_delete.go: an ID with several tags refused, a tag of several untagged alone, the last tag deletes the image unless a container uses it", () => {
	const fake = fakeDocker(temporaryFolder());
	const tags = ["latest", "abc1234"].map((tag) => row("image-ls", { ID: "0a1b2c3d4e5f", Repository: "shop", Tag: tag }));
	fake.state({ rows: { "image-ls": [...tags, row("image-ls", { ID: "1111aaaa2222", Repository: "<none>", Tag: "<none>" })] } });
	const docker = (...args: string[]) => spawnSync(join(fake.bin, "docker"), args, { encoding: "utf8" });
	const said = (...args: string[]) => (({ status, stdout, stderr }) => [status, stdout, stderr])(docker(...args));
	const left = () => (fake.now().rows["image-ls"] ?? []).map((each) => `${each.Repository}:${each.Tag}`);
	const referenced = "Error response from daemon: conflict: unable to delete 0a1b2c3d4e5f (must be forced) - image is referenced in multiple repositories";
	assert.equal(texts["image-referenced"]?.replace("%s", "0a1b2c3d4e5f"), referenced);
	assert.deepEqual(said("image", "rm", "0a1b2c3d4e5f"), [1, "", `${referenced}\n`]);
	assert.deepEqual(left(), ["shop:latest", "shop:abc1234", "<none>:<none>"], "nothing removed");
	docker("create", "--name", "owner", "shop:latest");
	assert.deepEqual(said("image", "rm", "shop:latest"), [0, "Untagged: shop:latest\n", ""], "untagged though a container uses it: another tag holds the image");
	assert.deepEqual(left(), ["shop:abc1234", "<none>:<none>"]);
	const owner = fake.now().rows.ps?.[0];
	assert.equal(owner?.Image, "0a1b2c3d4e5f", "docker ps shows a container's image by its ID once its tag is gone");
	const inUse = `Error response from daemon: conflict: unable to remove repository reference "shop:abc1234" (must force) - container ${owner?.ID} is using its referenced image 0a1b2c3d4e5f\n`;
	assert.deepEqual(said("image", "rm", "shop:abc1234"), [1, "", inUse]);
	fake.state({ ...fake.now(), rows: { ...fake.now().rows, ps: [] } });
	assert.deepEqual(said("image", "rm", "shop:abc1234"), [0, "Untagged: shop:abc1234\nDeleted: sha256:0a1b2c3d4e5f\n", ""]);
	assert.deepEqual(said("image", "rm", "1111aaaa2222"), [0, "Deleted: sha256:1111aaaa2222\n", ""], "a dangling image by its ID");
	assert.deepEqual(left(), []);
	assert.deepEqual(said("image", "rm", "shop:latest"), [2, "", "the fake holds no image shop:latest\n"]);
});

test("build, commit and --label-file as docker/cli, moby and buildkit apply labels: --label over a Dockerfile's, a change over the container's, --label over the file's", () => {
	const fake = fakeDocker(temporaryFolder());
	const folder = temporaryFolder();
	fake.state({ rows: { "image-ls": [row("image-ls", { ID: "0a1b2c3d4e5f", Repository: "base", Tag: "1" })] }, imageLabels: { "0a1b2c3d4e5f": "from=base,own=base" } });
	const docker = (...args: string[]) => spawnSync(join(fake.bin, "docker"), args, { encoding: "utf8" });
	const said = (...args: string[]) => (({ status, stdout, stderr }) => [status, stdout, stderr])(docker(...args));
	const labels = (reference: string) => fake.now().imageLabels?.[String((fake.now().rows["image-ls"] ?? []).find((each) => `${each.Repository}:${each.Tag}` === reference)?.ID)];
	// A build: the base image's labels, under the Dockerfile's, under each --label's; a row per tag, nothing on stdout.
	writeFileSync(join(folder, "Dockerfile"), '# syntax=docker/dockerfile:1\nFROM base:1\nLABEL own=file \\\n  "two"="2"\nRUN true\nLABEL three=\n');
	writeFileSync(join(folder, "other"), "FROM scratch\nLABEL only=other\n");
	assert.deepEqual(said("build", "--no-cache", "--label", "own=flag", "-t", "app:1", "--tag", "app", "--label", "three=3", folder), [0, "", ""]);
	assert.deepEqual(said("buildx", "build", "-f", join(folder, "other"), "-t", "other:1", folder), [0, "", ""]);
	assert.deepEqual(said("image", "build", folder), [0, "", ""], "untagged");
	assert.deepEqual([labels("app:1"), labels("app:latest"), labels("other:1"), labels("<none>:<none>")], ["from=base,own=flag,two=2,three=3", "from=base,own=flag,two=2,three=3", "only=other", "from=base,own=file,two=2,three="]);
	assert.deepEqual((fake.now().rows["image-ls"] ?? []).flatMap((each) => drift(each, shapes["image-ls"], "image-ls")), []);
	const usage = "Usage:  docker buildx build [OPTIONS] PATH | URL | -\n\nRun 'docker buildx build --help' for more information\n";
	assert.deepEqual(said("build", "--label-file", join(folder, "other"), folder), [125, "", `unknown flag: --label-file\n\n${usage}`], "a build takes no --label-file");
	// run and create: a --label-file's lines under each --label, over the image's.
	writeFileSync(join(folder, "marks"), "# a comment\nown=marks\n\nfiled=1\nbare\n");
	docker("create", "--name", "web", "--label", "own=flag", "--label-file", join(folder, "marks"), "base:1");
	docker("run", "-d", "--name", "db", "--label-file", join(folder, "marks"), "base:1");
	assert.deepEqual((fake.now().rows.ps ?? []).map((each) => each.Labels), ["from=base,own=flag,filed=1,bare=", "from=base,own=marks,filed=1,bare="]);
	// A commit: the image's ID, its labels the container's under its changes', one Dockerfile whose line ending in \ takes the next.
	const committed = docker("commit", "-m", "note", "-a", "me", "--no-pause", "-c", 'LABEL own="" new=1', "--change", "ENV a=\\", "-c", "LABEL filed=2", "-c", "CMD x", "web", "snap:1");
	assert.match(committed.stdout, /^sha256:[0-9a-f]{12}0{52}\n$/);
	assert.equal(committed.stdout.slice(7, 19), (fake.now().rows["image-ls"] ?? []).at(-1)?.ID, "the ID starts with the one image ls prints");
	assert.equal(labels("snap:1"), "from=base,own=,filed=1,bare=,new=1", "ENV took LABEL filed=2 as its own text");
	assert.match(docker("container", "commit", "--", "db").stdout, /^sha256:[0-9a-f]{64}\n$/);
	assert.equal(fake.now().imageLabels?.[String((fake.now().rows["image-ls"] ?? []).at(-1)?.ID)], "from=base,own=marks,filed=1,bare=", "no change: the container's labels");
	assert.deepEqual((fake.now().rows["image-ls"] ?? []).slice(-2).map((each) => [each.Repository, each.Tag, ...drift(each, shapes["image-ls"], "image-ls")]), [["snap", "1"], ["<none>", "<none>"]]);
	// Refused as Docker refuses: a change no commit takes, a missing container, a third word (no option is read after CONTAINER), an unknown flag.
	const images = fake.now().rows["image-ls"]?.length;
	const commit = "Usage:  docker commit [OPTIONS] CONTAINER [REPOSITORY[:TAG]]\n\nRun 'docker commit --help' for more information\n";
	assert.deepEqual(said("commit", "-c", "RUN true", "web"), [1, "", "Error response from daemon: run is not a valid change command\n"]);
	assert.deepEqual(said("commit", "nope", "snap:2"), [1, "", "Error response from daemon: No such container: nope\n"]);
	assert.deepEqual(said("commit", "web", "snap:2", "-m"), [1, "", `docker: 'docker commit' requires at least 1 and at most 2 arguments\n\n${commit}`]);
	assert.deepEqual(said("commit"), [1, "", `docker: 'docker commit' requires at least 1 and at most 2 arguments\n\n${commit}`]);
	assert.deepEqual(said("commit", "--label", "a=b", "web"), [125, "", `unknown flag: --label\n\n${commit}`]);
	assert.equal(fake.now().rows["image-ls"]?.length, images, "a refused commit makes no image");
	// container ls --format '{{if .Label "<key>"}}{{json .}}{{end}}': an empty line for a container without the label, or with it empty.
	docker("create", "--name", "blank", "snap:1");
	const listed = docker("container", "ls", "--all", "--filter", "label=from=base", "--format", '{{if .Label "own"}}{{json .}}{{end}}').stdout.split("\n");
	assert.deepEqual(listed.map((line) => (line === "" ? "" : JSON.parse(line).Names)), ["web", "db", "", ""], "blank's own is empty; the last line ends the output");
	assert.deepEqual(docker("container", "ls", "--format", '{{if .Label "nope"}}{{json .}}{{end}}').stdout, "\n\n\n");
	assert.equal(docker("network", "ls", "--format", '{{if .Label "own"}}{{json .}}{{end}}').status, 2, "a format of container ls alone");
});
