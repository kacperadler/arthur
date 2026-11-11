// The words of `arthur dokploy` (AR0681): its verb, the words after it and its flags, or nothing for wrong usage, which the
// command answers with the usage line and exit code 2. docs/commands/dokploy.md.

export const USAGE = "usage: arthur dokploy apps|app [<app>]|status [<app>]|upload [<app>] <file or folder> [--replace-source]|deploy [<app>]|create <name> --dokploy-project <name> [--environment <name>]|setup <app> [--dockerfile <path>] [--context <path>] [--domain <host> --port <n>] [--volume <name>:<path>]|env <app> names|env <app> set <NAME> <value>|source <app> --repo <owner>/<name> --branch <branch> [--build-path <path>] [--github <name>] [--replace-source]|postgres create <app> <name> [--version <n>] [--env <NAME>]|postgres status <postgres>, each [--instance <name>]; --project <name> for another project than the main one";
// The words a verb takes after it, at least and at most, and its flags besides `--instance`: `upload` its path and the app.
const TAKES: Readonly<Record<string, readonly [number, number, readonly string[]]>> = {
	...{ apps: [0, 0, []], app: [0, 1, []], status: [0, 1, []], upload: [1, 2, ["--replace-source"]], deploy: [0, 1, []], env: [2, 4, []] },
	...{ create: [1, 1, ["--dokploy-project", "--environment"]], setup: [1, 1, ["--dockerfile", "--context", "--domain", "--port", "--volume"]] },
	...{ source: [1, 1, ["--repo", "--branch", "--build-path", "--github", "--replace-source"]], postgres: [2, 3, ["--version", "--env"]] },
};
const FLAGS = ["--instance", "--replace-source", "--dokploy-project", "--environment", "--dockerfile", "--context", "--domain", "--port", "--volume", "--repo", "--branch", "--build-path", "--github", "--version", "--env"];

export type Parsed = { readonly verb: string; readonly rest: readonly string[]; readonly one: (flag: string) => string | undefined };

export function parseArgs(args: readonly string[]): Parsed | undefined {
	const [words, flags] = [[] as string[], new Map<string, string[]>()];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		if (!FLAGS.includes(arg)) words.push(arg);
		else flags.set(arg, [...(flags.get(arg) ?? []), arg === "--replace-source" ? "on" : (args[++index] ?? "")]);
	}
	const [verb = "", ...rest] = words;
	// An unknown verb takes at least one word and at most none, so any call of it is wrong.
	const [least, most, allowed] = (Object.hasOwn(TAKES, verb) ? TAKES[verb] : undefined) ?? [1, 0, []];
	const one = (flag: string) => flags.get(flag)?.[0];
	// `env` takes `names`, or `set` with a name and a value, which alone may be empty or start with `-`; `setup` at least one of
	// its flags, `--domain` and `--port` together; `postgres` `create <app> <name>`, or `status <postgres>` without create's flags.
	const setup = [...flags.keys()].some((flag) => flag !== "--instance") && (one("--domain") === undefined) === (one("--port") === undefined);
	const postgres = (rest[0] === "create" && rest.length === 3) || (rest[0] === "status" && rest.length === 2 && one("--version") === undefined && one("--env") === undefined);
	const shapes: Readonly<Record<string, boolean>> = { env: (rest[1] === "names" && rest.length === 2) || (rest[1] === "set" && rest.length === 4), setup, postgres };
	const lacks = (verb === "create" && one("--dokploy-project") === undefined) || (verb === "source" && (one("--repo") === undefined || one("--branch") === undefined));
	const wrong = rest.length < least || rest.length > most || shapes[verb] === false || lacks;
	const checked = [...(verb === "env" ? rest.slice(0, 3) : rest), ...[...flags.values()].flat()];
	if (wrong || [...flags].some(([flag, values]) => values.length > 1 || (flag !== "--instance" && !allowed.includes(flag))) || checked.some((word) => word === "" || word.startsWith("-"))) return undefined;
	return { verb, rest, one };
}
