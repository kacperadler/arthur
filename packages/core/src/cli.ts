#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Board } from "./board.ts";
import { type Command, type CommandRegistry, commandRegistry } from "./commands.ts";
import { configCheck } from "./config-check.ts";
import { loadConfig } from "./config.ts";
import { loadPlugins } from "./host.ts";
import type { JobRunner, SpawnRequest } from "./jobs.ts";
import { ticketCommand } from "./ticket-command.ts";
import type { Plugin } from "./plugin.ts";
import { runPlugins } from "./run.ts";

// The `arthur` binary (spec/roadmap.md, entry 6): `arthur <command> [args]` runs a command the core or a plugin registered, on
// `arthur.config.ts` in the working folder. The core's own commands run even when the config or a plugin does not load.

const USAGE = "usage: arthur <command> [args] [--project <name>]; arthur <command> --help; arthur help <command>";

process.exitCode = await main(process.argv.slice(2));

async function main(argv: readonly string[]): Promise<number> {
	const rest: string[] = [];
	let project: string | undefined;
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index] ?? "";
		if (arg !== "--project") {
			rest.push(arg);
			continue;
		}
		const value = argv[++index];
		if (value === undefined || value.startsWith("-")) return usage("--project needs a project name");
		if (project !== undefined) return usage(`--project given twice: ${project}, ${value}`);
		project = value;
	}
	const [name = "help", ...args] = rest[0] === "--help" ? [] : rest;
	const { commands, problem } = await load();
	const command = commands.find(name);
	if (command === undefined) return unknown(name, commands, problem);
	if (args.includes("--help")) return printDoc(command);
	try {
		return (await command.run({ args, project })) ?? 0;
	} catch (error) {
		console.error(`arthur ${name}: ${error instanceof Error ? error.message : String(error)}`);
		return 1;
	}
}

// What `arthur run` starts: the plugins as loaded, in setup order, and the home folder; `jobs` is what `arthur spawn` uses,
// `board`, the core's, what `arthur ticket` uses.
type Loaded = { readonly plugins: readonly Plugin[]; readonly home: string; readonly jobs: JobRunner; readonly board: Board };

// Every command, the core's and the plugins'; when the config or a plugin does not load, the core's alone and the reason.
async function load(): Promise<{ readonly commands: CommandRegistry; readonly problem?: string }> {
	let loaded: Loaded | undefined;
	const commands = core(undefined, () => loaded);
	try {
		const config = await loadConfig("arthur.config.ts");
		const { plugins, jobs, board } = await loadPlugins(config, process.env, commands);
		loaded = { plugins, home: config.core.home, jobs, board };
		return { commands };
	} catch (error) {
		const problem = error instanceof Error ? error.message : String(error);
		return { commands: core(problem, () => undefined), problem };
	}
}

// `problem`: why the plugins' commands are missing, said with every list of the commands; `loaded` once the plugins are set up.
function core(problem: string | undefined, loaded: () => Loaded | undefined): CommandRegistry {
	const commands = commandRegistry();
	commands.register(
		"core",
		ticketCommand(() => {
			const board = loaded()?.board;
			if (board === undefined) throw new Error(`the board needs the project list, and arthur.config.ts did not load:\n${problem}`);
			return board;
		}),
	);
	commands.register("core", {
		name: "config",
		doc: new URL("../docs/commands/config.md", import.meta.url),
		async run({ args }) {
			if (args.length !== 1 || args[0] !== "check") {
				console.error("usage: arthur config check");
				return 2;
			}
			const { lines, ok } = await configCheck("arthur.config.ts", process.env, problem);
			for (const line of lines) console.log(line);
			return ok ? 0 : 1;
		},
	});
	commands.register("core", {
		name: "run",
		doc: new URL("../docs/commands/run.md", import.meta.url),
		run({ args }) {
			if (args.length > 0) {
				console.error("usage: arthur run");
				return 2;
			}
			const app = loaded();
			if (app === undefined) throw new Error(`arthur.config.ts did not load:\n${problem}`);
			return runPlugins(app.plugins, app.home);
		},
	});
	commands.register("core", {
		name: "spawn",
		doc: new URL("../docs/commands/spawn.md", import.meta.url),
		async run({ args, project }) {
			const request = spawnRequest(args, project);
			if (typeof request === "string") {
				console.error(`arthur spawn: ${request}\nusage: arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>]`);
				return 2;
			}
			const app = loaded();
			if (app === undefined) throw new Error(`arthur.config.ts did not load:\n${problem}`);
			console.log((await app.jobs.spawn(request)).id);
		},
	});
	commands.register("core", {
		name: "help",
		doc: new URL("../docs/commands/help.md", import.meta.url),
		run({ args }) {
			if (args.length > 1) return usage("help takes one command name");
			const [name] = args;
			if (name !== undefined) {
				const command = commands.find(name);
				return command === undefined ? unknown(name, commands, problem) : printDoc(command);
			}
			console.log(`${USAGE}\ncommands: ${commands.names().join(", ")}`);
			if (problem !== undefined) console.error(notLoaded(problem));
			return 0;
		},
	});
	return commands;
}

// One task and the flags of `arthur spawn`, or what is wrong with them.
function spawnRequest(args: readonly string[], project: string | undefined): SpawnRequest | string {
	const flags: Record<string, string> = {};
	const tasks: string[] = [];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		if (!arg.startsWith("--")) {
			tasks.push(arg);
			continue;
		}
		const name = arg.slice(2);
		const value = args[++index];
		if (!["kind", "model", "thinking"].includes(name)) return `unknown flag ${arg}`;
		if (value === undefined || value === "" || value.startsWith("--")) return `${arg} needs a value`;
		if (name in flags) return `${arg} given twice`;
		flags[name] = value;
	}
	if (tasks.length !== 1) return tasks.length === 0 ? "no task" : `one task, quoted; got ${tasks.length} arguments`;
	return { task: tasks[0] ?? "", kind: flags.kind, model: flags.model, thinking: flags.thinking, project };
}

function usage(problem: string): number {
	console.error(`arthur: ${problem}\n${USAGE}`);
	return 2;
}

function unknown(name: string, commands: CommandRegistry, problem: string | undefined): number {
	console.error(`arthur: unknown command ${name}\ncommands: ${commands.names().join(", ")}`);
	if (problem !== undefined) console.error(notLoaded(problem));
	return 2;
}

function notLoaded(problem: string): string {
	return `only the core's commands are listed: arthur.config.ts did not load:\n${problem}`;
}

// The doc file existed when the command was registered; it may have been deleted since.
function printDoc(command: Command): number {
	if (!existsSync(command.doc)) {
		console.error(`arthur ${command.name}: its doc file ${fileURLToPath(command.doc)} was deleted after Arthur loaded`);
		return 1;
	}
	process.stdout.write(readFileSync(command.doc, "utf8"));
	return 0;
}
