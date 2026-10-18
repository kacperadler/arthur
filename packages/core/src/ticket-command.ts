import type { Board } from "./board.ts";
import type { Command } from "./commands.ts";
import { amount, parseFlags, text } from "./flags.ts";
import type { AutopilotRequest } from "./host.ts";
import type { JobRunner } from "./jobs.ts";

// `arthur ticket` (spec/roadmap.md, entries 17, 18, 28 and 29): the one way a human or the coordinator changes the board, and files
// a job's result in its ticket's folder. `board` and `jobs` throw when the config did not load, since the board needs the plugins'
// project list and a filing the kinds they registered; `autopilot` asks the plugin that pre-approves a ticket (`ticket.autopilot`).

const USAGE =
	"usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket status <id> planned --autopilot [--budget <usd>]; arthur ticket after <id> [<id>...]; arthur ticket file <id> <job>";

export function ticketCommand(board: () => Board, jobs: () => JobRunner, autopilot: () => (request: AutopilotRequest) => unknown): Command {
	return {
		name: "ticket",
		doc: new URL("../docs/commands/ticket.md", import.meta.url),
		async run({ args, project }) {
			const [verb, ...rest] = args;
			// An empty word is wrong usage in every verb, before the board is read.
			if (rest.includes("")) {
				console.error(USAGE);
				return 2;
			}
			if (verb === "new" && rest.length > 0) {
				const ticket = board().create(rest.join(" "), project);
				console.log(`${ticket.id} ${ticket.path}`);
				return 0;
			}
			if (verb === "status" && rest.includes("--autopilot")) {
				const flags = parseFlags(rest.filter((word) => word !== "--autopilot"), { budget: (value, before) => text(value, before) ?? amount(value, before) });
				if (typeof flags === "string" || flags.words.length !== 2 || flags.words[1] !== "planned") {
					console.error(`arthur ticket: ${typeof flags === "string" ? flags : "--autopilot sets one ticket planned"}\n${USAGE}`);
					return 2;
				}
				const { budget } = flags.values;
				// The plugin checks the policy, records it in the ticket and moves it; a refusal throws, naming each rule broken.
				console.log(await autopilot()({ id: flags.words[0] ?? "", ...(budget === undefined ? {} : { budgetUsd: Number(budget) }) }));
				return 0;
			}
			const [id, second] = rest;
			if (verb === "status" && id !== undefined && second !== undefined && rest.length === 2) {
				const ticket = board().move(id, second);
				console.log(`${ticket.id} ${ticket.status}`);
				return 0;
			}
			if (verb === "after" && id !== undefined) {
				const ticket = board().after(id, rest.slice(1));
				console.log(`${ticket.id} after ${ticket.after?.join(", ") ?? "nothing"}`);
				return 0;
			}
			if (verb === "file" && id !== undefined && second !== undefined && rest.length === 2) {
				console.log(jobs().file(board(), id, second));
				return 0;
			}
			console.error(USAGE);
			return 2;
		},
	};
}
