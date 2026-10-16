import type { Command } from "./commands.ts";
import { amount, parseFlags, text } from "./flags.ts";
import { steerJob, stopJob } from "./job-control.ts";
import { findJob } from "./job-records.ts";
import { STATES } from "./job-state.ts";
import type { JobRunner } from "./jobs.ts";

// `arthur stop`, `continue` and `steer` (spec/roadmap.md, entry 14), `arthur jobs`, `prune` and `stopall` (entry 15), on a
// job's full or short id; `/jobs`, `/steer <id> <text>` and `/stopall` on a channel. `home` and `jobs` throw when the config
// did not load, since the record lives in the configured home folder.

const USAGE = {
	stop: "usage: arthur stop <id>",
	continue: "usage: arthur continue <id> <instruction> [--budget <usd>]",
	steer: "usage: arthur steer <id> <text>",
	jobs: "usage: arthur jobs [--state <state>]",
	prune: "usage: arthur prune [<id>...]",
	stopall: "usage: arthur stopall",
};

export function jobCommands(home: () => string, jobs: () => JobRunner): Command[] {
	const steer = (query: string, text: string) => {
		const id = findJob(home(), query);
		return `${id}: steer ${steerJob(home(), id, text)} queued for after its next tool call`;
	};
	return [
		command("stop", 1, async ([id = ""]) => console.log(await stopJob(home(), findJob(home(), id)))),
		command("steer", 2, ([id = "", text = ""]) => console.log(steer(id, text)), {
			about: "a correction a running job gets after its next tool call: /steer <id> <text>",
			reply: (text) => {
				const [, id, correction = ""] = /^(\S+)\s+(\S[\s\S]*)$/.exec(text.trim()) ?? [];
				return id === undefined ? "usage: /steer <id> <text>" : steer(id, correction);
			},
		}),
		command("continue", 2, async ([query = "", instruction = ""], { budget }) => {
			const id = findJob(home(), query);
			const failed = await jobs().continue(id, instruction, budget === undefined ? undefined : Number(budget));
			if (failed === undefined) return console.log(`${id}: continued`);
			console.error(`${id}: failed: ${failed}`);
			return 1;
		}),
		command("jobs", 0, (_, { state }) => console.log(jobs().list(state)), { about: "every project's jobs by state, one line each, with the short id", reply: () => jobs().list() }),
		command("prune", -1, (ids) => console.log(jobs().prune(ids).join("\n"))),
		command("stopall", 0, async () => console.log(await jobs().stopAll()), { about: "stop every running job of every project", reply: () => jobs().stopAll() }),
	];
}

// `count` arguments (-1: any number), each one word or one quoted text; only `continue` takes `--budget`, only `jobs` `--state`.
type Run = (words: readonly string[], values: Partial<Record<string, string>>) => number | void | Promise<number | void>;
const FLAGS: Partial<Record<keyof typeof USAGE, Parameters<typeof parseFlags>[1]>> = {
	continue: { budget: (value, before) => (before === undefined ? amount(value, before) : "given twice") },
	jobs: { state: (value, before) => text(value, before) ?? (STATES.some((state) => state === value) ? undefined : `needs one of ${STATES.join(", ")}, got ${value}`) },
};
function command(name: keyof typeof USAGE, count: number, run: Run, phone?: Command["phone"]): Command {
	return {
		name,
		doc: new URL(`../docs/commands/${name}.md`, import.meta.url),
		...(phone === undefined ? {} : { phone }),
		async run({ args }) {
			const parsed = parseFlags(args, FLAGS[name] ?? {});
			if (typeof parsed === "string") return usage(name, parsed);
			const { words, values } = parsed;
			if (count >= 0 && words.length !== count) return usage(name, `expected ${["no arguments", "the id", "the id and one quoted text"][count]}, got ${words.length} arguments`);
			return run(words, values);
		},
	};
}

function usage(name: keyof typeof USAGE, problem: string): number {
	console.error(`arthur ${name}: ${problem}\n${USAGE[name]}`);
	return 2;
}
