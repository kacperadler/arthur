import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type Command, type CommandRegistry, commandRegistry, groupPage } from "./commands.ts";
import { configCheck } from "./config-check.ts";
import type { LoadedConfig } from "./config.ts";
import { type DoctorLine, doctor, ownAnswers, printAtStart } from "./doctor.ts";
import type { LoadedPlugins } from "./host.ts";
import { jobCommands } from "./job-commands.ts";
import { arthurVersion } from "./job-machine.ts";
import { remoteJobCommand } from "./remote-job.ts";
import { rolesCommand } from "./roles-command.ts";
import { sendCommand } from "./send-command.ts";
import { spawnCommand } from "./spawn-command.ts";
import { ticketCommand } from "./ticket-command.ts";
import { coreRequirements } from "./requirements.ts";
import { runPlugins } from "./run.ts";
import { setup } from "./setup.ts";

// The core's own commands (cli.ts), which run even when the config or a plugin does not load.

export const USAGE = "usage: arthur <command> [args] [--project <name>]; arthur <command> --help; arthur help <command>";

// What `arthur run` starts: the plugins as loaded, in setup order, the home folder and how to follow the event log; `jobs` is
// what `arthur spawn` uses, `board`, the core's, and `autopilot` what `arthur ticket` uses; `channels` what `arthur send` uses.
export type Loaded = Pick<LoadedPlugins, "plugins" | "follow" | "jobs" | "board" | "autopilot" | "doctor" | "emit" | "channels"> & { readonly home: string };

// `problem`: why the plugins' commands are missing, said with every list of the commands; `loaded` once the plugins are set up;
// `config` when it loaded and a plugin did not, for the core's own requirements and each plugin's own `doctor`.
export function coreCommands(problem: string | undefined, loaded: () => Loaded | undefined, config?: LoadedConfig): CommandRegistry {
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
	for (const command of jobCommands(need("the job records are in the configured home folder, and ", (app) => app.home), jobs, need("", (app) => app.emit))) commands.register("core", command);
	commands.register("core", remoteJobCommand());
	commands.register("core", { name: "version", doc: new URL("../docs/commands/version.md", import.meta.url), inJob: true, run: () => console.log(arthurVersion()) });
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
	const coreLines = (): Promise<DoctorLine[]> | undefined => config && doctor(coreRequirements(config.core, () => [dirname(config.path)]), ownAnswers(config.plugins, config.core));
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
			// A stop cut short (run.ts) may leave a socket or a timer holding the process: a second after the stops it ends anyway.
			const exit = () => void setTimeout(() => process.exit(), 1000).unref();
			return runPlugins(app.plugins, app.home, app.follow, app.jobs.sweep, app.doctor, app.emit).finally(exit);
		},
	});
	commands.register("core", {
		name: "help",
		doc: new URL("../docs/commands/help.md", import.meta.url),
		inJob: true,
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

export function usage(problem: string): number {
	console.error(`arthur: ${problem}\n${USAGE}`);
	return 2;
}

export function unknown(name: string, commands: CommandRegistry, problem: string | undefined): number {
	console.error(`arthur: unknown command ${name}\ncommands: ${commands.names().join(", ")}`);
	if (problem !== undefined) console.error(notLoaded(problem));
	return 2;
}

function notLoaded(problem: string): string { return `only the core's commands are listed: arthur.config.ts did not load:\n${problem}`; }

// The doc file existed when the command was registered; it may have been deleted since. `word`, the first after the command, may name a group's page.
export function printDoc(command: Command, word?: string): number {
	if (!existsSync(command.doc)) {
		console.error(`arthur ${command.name}: its doc file ${fileURLToPath(command.doc)} was deleted after Arthur loaded`);
		return 1;
	}
	process.stdout.write(readFileSync(groupPage(command.doc, word), "utf8"));
	return 0;
}
