import type { Board } from "./board.ts";
import type { Command } from "./commands.ts";
import type { JobRunner } from "./jobs.ts";

// `arthur ticket` (spec/roadmap.md, entries 17, 18 and 28): the one way a human or the coordinator changes the board, and files a
// job's result in its ticket's folder. `board` and `jobs` throw when the config did not load, since the board needs the plugins'
// project list and a filing the kinds they registered.

const USAGE = "usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket after <id> [<id>...]; arthur ticket file <id> <job>";

export function ticketCommand(board: () => Board, jobs: () => JobRunner): Command {
	return {
		name: "ticket",
		doc: new URL("../docs/commands/ticket.md", import.meta.url),
		run({ args, project }) {
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
