import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The fake `docker` and `ssh` of the docker plugin's tests, in a folder of the test's own put first on PATH; no test reaches the
// real Docker of the machine. `docker` is this file run by node: each argument list appended to `calls` as a JSON line, its
// answers in the keys docker-shapes.json records from docker/cli and moby v29.9.2, from `state.json` (`State`); while `down`
// exists every command that needs the daemon fails with Docker's line and exit 1. `ssh <options> <host> <command>` runs the
// command here, the fake docker included, or fails as ssh does (255) while `<host>.down` exists.

const { shapes, texts } = JSON.parse(readFileSync(new URL("docker-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown>; texts: Record<string, string> };

export type Kind = "ps" | "network-ls" | "volume-ls" | "image-ls" | "system-df";
type Row = Readonly<Record<string, unknown>>;
// What the daemon holds: `info`'s fields; `host`, the context's endpoint; each listing's rows, and `volume inspect`'s.
export type State = { readonly info: Row; readonly host: string; readonly rows: Readonly<Partial<Record<Kind, readonly Row[]>>>; readonly volumes: readonly Row[] };

export const VERSION = "29.9.2";
const STATE: State = { info: { DockerRootDir: "/var/lib/docker", SecurityOptions: ["name=seccomp,profile=builtin", "name=cgroupns"], ServerVersion: VERSION, Warnings: null }, host: "unix:///var/run/docker.sock", rows: {}, volumes: [] };
const fill = (text: string, ...values: string[]) => values.reduce((done, value) => done.replace("%s", value), text);
// The listings the fake answers, by their command words.
const LISTS: Readonly<Record<string, Kind>> = { ps: "ps", "container ls": "ps", "network ls": "network-ls", "volume ls": "volume-ls", "image ls": "image-ls", images: "image-ls", "system df": "system-df" };

// One row of `kind` in Docker's keys, each one not given "" (`Platform` null), as `--format '{{json .}}'` prints it.
export const row = (kind: Kind, given: Row): Row => ({ ...Object.fromEntries(Object.keys(shapes[kind] as Row).map((key) => [key, key === "Platform" ? null : ""])), ...given });

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
	let at = 0;
	while (args[at]?.startsWith("-") && !["-v", "--version"].includes(args[at] ?? "")) at += ["--config", "--context", "-c", "--host", "-H", "--log-level", "-l", "--tlscacert", "--tlscert", "--tlskey"].includes(args[at] ?? "") ? 2 : 1;
	const [command = "", sub = "", ...rest] = args.slice(at);
	const format = args[args.indexOf("--format") + 1] ?? "";
	const words = `${command} ${sub}`;
	const kind = LISTS[command] ?? LISTS[words];
	if (command === "-v" || command === "--version") say(fill(texts.version ?? "", VERSION, "a82e528"));
	else if (words === "context inspect") format === "{{.Endpoints.docker.Host}}" ? say(state.host) : fail(`the fake answers context inspect only with --format '{{.Endpoints.docker.Host}}', got ${format}`, 2);
	else if (existsSync(join(folder, "down"))) fail(fill(texts.daemon ?? "", state.host));
	else if (command === "info")
		say(format.replace(/\{\{"\\n"\}\}/g, "\n").replace(/\{\{(json )?\.(\w+)\}\}/g, (_, json, key) => (json ? JSON.stringify(state.info[key] ?? null) : String(state.info[key] ?? "<no value>"))));
	else if (kind !== undefined) {
		if (format !== "{{json .}}") fail(`the fake answers ${words} only with --format '{{json .}}', got ${format}`, 2);
		for (const each of state.rows[kind] ?? []) say(JSON.stringify(each));
	} else if (words === "volume inspect") say(JSON.stringify(state.volumes.filter((volume) => rest.includes(String(volume.Name))), null, 4));
	else if (words === "builder prune") say(fill(texts["builder-prune"] ?? "", "0B"));
	else if (["run", "create", "build", "container", "buildx", "image", "network", "volume"].includes(command)) say("0123456789abcdef".repeat(4));
	else fail(`docker: '${command}' is not a docker command.\nSee 'docker --help'`);
}
