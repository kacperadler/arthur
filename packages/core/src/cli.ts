#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Command, type CommandRegistry, commandRegistry } from "./commands.ts";
import { configCheck } from "./config-check.ts";
import { loadConfig } from "./config.ts";
import { loadPlugins } from "./host.ts";

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

// Every command, the core's and the plugins'; when the config or a plugin does not load, the core's alone and the reason.
async function load(): Promise<{ readonly commands: CommandRegistry; readonly problem?: string }> {
	const commands = core();
	try {
		await loadPlugins(await loadConfig("arthur.config.ts"), process.env, commands);
		return { commands };
	} catch (error) {
		const problem = error instanceof Error ? error.message : String(error);
		return { commands: core(problem), problem };
	}
}

// `problem`: why the plugins' commands are missing, said with every list of the commands.
function core(problem?: string): CommandRegistry {
	const commands = commandRegistry();
	commands.register("core", {
		name: "config",
		doc: new URL("../docs/commands/config.md", import.meta.url),
		async run({ args }) {
			if (args.length !== 1 || args[0] !== "check") {
				console.error("usage: arthur config check");
				return 2;
			}
			const { lines, ok } = await configCheck("arthur.config.ts");
			for (const line of lines) console.log(line);
			return ok ? 0 : 1;
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
