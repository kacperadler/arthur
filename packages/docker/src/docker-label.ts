import { spawnSync } from "node:child_process";

// The argument rewrite of a job's `docker` script (spec/roadmap.md, entry 70): `--label arthur.job=<id>` right after each
// command that creates something, every `arthur.job` label the job gave taken out, so one job cannot label for another; every
// other command passes unchanged. The prepare copies this file to the job's script folder on its machine and the script runs
// it as `node <copy> <real docker> <id> <args>...`, so it imports only `node:` modules. docs/docker.md.

const CREATES = [["run"], ["create"], ["container", "run"], ["container", "create"], ["build"], ["buildx", "build"], ["image", "build"], ["network", "create"], ["volume", "create"]];
// docker's own options before the command (docker/cli v29, cli/flags/options.go) that take a value, long and short.
const GLOBAL = ["--config", "--context", "--host", "--log-level", "--tlscacert", "--tlscert", "--tlskey"];
const GLOBAL_SHORT = "cHl";
// `run` and `create` (container/opts.go, run.go, create.go): the long options that take no value, every other one takes one;
// the short ones that take one.
const BARE = ["--detach", "--disable-content-trust", "--help", "--init", "--interactive", "--no-healthcheck", "--oom-kill-disable", "--privileged", "--publish-all", "--quiet", "--read-only", "--rm", "--sig-proxy", "--tty", "--use-api-socket"];
const RUN_SHORT = "acehlmpuvw";
// A label of the key `arthur.job`, with a value or without, as Docker splits it at its first `=`.
const OURS = /^arthur\.job(=|$)/;

// How many arguments the short group at `args[at]` spans (`-it`, `-p 80:80`, `-dl x`), the label it gives with `l`, and the
// group before its option that takes a value.
function short(args: readonly string[], at: number, valued: string): { span: number; label?: string; before: string } {
	const group = args[at] ?? "";
	for (let index = 1; index < group.length; index++) {
		if (!valued.includes(group[index] ?? "")) continue;
		const rest = group.slice(index + 1).replace(/^=/, "");
		const value = rest === "" ? args[at + 1] : rest;
		return { span: rest === "" ? 2 : 1, ...(group[index] === "l" ? { label: value } : {}), before: group.slice(0, index) };
	}
	return { span: 1, before: group };
}

export function labelled(args: readonly string[], id: string): string[] {
	let at = 0;
	while (args[at]?.startsWith("-") && args[at] !== "-" && args[at] !== "--") {
		const arg = args[at] as string;
		at += arg.startsWith("--") ? (GLOBAL.includes(arg) ? 2 : 1) : short(args, at, GLOBAL_SHORT).span;
	}
	// Docker runs the command after a `--` that ends its own options: `docker -- run img`.
	if (args[at] === "--") at++;
	const words = CREATES.find((each) => each.every((word, index) => args[at + index] === word));
	if (words === undefined) return [...args];
	// Arguments after `run`'s or `create`'s image are the container's; the other commands take options anywhere before `--`.
	const container = words.length === 1 ? words[0] !== "build" : words[0] === "container";
	const kept: string[] = [];
	for (let index = at + words.length; index < args.length; ) {
		const arg = args[index] as string;
		const option = arg.startsWith("-") && arg !== "-";
		if (arg === "--" || (container && !option)) {
			kept.push(...args.slice(index));
			break;
		}
		if (!option) {
			kept.push(arg);
			index++;
		} else if (arg.startsWith("--")) {
			const [name = "", value] = arg.split(/=(.*)/s);
			const span = value === undefined && (name === "--label" || (container && !BARE.includes(name))) ? 2 : 1;
			if (name !== "--label" || !OURS.test(value ?? args[index + 1] ?? "")) kept.push(...args.slice(index, index + span));
			index += span;
		} else {
			const group = container ? short(args, index, RUN_SHORT) : { span: 1, before: arg };
			if (!OURS.test(group.label ?? "")) kept.push(...args.slice(index, index + group.span));
			else if (group.before !== "-") kept.push(group.before);
			index += group.span;
		}
	}
	return [...args.slice(0, at + words.length), "--label", `arthur.job=${id}`, ...kept];
}

if (import.meta.main) {
	const [docker = "", id = "", ...args] = process.argv.slice(2);
	const ran = spawnSync(docker, labelled(args, id), { stdio: "inherit" });
	if (ran.error !== undefined) console.error(`docker: ${docker}: ${ran.error.message}`);
	process.exitCode = ran.status ?? 1;
}
