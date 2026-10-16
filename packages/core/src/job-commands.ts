import type { Command } from "./commands.ts";
import { steerJob, stopJob } from "./job-control.ts";
import type { JobRunner } from "./jobs.ts";

// `arthur stop`, `arthur continue` and `arthur steer` (spec/roadmap.md, entry 14), on a job's full id. `home` and `jobs` throw
// when the config did not load, since the record lives in the configured home folder.

const USAGE = {
	stop: "usage: arthur stop <id>",
	continue: "usage: arthur continue <id> <instruction> [--budget <usd>]",
	steer: "usage: arthur steer <id> <text>",
};
// A plain decimal, as `arthur spawn --budget` takes it.
const AMOUNT = /^\d+(\.\d+)?$/;

export function jobCommands(home: () => string, jobs: () => JobRunner): Command[] {
	return [
		command("stop", 1, async ([id = ""]) => console.log(await stopJob(home(), id))),
		command("steer", 2, ([id = "", text = ""]) => console.log(`${id}: steer ${steerJob(home(), id, text)} queued for after its next tool call`)),
		command("continue", 2, async ([id = "", instruction = ""], budget) => {
			await jobs().continue(id, instruction, budget === undefined ? undefined : Number(budget));
			console.log(`${id}: continued`);
		}),
	];
}

// `count` arguments, each one word or one quoted text; only `continue` takes `--budget`.
function command(name: keyof typeof USAGE, count: number, run: (words: readonly string[], budget: string | undefined) => void | Promise<void>): Command {
	return {
		name,
		doc: new URL(`../docs/commands/${name}.md`, import.meta.url),
		async run({ args }) {
			const words: string[] = [];
			let budget: string | undefined;
			for (let index = 0; index < args.length; index++) {
				const arg = args[index] ?? "";
				if (!arg.startsWith("--")) words.push(arg);
				else if (arg !== "--budget" || name !== "continue") return usage(name, `unknown flag ${arg}`);
				else if (budget !== undefined) return usage(name, "--budget given twice");
				else if (!AMOUNT.test((budget = args[++index] ?? ""))) return usage(name, `--budget needs a number of 0 or more, got ${budget || "nothing"}`);
			}
			if (words.length !== count) return usage(name, `expected ${count === 1 ? "the id" : "the id and one quoted text"}, got ${words.length} arguments`);
			await run(words, budget);
		},
	};
}

function usage(name: keyof typeof USAGE, problem: string): number {
	console.error(`arthur ${name}: ${problem}\n${USAGE[name]}`);
	return 2;
}
