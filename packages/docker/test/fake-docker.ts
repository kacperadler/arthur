import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { memoryBytes } from "@arthur/core";

// The fake `docker` and `ssh` of the docker plugin's tests, in a folder of the test's own put first on PATH; no test reaches the
// real Docker of the machine. `docker` is this file run by node: each argument list appended to `calls` as a JSON line, its
// answers in the keys and texts docker-shapes.json records from docker/cli, moby and buildx, from `state.json` (`State`), which
// its removals change; while `down` exists every command that needs the daemon fails with Docker's line and exit 1, and the
// command `crash` names makes `down` first. `ssh <options> <host> <command>` runs the command here, the fake docker included,
// or fails as ssh does (255) while `<host>.down` exists.

const { shapes, texts } = JSON.parse(readFileSync(new URL("docker-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown>; texts: Record<string, string> };

export type Kind = "ps" | "network-ls" | "volume-ls" | "image-ls" | "system-df";
type Row = Readonly<Record<string, unknown>>;
// What the daemon holds: `info`'s fields; `host`, the context's endpoint; each listing's rows, and `volume inspect`'s. Beside
// them what Docker keeps but those rows do not show: an image's labels (`k=v,k=v`) by its ID, the bytes of a container, volume or
// image by its ID or name, the build cache's bytes. A `system-df` row given is printed as given, else the sizes are summed.
export type State = {
	readonly info: Row;
	readonly host: string;
	readonly rows: Readonly<Partial<Record<Kind, readonly Row[]>>>;
	readonly volumes: readonly Row[];
	readonly imageLabels?: Readonly<Record<string, string>>;
	readonly sizes?: Readonly<Record<string, number>>;
	readonly cache?: number;
	// false: no buildx, so `docker builder prune` is the legacy builder's, which takes no `--max-used-space`.
	readonly buildx?: false;
	readonly crash?: string;
};

export const VERSION = "29.9.2";
const STATE: State = { info: { DockerRootDir: "/var/lib/docker", SecurityOptions: ["name=seccomp,profile=builtin", "name=cgroupns"], ServerVersion: VERSION, Warnings: null }, host: "unix:///var/run/docker.sock", rows: {}, volumes: [] };
const fill = (text: string, ...values: string[]) => values.reduce((done, value) => done.replace("%s", value), text);
// The listings the fake answers, by their command words.
const LISTS: Readonly<Record<string, Kind>> = { ps: "ps", "container ls": "ps", "network ls": "network-ls", "volume ls": "volume-ls", "image ls": "image-ls", images: "image-ls", "system df": "system-df" };
const UNITS = ["B", "kB", "MB", "GB", "TB"];

// One row of `kind` in Docker's keys, each one not given "" (`Platform` null), as `--format '{{json .}}'` prints it.
export const row = (kind: Kind, given: Row): Row => ({ ...Object.fromEntries(Object.keys(shapes[kind] as Row).map((key) => [key, key === "Platform" ? null : ""])), ...given });

// Bytes as docker/go-units' HumanSize prints them: 4 significant digits, decimal units.
export function human(size: number): string {
	let unit = 0;
	for (; size >= 1000 && unit < UNITS.length - 1; unit++) size /= 1000;
	return `${Number(size.toPrecision(4))}${UNITS[unit]}`;
}

export function fakeDocker(folder: string) {
	const quote = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;
	writeFileSync(join(folder, "docker"), `#!/bin/sh\nFAKE_DOCKER=${quote(folder)} exec ${quote(process.execPath)} ${quote(fileURLToPath(import.meta.url))} "$@"\n`, { mode: 0o755 });
	writeFileSync(
		join(folder, "ssh"),
		`#!/bin/sh\nwhile [ $# -gt 0 ]; do case "$1" in -o) shift 2;; -*) shift;; *) break;; esac; done\nif [ -e ${quote(folder)}/"$1.down" ]; then echo "ssh: connect to host $1 port 22: Connection refused" >&2; exit 255; fi\nshift\nexec /bin/sh -c "$*"\n`,
		{ mode: 0o755 },
	);
	const file = (name: string) => join(folder, name);
	return {
		bin: folder,
		// Every argument list the fake docker got, oldest first.
		calls: (): string[][] => (existsSync(file("calls")) ? readFileSync(file("calls"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []),
		state: (given: Partial<State>) => writeFileSync(file("state.json"), JSON.stringify({ ...STATE, ...given })),
		// What the daemon holds now, after the removals.
		now: (): State => JSON.parse(readFileSync(file("state.json"), "utf8")),
		down: (on: boolean) => (on ? writeFileSync(file("down"), "") : rmSync(file("down"), { force: true })),
		offline: (host: string) => writeFileSync(file(`${host}.down`), ""),
	};
}

if (import.meta.main) {
	const folder = process.env.FAKE_DOCKER ?? "";
	const args = process.argv.slice(2);
	appendFileSync(join(folder, "calls"), `${JSON.stringify(args)}\n`);
	const state: State = existsSync(join(folder, "state.json")) ? JSON.parse(readFileSync(join(folder, "state.json"), "utf8")) : STATE;
	const say = (text: string) => process.stdout.write(`${text}\n`);
	const fail = (text: string, code = 1) => {
		process.stderr.write(`${text}\n`);
		process.exit(code);
	};
	const save = (rows: State["rows"], more: Partial<State> = {}) => writeFileSync(join(folder, "state.json"), JSON.stringify({ ...state, rows: { ...state.rows, ...rows }, ...more }));
	let at = 0;
	while (args[at]?.startsWith("-") && !["-v", "--version"].includes(args[at] ?? "")) at += ["--config", "--context", "-c", "--host", "-H", "--log-level", "-l", "--tlscacert", "--tlscert", "--tlskey"].includes(args[at] ?? "") ? 2 : 1;
	const [command = "", sub = "", ...rest] = args.slice(at);
	const format = args[args.indexOf("--format") + 1] ?? "";
	const words = `${command} ${sub}`;
	const kind = LISTS[command] ?? LISTS[words];
	const [containers, networks, volumes, images] = [state.rows.ps ?? [], state.rows["network-ls"] ?? [], state.rows["volume-ls"] ?? [], state.rows["image-ls"] ?? []];
	// The objects named after the options, by ID or name; an object's users, the containers that hold it.
	const named = rest.filter((word, index) => !word.startsWith("-") && !["--timeout", "--max-used-space", "--filter"].includes(rest[index - 1] ?? ""));
	const listed = (field: unknown, name: unknown) => String(field).split(",").includes(String(name));
	if (command === "-v" || command === "--version") say(fill(texts.version ?? "", VERSION, "a82e528"));
	else if (words === "context inspect") format === "{{.Endpoints.docker.Host}}" ? say(state.host) : fail(`the fake answers context inspect only with --format '{{.Endpoints.docker.Host}}', got ${format}`, 2);
	else if (existsSync(join(folder, "down")) || (state.crash === words && (writeFileSync(join(folder, "down"), ""), true))) fail(fill(texts.daemon ?? "", state.host));
	else if (command === "info")
		say(format.replace(/\{\{"\\n"\}\}/g, "\n").replace(/\{\{(json )?\.(\w+)\}\}/g, (_, json, key) => (json ? JSON.stringify(state.info[key] ?? null) : String(state.info[key] ?? "<no value>"))));
	else if (words === "system df" && state.rows["system-df"] === undefined) {
		if (format !== "{{json .}}") fail(`the fake answers system df only with --format '{{json .}}', got ${format}`, 2);
		const sum = (rows: readonly Row[], key: string) => rows.reduce((total, each) => total + (state.sizes?.[String(each[key])] ?? 0), 0);
		const types: [string, number, number][] = [["Images", images.length, sum(images, "ID")], ["Containers", containers.length, sum(containers, "ID")], ["Local Volumes", volumes.length, sum(volumes, "Name")], ["Build Cache", 0, state.cache ?? 0]];
		for (const [type, count, size] of types) say(JSON.stringify(row("system-df", { Type: type, TotalCount: String(count), Active: "0", Size: human(size), Reclaimable: human(size) })));
	} else if (kind !== undefined) {
		if (format !== "{{json .}}") fail(`the fake answers ${words} only with --format '{{json .}}', got ${format}`, 2);
		// `--filter label=<key>` or `label=<key>=<value>`, each one to hold, as the daemon filters.
		const filters = args.flatMap((word, index) => (args[index - 1] === "--filter" && word.startsWith("label=") ? [word.slice(6)] : []));
		const labels = (each: Row) => String(kind === "image-ls" ? (state.imageLabels?.[String(each.ID)] ?? "") : each.Labels).split(",");
		for (const each of state.rows[kind] ?? []) if (filters.every((filter) => labels(each).some((label) => label === filter || label.split("=")[0] === filter))) say(JSON.stringify(each));
	} else if (words === "volume inspect") say(JSON.stringify(state.volumes.filter((volume) => rest.includes(String(volume.Name))), null, 4));
	else if (words === "builder prune" && state.buildx === false) fail(fill(texts["legacy-builder-flag"] ?? "", "--max-used-space"), 125);
	else if (words === "builder prune") {
		const cut = Math.max(0, (state.cache ?? 0) - (memoryBytes(rest[rest.indexOf("--max-used-space") + 1] ?? "", 0) ?? Infinity));
		save({}, { cache: (state.cache ?? 0) - cut });
		say(fill(texts["builder-prune"] ?? "", human(cut)));
	} else if (words === "container stop") {
		const [name = ""] = named.filter((each) => !containers.some((container) => container.ID === each));
		if (name !== "") fail(`the fake holds no container ${name}`, 2);
		save({ ps: containers.map((each) => (named.includes(String(each.ID)) ? { ...each, State: "exited", Status: "Exited (0) 1 second ago" } : each)) });
		for (const each of named) say(each);
	} else if (["container rm", "network rm", "volume rm", "image rm"].includes(words)) {
		const [name = ""] = named;
		const key = command === "volume" ? "Name" : "ID";
		const gone = (state.rows[LISTS[`${command} ls`] as Kind] ?? []).find((each) => each[key] === name || (command === "network" && each.Name === name));
		if (gone === undefined) fail(`the fake holds no ${command} ${name}`, 2);
		const others = containers.filter((each) => each !== gone);
		if (command === "container" && gone?.State === "running") fail(fill(texts["container-running"] ?? "", name));
		const endpoints = others.filter((each) => listed(each.Networks, gone?.Name));
		if (command === "network" && endpoints.length > 0) fail(fill(texts["network-in-use"] ?? "", String(gone?.Name), endpoints.map((each) => `name:"${each.Names}" id:"${String(each.ID).slice(0, 12)}"`).join(", ")));
		const mounting = others.filter((each) => listed(each.Mounts, name));
		if (command === "volume" && mounting.length > 0) fail(fill(texts["volume-in-use"] ?? "", name, mounting.map((each) => String(each.ID)).join(", ")));
		const using = others.find((each) => each.Image === gone?.ID || each.Image === `${gone?.Repository}:${gone?.Tag}`);
		if (command === "image" && using !== undefined) fail(fill(texts["image-in-use"] ?? "", name.slice(0, 12), ...(using.State === "running" ? ["cannot be forced", "running"] : ["must be forced", "stopped"]), String(using.ID).slice(0, 12)));
		// `--volumes`: the container's anonymous volumes go with it, but one another container mounts.
		const anonymous = (each: Row) => command === "container" && rest.includes("--volumes") && listed(gone?.Mounts, each.Name) && String(each.Labels).includes("com.docker.volume.anonymous=") && !others.some((other) => listed(other.Mounts, each.Name));
		save({ ps: others, "network-ls": networks.filter((each) => each !== gone), "volume-ls": volumes.filter((each) => each !== gone && !anonymous(each)), "image-ls": images.filter((each) => each !== gone) });
		if (command !== "image") say(name);
		else for (const line of [...(gone?.Tag === "<none>" ? [] : [`Untagged: ${gone?.Repository}:${gone?.Tag}`]), `Deleted: sha256:${name}`]) say(line);
	} else if (["run", "create", "build", "container", "buildx", "image", "network", "volume"].includes(command)) say("0123456789abcdef".repeat(4));
	else fail(`docker: '${command}' is not a docker command.\nSee 'docker --help'`);
}
