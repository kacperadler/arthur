// The words of `arthur dokploy` (AR0681, AR0682): its verb, the words after it and its flags, or nothing for wrong usage, which the
// command answers with the usage line and exit code 2. docs/commands/dokploy.md.

export const USAGE = "usage: arthur dokploy apps|app [<app>]|status [<app>]|upload [<app>] <file or folder> [--replace-source]|deploy [<app>]|create <name> --dokploy-project <name> [--environment <name>]|setup <app> [--dockerfile <path>] [--context <path>] [--domain <host> --port <n>] [--volume <name>:<path>]|env <app> names|env <app> set <NAME> <value>|source <app> --repo <owner>/<name> --branch <branch> [--build-path <path>] [--github <name>] [--replace-source]|postgres create <app> <name> [--version <n>] [--env <NAME>]|postgres status <postgres>|postgres backup <postgres> --destination <name> --schedule <cron> [--keep <n>], each [--instance <name>]; --project <name> for another project than the main one";
// Whether the words after a verb and its flags make a call of it.
type Fits = (rest: readonly string[], one: (flag: string) => string | undefined, flags: readonly string[]) => boolean;
// Each verb's flags besides `--instance`, and its call: `upload` takes its path and the app; `env` `names`, or `set` with a name
// and a value, which alone may be empty or start with `-`; `setup` at least one of its flags, `--domain` and `--port` together.
const VERBS: Readonly<Record<string, readonly [readonly string[], Fits]>> = {
	...{ apps: [[], (rest) => rest.length === 0], app: [[], (rest) => rest.length < 2], status: [[], (rest) => rest.length < 2], deploy: [[], (rest) => rest.length < 2] },
	upload: [["--replace-source"], (rest) => rest.length === 1 || rest.length === 2],
	env: [[], (rest) => (rest[1] === "names" && rest.length === 2) || (rest[1] === "set" && rest.length === 4)],
	create: [["--dokploy-project", "--environment"], (rest, one) => rest.length === 1 && one("--dokploy-project") !== undefined],
	setup: [
		["--dockerfile", "--context", "--domain", "--port", "--volume"],
		(rest, one, flags) => rest.length === 1 && flags.some((flag) => flag !== "--instance") && (one("--domain") === undefined) === (one("--port") === undefined),
	],
	source: [["--repo", "--branch", "--build-path", "--github", "--replace-source"], (rest, one) => rest.length === 1 && one("--repo") !== undefined && one("--branch") !== undefined],
	// `create <app> <name>` with its flags, `status <postgres>` with none, `backup <postgres>` with `--destination` and `--schedule`.
	postgres: [
		["--version", "--env", "--destination", "--schedule", "--keep"],
		(rest, one, flags) => {
			const own = rest[0] === "create" ? ["--version", "--env"] : rest[0] === "backup" ? ["--destination", "--schedule", "--keep"] : [];
			const fits = (rest[0] === "create" && rest.length === 3) || ((rest[0] === "status" || rest[0] === "backup") && rest.length === 2);
			return fits && flags.every((flag) => flag === "--instance" || own.includes(flag)) && (rest[0] !== "backup" || (one("--destination") !== undefined && one("--schedule") !== undefined));
		},
	],
};
const FLAGS = ["--instance", ...new Set(Object.values(VERBS).flatMap(([flags]) => flags))];

export type Parsed = { readonly verb: string; readonly rest: readonly string[]; readonly one: (flag: string) => string | undefined };

export function parseArgs(args: readonly string[]): Parsed | undefined {
	const [words, flags] = [[] as string[], new Map<string, string[]>()];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		if (!FLAGS.includes(arg)) words.push(arg);
		else flags.set(arg, [...(flags.get(arg) ?? []), arg === "--replace-source" ? "on" : (args[++index] ?? "")]);
	}
	const [verb = "", ...rest] = words;
	const taken = Object.hasOwn(VERBS, verb) ? VERBS[verb] : undefined;
	if (taken === undefined) return undefined;
	const [allowed, fits] = taken;
	const one = (flag: string) => flags.get(flag)?.[0];
	const checked = [...(verb === "env" ? rest.slice(0, 3) : rest), ...[...flags.values()].flat()];
	if (!fits(rest, one, [...flags.keys()]) || [...flags].some(([flag, values]) => values.length > 1 || (flag !== "--instance" && !allowed.includes(flag))) || checked.some((word) => word === "" || word.startsWith("-"))) return undefined;
	return { verb, rest, one };
}
