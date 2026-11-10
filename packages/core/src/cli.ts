#!/usr/bin/env node
import type { CommandRegistry } from "./commands.ts";
import { type LoadedConfig, loadConfig } from "./config.ts";
import { coreCommands, type Loaded, printDoc, unknown, usage } from "./core-commands.ts";
import { parseFlags } from "./flags.ts";
import { type LoadedPlugins, loadPlugins } from "./host.ts";
import { insideJob } from "./inside-job.ts";
import { printNames } from "./secret-names.ts";

// The `arthur` binary (spec/roadmap.md, entry 6): `arthur <command> [args]` runs a command the core or a plugin registered, on
// `arthur.config.ts` in the working folder. The core's own commands run even when the config or a plugin does not load.
// Under umask 077 whatever umask started it (AR0517): all it and its jobs write is its user's alone, worktrees included.
process.umask(0o077);
process.exitCode = await main(process.argv.slice(2));

async function main(argv: readonly string[]): Promise<number> {
	// `arthur eval` (develop, entry 67) sets ARTHUR_EVAL in its agent's session, where `arthur` is its recording stub: the real
	// one, reached by its path, acts on nothing there.
	if ((process.env.ARTHUR_EVAL ?? "") !== "") {
		console.error(`arthur: refused inside an eval session (ARTHUR_EVAL is set): arthur there is the eval's recording stub, ${process.env.ARTHUR_EVAL}`);
		return 1;
	}
	const parsed = parseFlags(argv, { project: (value, before) => (value === undefined || value.startsWith("-") ? "needs a project name" : before === undefined ? undefined : `given twice: ${before}, ${value}`) }, true);
	if (typeof parsed === "string") return usage(parsed);
	const { words: rest, values: { project } } = parsed;
	const [name = "help", ...args] = rest[0] === "--help" ? [] : rest;
	const { commands, problem, project: known, home, append } = await load();
	const command = commands.find(name);
	if (command === undefined) return unknown(name, commands, problem);
	if (args.includes("--help")) return printDoc(command, args[0]);
	// Inside a job (inside-job.ts, AR0354) only a command that declares `inJob` runs (AR0353); the plugins' commands are known
	// only once they loaded, which every command a job may run loads too.
	const job = insideJob(home);
	if (job !== undefined && command.inJob !== true) {
		console.error(`arthur ${name}: refused inside a job ${job}: a job runs only the commands its role needs; put what the coordinator should do in your final message`);
		return 1;
	}
	let code = 1;
	try {
		// No command runs for a project Arthur does not know; without a load the commands that read the list refuse anyway.
		if (project !== undefined) known?.(project);
		code = (await command.run({ args, project })) ?? 0;
	} catch (error) {
		console.error(`arthur ${name}: ${error instanceof Error ? error.message : String(error)}`);
	}
	// Who ran what (entry 99), logged for `arthur run` to deliver: after its own stop, the next one, as the events other processes
	// append then. Never inside a job, whose sandbox keeps it from the log; without a load there is no log. A log it cannot write
	// (a read-only home) costs that line, said, not the command's own code.
	try {
		if (job === undefined) append?.("command-ran", { command: name, args, ...(project === undefined ? {} : { project }), code });
	} catch (error) {
		console.error(`arthur ${name}: command-ran not logged: ${error instanceof Error ? error.message : String(error)}`);
	}
	return code;
}

// Every command, the core's and the plugins'; when the config or a plugin does not load, the core's alone and the reason.
async function load(): Promise<{ readonly commands: CommandRegistry; readonly problem?: string; readonly project?: LoadedPlugins["project"]; readonly home?: string; readonly append?: LoadedPlugins["append"] }> {
	let loaded: Loaded | undefined;
	let read: LoadedConfig | undefined;
	const commands = coreCommands(undefined, () => loaded);
	try {
		const config = await loadConfig("arthur.config.ts");
		read = config;
		const { plugins, jobs, board, follow, project, autopilot, owner, doctor: checks, emit, append, channels, hide } = await loadPlugins(config, process.env, commands, insideJob(config.core.home));
		loaded = { plugins, home: config.core.home, follow, jobs, board, autopilot, owner, doctor: checks, emit, channels };
		printNames(hide);
		return { commands, project, home: config.core.home, append };
	} catch (error) {
		const problem = error instanceof Error ? error.message : String(error);
		return { commands: coreCommands(problem, () => undefined, read), problem, home: read?.core.home };
	}
}
