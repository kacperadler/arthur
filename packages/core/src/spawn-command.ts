import type { Command } from "./commands.ts";
import type { JobRunner, SpawnRequest } from "./jobs.ts";

// `arthur spawn` (spec/roadmap.md, entries 9 and 12): one job on one task, its id printed. `jobs` throws when the config did
// not load, since the kinds are what the plugins registered.

const USAGE = "usage: arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>] [--timeout <minutes>] [--budget <usd>]";
const FLAGS = ["kind", "model", "thinking", "timeout", "budget"];
// A plain decimal: no sign, exponent, hex or `Infinity`, which `Number` would take.
const AMOUNT = /^\d+(\.\d+)?$/;

export function spawnCommand(jobs: () => JobRunner): Command {
	return {
		name: "spawn",
		doc: new URL("../docs/commands/spawn.md", import.meta.url),
		async run({ args, project }) {
			const request = spawnRequest(args, project);
			if (typeof request === "string") {
				console.error(`arthur spawn: ${request}\n${USAGE}`);
				return 2;
			}
			const job = await jobs().spawn(request);
			for (const warning of job.warnings) console.error(`warning: ${warning}`);
			console.log(job.id);
		},
	};
}

// One task and the flags, or what is wrong with them.
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
		if (!FLAGS.includes(name)) return `unknown flag ${arg}`;
		if (value === undefined || value === "" || value.startsWith("--")) return `${arg} needs a value`;
		if (name in flags) return `${arg} given twice`;
		if ((name === "timeout" || name === "budget") && !AMOUNT.test(value)) return `${arg} needs a number of 0 or more, got ${value}`;
		flags[name] = value;
	}
	if (tasks.length !== 1) return tasks.length === 0 ? "no task" : `one task, quoted; got ${tasks.length} arguments`;
	const { kind, model, thinking, timeout, budget } = flags;
	const limits = { timeoutMinutes: timeout === undefined ? undefined : Number(timeout), budgetUsd: budget === undefined ? undefined : Number(budget) };
	return { task: tasks[0] ?? "", kind, model, thinking, project, ...limits };
}
