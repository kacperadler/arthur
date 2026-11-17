import { spawnSync } from "node:child_process";

// The argument rewrite of a job's `docker` script (spec/roadmap.md, entry 70): `--label arthur.job=<id>` right after each command
// that creates something, and `--label arthur.container=<id>` after one that makes a container, which takes its image's labels too,
// so only this one tells the job's container from the owner's; every word that sets either key dropped wherever it stands, so one
// job cannot label for another. An image a job builds or commits gets both marks of a container empty (AR0720); every other command
// passes unchanged. The prepare copies this file to the job's script folder on its machine and the script runs it as
// `node <copy> <real docker> <id> <args>...`, so it imports only `node:` modules. docs/docker.md.

// The commands that make a container, an image (`docker buildx build --help` lists a build's aliases), a network or a volume.
const CONTAINER = [["run"], ["create"], ["container", "run"], ["container", "create"]];
const IMAGE = [["build"], ["buildx", "build"], ["buildx", "b"], ["image", "build"], ["builder", "build"]];
const OTHER = [["network", "create"], ["volume", "create"]];
const COMMIT = [["commit"], ["container", "commit"]];
// docker's own options before the command (docker/cli v29, cli/flags/options.go) that take a value, long and short.
const GLOBAL = ["--config", "--context", "--host", "--log-level", "--tlscacert", "--tlscert", "--tlskey"];
const GLOBAL_SHORT = "cHl";
// The `arthur.job` and `arthur.container` keys, with a value or without, as Docker splits a label at its first `=`; on a build
// compose's config hash too, the other mark of a container (docker-look.ts, jobOf).
const KEY = /^arthur\.(job|container)(=|$)/;
const IMAGE_KEY = /^(arthur\.(job|container)|com\.docker\.compose\.config-hash)(=|$)/;
// A short group whose last option is `l` and that gives its value in the same word: `-l=…`, `-l…`, `-dl…`.
const SHORT = /^(-[A-Za-z]*?)l=?(.*)$/s;
// Both marks of a container set empty, which reads as none. A build's `--label` has the last word over its Dockerfile's `LABEL`
// and its base image's labels (buildkit dockerfile2llb); a commit keeps each label its changes do not set (moby daemon/commit.go).
const BLANK = ["--label", "arthur.container=", "--label", "com.docker.compose.config-hash="];
const CHANGE = ["--change", 'LABEL arthur.container="" com.docker.compose.config-hash=""'];

// Which word may set the key is not guessed per option: an option's value can be `--label` or `--`, after which Docker reads on.
// So every word that sets it goes, before or after a `--` or an image: `--label=k=v`, `-l=k=v`, `-lk=v`, a bare `k=v` with
// the `--label`, `-l` or `-…l` before it (that group keeps its other options), and a bare `k=v` alone.
function stripped(args: readonly string[], key: RegExp): string[] {
	const kept: string[] = [];
	for (const arg of args) {
		const short = arg.startsWith("--") ? null : SHORT.exec(arg);
		if (arg.startsWith("--label=") && key.test(arg.slice(8))) continue;
		if (short !== null && key.test(short[2] ?? "")) {
			if (short[1] !== "-") kept.push(short[1] ?? "");
			continue;
		}
		if (!key.test(arg)) {
			kept.push(arg);
			continue;
		}
		const before = kept.at(-1) ?? "";
		if (before === "--label" || /^-[A-Za-z]*l$/.test(before)) kept.pop();
		if (/^-[A-Za-z]+l$/.test(before)) kept.push(before.slice(0, -1));
	}
	return kept;
}

// The index of the first word at `at` or after that is no option, as pflag reads them: a long one of `long`, or a short group
// whose first letter of `short` is its last, takes the next word as its value.
function past(args: readonly string[], at: number, long: readonly string[], short: string): number {
	while (args[at]?.startsWith("-") && args[at] !== "-" && args[at] !== "--") {
		const arg = args[at] as string;
		const valued = [...arg.slice(1)].findIndex((letter) => short.includes(letter));
		at += arg.startsWith("--") ? (long.includes(arg) ? 2 : 1) : valued === arg.length - 2 ? 2 : 1;
	}
	return at;
}

export function labelled(args: readonly string[], id: string): string[] {
	let at = past(args, 0, GLOBAL, GLOBAL_SHORT);
	// Docker runs the command after a `--` that ends its own options: `docker -- run img`.
	if (args[at] === "--") at++;
	// buildx's own options (docker buildx --help) may stand before its command: `--builder` takes the next word; buildx reads no `--`.
	let next = at + 1;
	while (args[at] === "buildx" && args[next]?.startsWith("-") && args[next] !== "-" && args[next] !== "--") next += args[next] === "--builder" ? 2 : 1;
	const words = [...CONTAINER, ...IMAGE, ...OTHER, ...COMMIT].find((each) => each.every((word, index) => args[index === 0 ? at : next + index - 1] === word));
	if (words === undefined) return [...args];
	const end = next + words.length - 1;
	if (COMMIT.includes(words)) {
		// commit (docker/cli container/commit.go) reads no option after CONTAINER and applies its changes in order, as one Dockerfile: ours
		// go last, so a `LABEL` of the job's own loses, and twice, so a change ending in a line continuation takes only the first.
		const last = past(args, end, ["--author", "--change", "--message"], "acm");
		return [...args.slice(0, last), ...CHANGE, ...CHANGE, ...args.slice(last)];
	}
	const own = CONTAINER.includes(words) ? ["--label", `arthur.container=${id}`] : IMAGE.includes(words) ? BLANK : [];
	return [...args.slice(0, end), "--label", `arthur.job=${id}`, ...own, ...stripped(args.slice(end), IMAGE.includes(words) ? IMAGE_KEY : KEY)];
}

if (import.meta.main) {
	const [docker = "", id = "", ...args] = process.argv.slice(2);
	const ran = spawnSync(docker, labelled(args, id), { stdio: "inherit" });
	if (ran.error !== undefined) console.error(`docker: ${docker}: ${ran.error.message}`);
	process.exitCode = ran.status ?? 1;
}
