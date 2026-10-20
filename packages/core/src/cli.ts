#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Command, type CommandRegistry, commandRegistry } from "./commands.ts";
import { configCheck } from "./config-check.ts";
import { type LoadedConfig, loadConfig } from "./config.ts";
import { type DoctorLine, doctor, ownAnswers, printAtStart } from "./doctor.ts";
import { parseFlags } from "./flags.ts";
import { type LoadedPlugins, loadPlugins } from "./host.ts";
import { jobCommands } from "./job-commands.ts";
import { coreVersion } from "./job-machine.ts";
import { remoteJobCommand } from "./remote-job.ts";
import { rolesCommand } from "./roles-command.ts";
import { sendCommand } from "./send-command.ts";
import { spawnCommand } from "./spawn-command.ts";
import { ticketCommand } from "./ticket-command.ts";
import type { Plugin } from "./plugin.ts";
import { coreRequirements } from "./requirements.ts";
import { runPlugins } from "./run.ts";
import { setup } from "./setup.ts";

// The `arthur` binary (spec/roadmap.md, entry 6): `arthur <command> [args]` runs a command the core or a plugin registered, on
// `arthur.config.ts` in the working folder. The core's own commands run even when the config or a plugin does not load.

const USAGE = "usage: arthur <command> [args] [--project <name>]; arthur <command> --help; arthur help <command>";

process.exitCode = await main(process.argv.slice(2));

async function main(argv: readonly string[]): Promise<number> {
	const parsed = parseFlags(argv, { project: (value, before) => (value === undefined || value.startsWith("-") ? "needs a project name" : before === undefined ? undefined : `given twice: ${before}, ${value}`) }, true);
	if (typeof parsed === "string") return usage(parsed);
	const { words: rest, values: { project } } = parsed;
	const [name = "help", ...args] = rest[0] === "--help" ? [] : rest;
	const { commands, problem, project: known } = await load();
	const command = commands.find(name);
	if (command === undefined) return unknown(name, commands, problem);
	if (args.includes("--help")) return printDoc(command);
	try {
		// No command runs for a project Arthur does not know; without a load the commands that read the list refuse anyway.
		if (project !== undefined) known?.(project);
		return (await command.run({ args, project })) ?? 0;
	} catch (error) {
		console.error(`arthur ${name}: ${error instanceof Error ? error.message : String(error)}`);
		return 1;
	}
}

// What `arthur run` starts: the plugins as loaded, in setup order, the home folder and how to follow the event log; `jobs` is
// what `arthur spawn` uses, `board`, the core's, and `autopilot` what `arthur ticket` uses; `channels` what `arthur send` uses.
type Loaded = Pick<LoadedPlugins, "plugins" | "follow" | "jobs" | "board" | "autopilot" | "doctor" | "emit" | "channels"> & { readonly home: string };

// Every command, the core's and the plugins'; when the config or a plugin does not load, the core's alone and the reason.
async function load(): Promise<{ readonly commands: CommandRegistry; readonly problem?: string; readonly project?: LoadedPlugins["project"] }> {
	let loaded: Loaded | undefined;
	let read: LoadedConfig | undefined;
	const commands = core(undefined, () => loaded);
	try {
		const config = await loadConfig("arthur.config.ts");
		read = config;
		const { plugins, jobs, board, follow, project, autopilot, doctor: checks, emit, channels } = await loadPlugins(config, process.env, commands);
		loaded = { plugins, home: config.core.home, follow, jobs, board, autopilot, doctor: checks, emit, channels };
		return { commands, project };
	} catch (error) {
		const problem = error instanceof Error ? error.message : String(error);
		return { commands: core(problem, () => undefined, read), problem };
	}
}

// `problem`: why the plugins' commands are missing, said with every list of the commands; `loaded` once the plugins are set up;
// `config` when it loaded and a plugin did not, for the core's own requirements and each plugin's own `doctor`.
function core(problem: string | undefined, loaded: () => Loaded | undefined, config?: LoadedConfig): CommandRegistry {
	const commands = commandRegistry();
	// What a command takes from the load; `why` it needs the load, said when arthur.config.ts did not load.
	const need = <T>(why: string, pick: (app: Loaded) => T) => () => {
		const app = loaded();
		if (app === undefined) throw new Error(`${why}arthur.config.ts did not load:\n${problem}`);
		return pick(app);
	};
	const jobs = need("", (app) => app.jobs);
	commands.register("core", ticketCommand(need("the board needs the project list, and ", (app) => app.board), jobs, need("", (app) => app.autopilot)));
	commands.register("core", rolesCommand(need("the roles are what the plugins registered, and ", (app) => app.jobs)));
	commands.register("core", spawnCommand(jobs));
	commands.register("core", sendCommand(need("the channels are plugins, and ", (app) => app.channels)));
	for (const command of jobCommands(need("the job records are in the configured home folder, and ", (app) => app.home), jobs)) commands.register("core", command);
	commands.register("core", remoteJobCommand());
	commands.register("core", { name: "version", doc: new URL("../docs/commands/version.md", import.meta.url), run: () => console.log(coreVersion()) });
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
	// Without the plugins' setup, the core's requirements and each plugin's `doctor`: a missing home, git or variable may be why.
	const coreLines = (): Promise<DoctorLine[]> | undefined => config && doctor(coreRequirements(config.core.home, config.core.agent.command), ownAnswers(config.plugins, config.core));
	commands.register("core", {
		name: "doctor",
		doc: new URL("../docs/commands/doctor.md", import.meta.url),
		async run({ args }) {
			if (args.length > 0) {
				console.error("usage: arthur doctor");
				return 2;
			}
			const app = loaded();
			const lines = (await (app?.doctor() ?? coreLines())) ?? [];
			for (const line of lines) console.log(line.text);
			if (app === undefined) throw new Error(`${config === undefined ? "" : "the requirements a plugin checks in its setup are not checked: "}arthur.config.ts did not load:\n${problem}`);
			return lines.some((line) => line.critical) ? 1 : 0;
		},
	});
	commands.register("core", {
		name: "setup",
		doc: new URL("../docs/commands/setup.md", import.meta.url),
		run({ args }) {
			if (args.length > 0) {
				console.error("usage: arthur setup");
				return 2;
			}
			return setup(process.env, problem, loaded()?.doctor);
		},
	});
	commands.register("core", {
		name: "run",
		doc: new URL("../docs/commands/run.md", import.meta.url),
		async run({ args }) {
			if (args.length > 0) {
				console.error("usage: arthur run");
				return 2;
			}
			// Printed only: without the load there is no event log to send it to.
			const lines = loaded() === undefined ? await coreLines() : undefined;
			if (lines !== undefined && printAtStart(lines)) return 1;
			const app = need("", (loadedApp) => loadedApp)();
			return runPlugins(app.plugins, app.home, app.follow, app.jobs.sweep, app.doctor, app.emit);
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
