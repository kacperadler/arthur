import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { memoryBytes } from "@arthur/core";

// The fake `docker` and `ssh` of the docker plugin's tests, in a folder of the test's own put first on PATH; no test reaches the
// real Docker of the machine. `docker` is this file run by node: each argument list appended to `calls` as a JSON line, its
// answers in the keys and texts docker-shapes.json records from docker/cli, moby and buildx, from `state.json` (`State`), which
// its removals, `run` and `create` (a container taking its image's labels), `build` and `commit` (an image with its labels)
// change; while `down` exists every command that needs the daemon fails with Docker's line and exit 1, and the command `crash`
// names makes `down` first; `<host>.docker-down` does the same on that host alone. Its clock is `info.SystemTime`, which
// `builder prune --filter until=` reads. `ssh <options> <host> <command>` runs the command here as that host, the fake docker
// included, or fails as ssh does (255) while `<host>.down` exists.

const { shapes, texts } = JSON.parse(readFileSync(new URL("docker-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown>; texts: Record<string, string> };

export type Kind = "ps" | "network-ls" | "volume-ls" | "image-ls" | "system-df";
type Row = Readonly<Record<string, unknown>>;
// What the daemon holds: `info`'s fields; `host`, the context's endpoint; each listing's rows, and `volume inspect`'s. Beside
// them what Docker keeps but those rows do not show: an image's labels (`k=v,k=v`) by its ID, the bytes of a container, volume or
// image by its ID or name, the build cache's bytes and when it was last used; `buildx: false`, the legacy builder's `docker
// builder prune`, which takes no `--max-used-space`. A `system-df` row given is printed as given, else the sizes are summed.
export type State = {
	readonly info: Row;
	readonly host: string;
	readonly rows: Readonly<Partial<Record<Kind, readonly Row[]>>>;
	readonly volumes: readonly Row[];
	readonly imageLabels?: Readonly<Record<string, string>>;
	readonly sizes?: Readonly<Record<string, number>>;
	readonly cache?: number;
	readonly cacheUsedAt?: string;
	readonly buildx?: false;
	readonly crash?: string;
};

export const VERSION = "29.9.2";
const STATE: State = { info: { DockerRootDir: "/var/lib/docker", SecurityOptions: ["name=seccomp,profile=builtin", "name=cgroupns"], ServerVersion: VERSION, SystemTime: "2026-01-01T00:00:00.123456789Z", Warnings: null }, host: "unix:///var/run/docker.sock", rows: {}, volumes: [] };
const fill = (text: string, ...values: string[]) => values.reduce((done, value) => done.replace("%s", value), text);
// The listings the fake answers, by their command words.
const LISTS: Readonly<Record<string, Kind>> = { ps: "ps", "container ls": "ps", "network ls": "network-ls", "volume ls": "volume-ls", "image ls": "image-ls", images: "image-ls", "system df": "system-df" };
const UNITS = ["B", "kB", "MB", "GB", "TB"];

// One row of `kind` in Docker's keys, each one not given "" (`Platform` null), as `--format '{{json .}}'` prints it.
export const row = (kind: Kind, given: Row): Row => ({ ...Object.fromEntries(Object.keys(shapes[kind] as Row).map((key) => [key, key === "Platform" ? null : ""])), ...given });

// Bytes as docker/go-units' HumanSize prints them: 4 significant digits, decimal units.
function human(size: number): string {
	let unit = 0;
	for (; size >= 1000 && unit < UNITS.length - 1; unit++) size /= 1000;
	return `${Number(size.toPrecision(4))}${UNITS[unit]}`;
}

// A label `k=v` or `k` as its key and value.
const cut = (pair: string): [string, string] => [pair.split("=")[0] ?? "", pair.split("=").slice(1).join("=")];
// The instructions a commit's `--change` takes (moby builder/dockerfile, validCommitCommands).
const CHANGES = ["cmd", "entrypoint", "healthcheck", "env", "expose", "label", "onbuild", "stopsignal", "user", "volume", "workdir"];
// A Dockerfile's instructions, each as its name in small letters and the rest of its line: a line that ends in `\` goes on with
// the next, and an empty line or a `#` comment is none (buildkit frontend/dockerfile/parser/parser.go).
const instructions = (text: string) =>
	text.replace(/\\[ \t]*\n/g, "").split("\n").map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#")).map((line): [string, string] => [(/^\S+/.exec(line)?.[0] ?? "").toLowerCase(), line.replace(/^\S+\s*/, "")]);
// `LABEL`'s pairs: words `k=v`, each side bare or in double quotes, the one form the fake reads.
function pairs(text: string): [string, string][] {
	return text.split(/\s+/).map((word) => {
		const [, key, value] = /^"?([^"=]+)"?="?([^"]*)"?$/.exec(word) ?? [];
		if (key === undefined || value === undefined) throw new Error(`the fake reads LABEL only as k=v words, each side bare or in double quotes, got ${word}`);
		return [key, value];
	});
}

export function fakeDocker(folder: string) {
	const quote = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;
	writeFileSync(join(folder, "docker"), `#!/bin/sh\nFAKE_DOCKER=${quote(folder)} exec ${quote(process.execPath)} ${quote(fileURLToPath(import.meta.url))} "$@"\n`, { mode: 0o755 });
	writeFileSync(
		join(folder, "ssh"),
		`#!/bin/sh\nwhile [ $# -gt 0 ]; do case "$1" in -o) shift 2;; -*) shift;; *) break;; esac; done\nif [ -e ${quote(folder)}/"$1.down" ]; then echo "ssh: connect to host $1 port 22: Connection refused" >&2; exit 255; fi\nFAKE_SSH_HOST=$1; export FAKE_SSH_HOST; shift\nexec /bin/sh -c "$*"\n`,
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
		// Docker stopped, or started again, on `host`, a machine reached through the fake ssh.
		stopped: (host: string, on: boolean) => (on ? writeFileSync(file(`${host}.docker-down`), "") : rmSync(file(`${host}.docker-down`), { force: true })),
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
	// A new image with `labels`, a row per `<repository>[:<tag>]` or one untagged; a tag another image holds is not moved. Its ID.
	const built = (labels: ReadonlyMap<string, string>, references: readonly string[]) => {
		const id = randomBytes(6).toString("hex");
		const rows = (references.length === 0 ? ["<none>:<none>"] : references).map((each) => row("image-ls", { ID: id, Repository: each.split(":")[0], Tag: each.split(":")[1] ?? "latest" }));
		save({ "image-ls": [...(state.rows["image-ls"] ?? []), ...rows] }, { imageLabels: { ...state.imageLabels, [id]: [...labels].map((pair) => pair.join("=")).join(",") } });
		return id;
	};
	let at = 0;
	while (args[at]?.startsWith("-") && !["-v", "--version"].includes(args[at] ?? "")) at += ["--config", "--context", "-c", "--host", "-H", "--log-level", "-l", "--tlscacert", "--tlscert", "--tlskey"].includes(args[at] ?? "") ? 2 : 1;
	const [command = "", sub = "", ...rest] = args.slice(at);
	const format = args[args.indexOf("--format") + 1] ?? "";
	const words = `${command} ${sub}`;
	const kind = LISTS[command] ?? LISTS[words];
	const [containers, networks, volumes, images] = [state.rows.ps ?? [], state.rows["network-ls"] ?? [], state.rows["volume-ls"] ?? [], state.rows["image-ls"] ?? []];
	// The objects named after the options, by ID or name; an object's users, the containers that hold it.
	const named = rest.filter((word, index) => !word.startsWith("-") && !["--timeout", "--max-used-space", "--filter", "--format"].includes(rest[index - 1] ?? ""));
	const listed = (field: unknown, name: unknown) => String(field).split(",").includes(String(name));
	const down = existsSync(join(folder, "down")) || existsSync(join(folder, `${process.env.FAKE_SSH_HOST}.docker-down`));
	if (command === "-v" || command === "--version") say(fill(texts.version ?? "", VERSION, "a82e528"));
	else if (words === "context inspect") format === "{{.Endpoints.docker.Host}}" ? say(state.host) : fail(`the fake answers context inspect only with --format '{{.Endpoints.docker.Host}}', got ${format}`, 2);
	else if (down || (state.crash === words && (writeFileSync(join(folder, "down"), ""), true))) fail(fill(texts.daemon ?? "", state.host));
	else if (command === "info")
		say(format.replace(/\{\{"\\n"\}\}/g, "\n").replace(/\{\{(json )?\.(\w+)\}\}/g, (_, json, key) => (json ? JSON.stringify(state.info[key] ?? null) : String(state.info[key] ?? "<no value>"))));
	else if (words === "system df" && state.rows["system-df"] === undefined) {
		if (format !== "{{json .}}") fail(`the fake answers system df only with --format '{{json .}}', got ${format}`, 2);
		const sum = (rows: readonly Row[], key: string) => rows.reduce((total, each) => total + (state.sizes?.[String(each[key])] ?? 0), 0);
		const types: [string, number, number][] = [["Images", images.length, sum(images, "ID")], ["Containers", containers.length, sum(containers, "ID")], ["Local Volumes", volumes.length, sum(volumes, "Name")], ["Build Cache", 0, state.cache ?? 0]];
		for (const [type, count, size] of types) say(JSON.stringify(row("system-df", { Type: type, TotalCount: String(count), Active: "0", Size: human(size), Reclaimable: human(size) })));
	} else if (kind !== undefined) {
		// `{{if .Label "<key>"}}{{json .}}{{end}}` leaves a container's line empty without that label, or with it empty (docker/cli formatter/container.go, Label).
		const [, marked] = /^\{\{if \.Label "([^"]+)"\}\}\{\{json \.\}\}\{\{end\}\}$/.exec(format) ?? [];
		if (format !== "{{json .}}" && !(kind === "image-ls" && format === "{{.ID}}") && !(kind === "ps" && marked !== undefined))
			fail(`the fake answers ${words} only with --format '{{json .}}', image ls with '{{.ID}}' too, and container ls with '{{if .Label "<key>"}}{{json .}}{{end}}', got ${format}`, 2);
		// `--filter label=<key>` or `label=<key>=<value>`, each one to hold, as the daemon filters.
		const filters = args.flatMap((word, index) => (args[index - 1] === "--filter" && word.startsWith("label=") ? [word.slice(6)] : []));
		const labels = (each: Row) => String(kind === "image-ls" ? (state.imageLabels?.[String(each.ID)] ?? "") : each.Labels).split(",");
		const empty = (each: Row) => marked !== undefined && !labels(each).some((label) => label.startsWith(`${marked}=`) && label !== `${marked}=`);
		for (const each of state.rows[kind] ?? []) if (filters.every((filter) => labels(each).some((label) => label === filter || label.split("=")[0] === filter))) say(format === "{{.ID}}" ? String(each.ID) : empty(each) ? "" : JSON.stringify(each));
	} else if (words === "volume inspect") say(JSON.stringify(state.volumes.filter((volume) => rest.includes(String(volume.Name))), null, 4));
	else if (words === "image inspect") {
		if (format !== "{{.Id}} {{json .Config.Labels}}") fail(`the fake answers image inspect only with --format '{{.Id}} {{json .Config.Labels}}', got ${format}`, 2);
		const pairs = (text = "") => (text === "" ? null : Object.fromEntries(text.split(",").map((pair) => [pair.split("=")[0], pair.slice(pair.indexOf("=") + 1)])));
		for (const id of named) say(`sha256:${id.padEnd(64, "0")} ${JSON.stringify(pairs(state.imageLabels?.[id]))}`);
	} else if (words === "builder prune" && state.buildx === false && rest.includes("--max-used-space")) fail(fill(texts["legacy-builder-flag"] ?? "", "--max-used-space"), 125);
	else if (words === "builder prune") {
		// `--filter until=<hours>h` takes the whole cache once it went unused that long by the daemon's clock; `--max-used-space` cuts it to that size.
		const until = Number.parseFloat(rest.find((word) => word.startsWith("until="))?.slice(6) ?? "");
		const stale = Date.parse(String(state.info.SystemTime)) - Date.parse(state.cacheUsedAt ?? "") >= until * 3_600_000;
		const cut = stale ? (state.cache ?? 0) : Math.max(0, (state.cache ?? 0) - (memoryBytes(rest[rest.indexOf("--max-used-space") + 1] ?? "", 0) ?? Infinity));
		save({}, { cache: (state.cache ?? 0) - cut });
		say(fill(texts["builder-prune"] ?? "", human(cut)));
	} else if (words === "container stop") {
		const [name = ""] = named.filter((each) => !containers.some((container) => container.ID === each));
		if (name !== "") fail(`the fake holds no container ${name}`, 2);
		save({ ps: containers.map((each) => (named.includes(String(each.ID)) ? { ...each, State: "exited", Status: "Exited (0) 1 second ago" } : each)) });
		for (const each of named) say(each);
	} else if (words === "image rm") {
		// As moby's image_delete.go: a tag of an image with more is untagged alone; the last tag, or an ID with at most one tag, deletes
		// the image, unless a container uses it; an ID with several tags is refused. A container shows an untagged image by its ID.
		const [name = ""] = named;
		const tag = (each: Row) => `${each.Repository}:${each.Tag}`;
		const id = (images.find((each) => each.Tag !== "<none>" && tag(each) === name) ?? images.find((each) => each.ID === name))?.ID;
		if (id === undefined) fail(`the fake holds no image ${name}`, 2);
		const rows = images.filter((each) => each.ID === id);
		const tags = rows.filter((each) => each.Tag !== "<none>").map(tag);
		const using = containers.find((each) => each.Image === id || tags.includes(String(each.Image)));
		const byTag = tags.includes(name);
		if (byTag && tags.length > 1) {
			save({ "image-ls": images.filter((each) => each.ID !== id || tag(each) !== name), ps: containers.map((each) => (each.Image === name ? { ...each, Image: id } : each)) });
			say(`Untagged: ${name}`);
		} else if (byTag && using !== undefined) fail(fill(texts["reference-in-use"] ?? "", name, String(using.ID).slice(0, 12), String(id)));
		else if (tags.length > 1) fail(fill(texts["image-referenced"] ?? "", String(id)));
		else if (using !== undefined) fail(fill(texts["image-in-use"] ?? "", String(id), ...(using.State === "running" ? ["cannot be forced", "running"] : ["must be forced", "stopped"]), String(using.ID).slice(0, 12)));
		else {
			save({ "image-ls": images.filter((each) => each.ID !== id) });
			for (const line of [...tags.map((each) => `Untagged: ${each}`), `Deleted: sha256:${id}`]) say(line);
		}
	} else if (["container rm", "network rm", "volume rm"].includes(words)) {
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
		// `--volumes`: the container's anonymous volumes go with it, but one another container mounts.
		const anonymous = (each: Row) => command === "container" && rest.includes("--volumes") && listed(gone?.Mounts, each.Name) && String(each.Labels).includes("com.docker.volume.anonymous=") && !others.some((other) => listed(other.Mounts, each.Name));
		save({ ps: others, "network-ls": networks.filter((each) => each !== gone), "volume-ls": volumes.filter((each) => each !== gone && !anonymous(each)) });
		say(name);
	} else if (["run", "create"].includes(command) || ["container run", "container create"].includes(words)) {
		// A container in `ps`, its full ID printed as `run -d` and `create` print it. The options read: `--label`, `-l`, `--label-file`,
		// `--name`, `-v` and `--volume` with the next word, any other one a flag; the first other word is the image. The image's labels go on
		// the container under its own, as the daemon merges them (moby daemon/commit.go, merge), and those of a `--label-file`, a line each
		// but an empty one and a `#` comment, under each `--label` (docker/cli opts/parse.go, ReadKVStrings). `-v <path>` mounts a new
		// anonymous volume, `-v <name>:<path>` that volume, made unlabelled when missing; `-v /<host path>:<path>` binds no volume.
		const given = command === "container" ? rest : [sub, ...rest];
		const [labels, files, sources] = [[] as string[], [] as string[], [] as string[]];
		let [name, image] = ["", ""];
		for (let at = 0; at < given.length && image === ""; at++) {
			const [word = "", next = ""] = [given[at], given[at + 1]];
			if (["--label", "-l", "--label-file", "--name", "-v", "--volume"].includes(word)) at++;
			if (word === "--label" || word === "-l") labels.push(next);
			else if (word === "--label-file") files.push(next);
			else if (word === "--name") name = next;
			else if (word === "-v" || word === "--volume") sources.push(next.includes(":") ? (next.split(":")[0] ?? "") : "");
			else if (!word.startsWith("-")) image = word;
		}
		const mounts = sources.filter((source) => !source.startsWith("/")).map((source) => source || randomBytes(32).toString("hex"));
		const missing = mounts.filter((mount) => !volumes.some((volume) => volume.Name === mount));
		const made = missing.map((each) => row("volume-ls", { Driver: "local", Name: each, Labels: sources.includes(each) ? "" : "com.docker.volume.anonymous=" }));
		const from = images.find((each) => each.ID === image || `${each.Repository}:${each.Tag}` === image);
		const inherited = (state.imageLabels?.[String(from?.ID)] ?? "").split(",").filter((pair) => pair !== "");
		const filed = files.flatMap((file) => readFileSync(file, "utf8").split("\n")).map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));
		const merged = new Map([...inherited, ...filed, ...labels].map(cut));
		const [id, running] = [randomBytes(32).toString("hex"), (command === "container" ? sub : command) === "run"];
		const container = { ID: id.slice(0, 12), Names: name || `fake_${id.slice(0, 6)}`, Image: image, State: running ? "running" : "created", Status: running ? "Up 1 second" : "Created" };
		save({ ps: [...containers, row("ps", { ...container, Labels: [...merged].map((pair) => pair.join("=")).join(","), Mounts: mounts.join(","), Networks: "bridge" })], "volume-ls": [...volumes, ...made] });
		say(id);
	} else if (command === "build" || ["image build", "builder build", "buildx build", "buildx b"].includes(words)) {
		// `build <path>` builds `<path>/Dockerfile`, or `-f`'s: an image with a row per `-t`, its labels its `FROM` image's when the fake
		// holds it, under its `LABEL` lines', under each `--label`'s (buildkit dockerfile2llb, finalizeResultImage). The options read:
		// `--label`, `-t`, `--tag`, `-f` and `--file` with the next word, any other one a flag; a build takes no `--label-file`. Nothing
		// is printed: the build's log, which goes to stderr, is left out.
		const given = command === "build" ? [sub, ...rest] : rest;
		const [labels, tags] = [[] as string[], [] as string[]];
		let [file, context] = ["", ""];
		for (let at = 0; at < given.length; at++) {
			const [word = "", next = ""] = [given[at], given[at + 1]];
			if (word === "--label-file") fail(fill(texts["build-flag"] ?? "", word), 125);
			if (["--label", "-t", "--tag", "-f", "--file"].includes(word)) at++;
			if (word === "--label") labels.push(next);
			else if (word === "-t" || word === "--tag") tags.push(next);
			else if (word === "-f" || word === "--file") file = next;
			else if (!word.startsWith("-")) context = word;
		}
		const lines = instructions(readFileSync(file || join(context, "Dockerfile"), "utf8"));
		const base = lines.findLast(([name]) => name === "from")?.[1].split(/\s+/)[0];
		const from = images.find((each) => each.ID === base || `${each.Repository}:${each.Tag}` === base);
		const inherited = (state.imageLabels?.[String(from?.ID)] ?? "").split(",").filter((pair) => pair !== "").map(cut);
		built(new Map([...inherited, ...lines.flatMap(([name, text]) => (name === "label" ? pairs(text) : [])), ...labels.map(cut)]), tags);
	} else if (command === "commit" || words === "container commit") {
		// `commit [OPTIONS] CONTAINER [REPOSITORY[:TAG]]`, no option read after CONTAINER (docker/cli container/commit.go). Its changes are
		// one Dockerfile, a line each, of the instructions a commit takes, of which the fake applies `LABEL`; the image keeps each label
		// of the container they do not set, and its ID is printed (moby daemon/commit.go; builder/dockerfile, BuildFromConfig). The
		// options read: `-c`, `--change`, `-a`, `--author`, `-m` and `--message` with the next word, `-p`, `--pause` and `--no-pause`.
		const given = command === "commit" ? [sub, ...rest] : rest;
		const changes: string[] = [];
		let at = 0;
		for (; given[at]?.startsWith("-") && given[at] !== "--"; at++) {
			const word = given[at] ?? "";
			if (word === "-c" || word === "--change") changes.push(given[++at] ?? "");
			else if (["-a", "--author", "-m", "--message"].includes(word)) at++;
			else if (!["-p", "--pause", "--no-pause"].includes(word)) fail(fill(texts["commit-flag"] ?? "", word), 125);
		}
		const [name = "", reference, ...more] = given.slice(given[at] === "--" ? at + 1 : at);
		if (name === "" || more.length > 0) fail(texts["commit-args"] ?? "");
		const from = containers.find((each) => each.ID === name || each.Names === name);
		if (from === undefined) fail(fill(texts["no-such-container"] ?? "", name));
		const set: [string, string][] = [];
		for (const [instruction, text] of instructions(changes.join("\n"))) {
			if (!CHANGES.includes(instruction)) fail(fill(texts["change-command"] ?? "", instruction));
			if (instruction === "label") set.push(...pairs(text));
		}
		const kept = String(from?.Labels).split(",").filter((pair) => pair !== "").map(cut);
		say(`sha256:${built(new Map([...kept, ...set]), reference === undefined ? [] : [reference]).padEnd(64, "0")}`);
	} else if (["container", "buildx", "image", "network", "volume"].includes(command)) say("0123456789abcdef".repeat(4));
	else fail(`docker: '${command}' is not a docker command.\nSee 'docker --help'`);
}
