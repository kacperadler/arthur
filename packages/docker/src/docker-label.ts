import { spawnSync } from "node:child_process";

// The argument rewrite of a job's `docker` script (spec/roadmap.md, entry 70): `--label arthur.job=<id>` right after each
// command that creates something, and every word that sets the `arthur.job` key dropped wherever it stands, so one job cannot
// label for another; every other command passes unchanged. The prepare copies this file to the job's script folder on its
// machine and the script runs it as `node <copy> <real docker> <id> <args>...`, so it imports only `node:` modules. docs/docker.md.

const CREATES = [["run"], ["create"], ["container", "run"], ["container", "create"], ["build"], ["buildx", "build"], ["image", "build"], ["network", "create"], ["volume", "create"]];
// docker's own options before the command (docker/cli v29, cli/flags/options.go) that take a value, long and short.
const GLOBAL = ["--config", "--context", "--host", "--log-level", "--tlscacert", "--tlscert", "--tlskey"];
const GLOBAL_SHORT = "cHl";
// The `arthur.job` key, with a value or without, as Docker splits a label at its first `=`.
const KEY = /^arthur\.job(=|$)/;
// A short group whose last option is `l` and that gives its value in the same word: `-l=…`, `-l…`, `-dl…`.
const SHORT = /^(-[A-Za-z]*?)l=?(.*)$/s;

// Which word may set the key is not guessed per option: an option's value can be `--label` or `--`, after which Docker reads on.
// So every word that sets it goes, before or after a `--` or an image: `--label=k=v`, `-l=k=v`, `-lk=v`, a bare `k=v` with
// the `--label`, `-l` or `-…l` before it (that group keeps its other options), and a bare `k=v` alone.
function stripped(args: readonly string[]): string[] {
	const kept: string[] = [];
	for (const arg of args) {
		const short = arg.startsWith("--") ? null : SHORT.exec(arg);
		if (arg.startsWith("--label=") && KEY.test(arg.slice(8))) continue;
		if (short !== null && KEY.test(short[2] ?? "")) {
			if (short[1] !== "-") kept.push(short[1] ?? "");
			continue;
		}
		if (!KEY.test(arg)) {
			kept.push(arg);
			continue;
		}
		const before = kept.at(-1) ?? "";
		if (before === "--label" || /^-[A-Za-z]*l$/.test(before)) kept.pop();
		if (/^-[A-Za-z]+l$/.test(before)) kept.push(before.slice(0, -1));
	}
	return kept;
}

export function labelled(args: readonly string[], id: string): string[] {
	let at = 0;
	while (args[at]?.startsWith("-") && args[at] !== "-" && args[at] !== "--") {
		const arg = args[at] as string;
		const valued = [...arg.slice(1)].findIndex((letter) => GLOBAL_SHORT.includes(letter));
		at += arg.startsWith("--") ? (GLOBAL.includes(arg) ? 2 : 1) : valued === arg.length - 2 ? 2 : 1;
	}
	// Docker runs the command after a `--` that ends its own options: `docker -- run img`.
	if (args[at] === "--") at++;
	const words = CREATES.find((each) => each.every((word, index) => args[at + index] === word));
	if (words === undefined) return [...args];
	const end = at + words.length;
	return [...args.slice(0, end), "--label", `arthur.job=${id}`, ...stripped(args.slice(end))];
}

if (import.meta.main) {
	const [docker = "", id = "", ...args] = process.argv.slice(2);
	const ran = spawnSync(docker, labelled(args, id), { stdio: "inherit" });
	if (ran.error !== undefined) console.error(`docker: ${docker}: ${ran.error.message}`);
	process.exitCode = ran.status ?? 1;
}
