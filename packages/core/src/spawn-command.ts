import type { Command } from "./commands.ts";
import { amount, type Check, parseFlags, text } from "./flags.ts";
import type { JobRunner, SpawnRequest } from "./jobs.ts";

// `arthur spawn` (spec/roadmap.md, entries 9, 12 and 21): one job on one task, its id printed. `jobs` throws when the config did
// not load, since the kinds are what the plugins registered.

const USAGE = "usage: arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>] [--timeout <minutes>] [--budget <usd>] [--machine <name>]";
const limit: Check = (value, before) => text(value, before) ?? amount(value, before);

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
			if (job.failed === undefined) return;
			console.error(`failed: ${job.failed}`);
			return 1;
		},
	};
}

// One task and the flags, or what is wrong with them.
function spawnRequest(args: readonly string[], project: string | undefined): SpawnRequest | string {
	const parsed = parseFlags(args, { kind: text, model: text, thinking: text, timeout: limit, budget: limit, machine: text });
	if (typeof parsed === "string") return parsed;
	const { words: tasks, values: { kind, model, thinking, timeout, budget, machine } } = parsed;
	if (tasks.length !== 1) return tasks.length === 0 ? "no task" : `one task, quoted; got ${tasks.length} arguments`;
	const limits = { timeoutMinutes: timeout === undefined ? undefined : Number(timeout), budgetUsd: budget === undefined ? undefined : Number(budget) };
	return { task: tasks[0] ?? "", kind, model, thinking, project, machine, ...limits };
}
