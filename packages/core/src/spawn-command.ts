import type { Command } from "./commands.ts";
import { amount, type Check, parseFlags, text } from "./flags.ts";
import type { Requires } from "./job-machine.ts";
import type { JobRunner, SpawnRequest } from "./jobs.ts";

// `arthur spawn` (spec/roadmap.md, entries 9, 12, 21 and 31): one job on one task, its id printed. `jobs` throws when the config
// did not load, since the kinds are what the plugins registered.

const USAGE = "usage: arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>] [--timeout <minutes>] [--budget <usd>] [--machine <name>] [--requires <labels>]";
const limit: Check = (value, before) => text(value, before) ?? amount(value, before);
const labels: Check = (value, before) => text(value, before) ?? (typeof requirement(value ?? "") === "string" ? `needs os=<os>,arch=<arch>,tools=<tool>, each label once but tools, got ${value}` : undefined);

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
	const parsed = parseFlags(args, { kind: text, model: text, thinking: text, timeout: limit, budget: limit, machine: text, requires: labels });
	if (typeof parsed === "string") return parsed;
	const { words: tasks, values: { kind, model, thinking, timeout, budget, machine, requires } } = parsed;
	if (tasks.length !== 1) return tasks.length === 0 ? "no task" : `one task, quoted; got ${tasks.length} arguments`;
	const limits = { timeoutMinutes: timeout === undefined ? undefined : Number(timeout), budgetUsd: budget === undefined ? undefined : Number(budget) };
	return { task: tasks[0] ?? "", kind, model, thinking, project, machine, requires: requires === undefined ? undefined : (requirement(requires) as Requires), ...limits };
}

// `os=macos,tools=xcode,tools=docker` as labels: `os` and `arch` at most once, `tools` once per tool; a string when it is not that.
function requirement(value: string): Requires | string {
	const pairs = value.split(",").map((pair) => /^(os|arch|tools)=([^\s=]+)$/.exec(pair));
	const of = (key: string) => pairs.flatMap((pair) => (pair?.[1] === key ? [pair[2] ?? ""] : []));
	if (pairs.includes(null) || of("os").length > 1 || of("arch").length > 1) return value;
	const [[os], [arch], tools] = [of("os"), of("arch"), of("tools")];
	return { ...(os === undefined ? {} : { os }), ...(arch === undefined ? {} : { arch }), ...(tools.length === 0 ? {} : { tools }) };
}
