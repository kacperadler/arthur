import type { Board } from "./board.ts";
import type { Command } from "./commands.ts";

// `arthur ticket` (spec/roadmap.md, entries 17 and 18): the one way a human or the coordinator changes the board. `board` throws
// when the config did not load, since the board needs the plugins' project list.

const USAGE = "usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket after <id> [<id>...]; arthur ticket all";

export function ticketCommand(board: () => Board): Command {
	return {
		name: "ticket",
		doc: new URL("../docs/commands/ticket.md", import.meta.url),
		run({ args, project }) {
			const [verb, ...rest] = args;
			if (verb === "new" && rest.length > 0) {
				const ticket = board().create(rest.join(" "), project);
				console.log(`${ticket.id} ${ticket.path}`);
				return 0;
			}
			const [id, status] = rest;
			if (verb === "status" && id !== undefined && status !== undefined && rest.length === 2) {
				const ticket = board().move(id, status);
				console.log(`${ticket.id} ${ticket.status}`);
				return 0;
			}
			if (verb === "after" && id !== undefined) {
				const ticket = board().after(id, rest.slice(1));
				console.log(`${ticket.id} after ${ticket.after?.join(", ") ?? "nothing"}`);
				return 0;
			}
			if (verb === "all" && rest.length === 0) {
				const tickets = board().list(project);
				for (const ticket of tickets) console.log(`${ticket.id} ${ticket.status.padEnd(11)} ${ticket.title}`);
				if (tickets.length === 0) console.log("the board is empty");
				return 0;
			}
			console.error(USAGE);
			return 2;
		},
	};
}
