import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Board, Project } from "./board.ts";
import { boardText } from "./board-text.ts";
import type { Command } from "./commands.ts";

// The board's phone commands (spec/roadmap.md, entry 18): `/board [PREFIX] [all]`, `/task <id>` and `/findings <id>`, answered
// from the board's files without the model. Each also runs as `arthur <name>`, which prints the reply and reads a number alone
// in `--project`. An id is `14` (the main project's), `AR14` or `AR0014`, in either case; its prefix picks the project.

// Telegram's limit for one message: a full board longer than that is sent as its digest, so no ticket is lost to a cut.
const MESSAGE = 4096;

// Undefined: the words are wrong usage.
type Reply = (board: Board, words: readonly string[], project: string | undefined) => string | undefined;

export function boardCommands(board: () => Board): Command[] {
	return [
		command(board, "board", "[PREFIX] [all]", "the board, or its digest when it does not fit one message; all: every ticket", boardReply),
		command(board, "task", "<id>", "a ticket's status and its ticket.md: /task 14, /task AR14", (at, words, project) => fileReply(at, words, project, "ticket.md")),
		command(board, "findings", "<id>", "a ticket's findings.md: /findings 14, /findings AR14", (at, words, project) => fileReply(at, words, project, "findings.md")),
	];
}

function command(board: () => Board, name: string, usage: string, about: string, reply: Reply): Command {
	return {
		name,
		doc: new URL(`../docs/commands/${name}.md`, import.meta.url),
		phone: { about, reply: (text) => reply(board(), text.split(/\s+/).filter(Boolean), undefined) ?? `usage: /${name} ${usage}` },
		run({ args, project }) {
			const answer = reply(board(), args, project);
			if (answer === undefined) {
				console.error(`usage: arthur ${name} ${usage}`);
				return 2;
			}
			console.log(answer);
		},
	};
}

const boardReply: Reply = (board, words, project) => {
	const all = words.at(-1)?.toLowerCase() === "all";
	const rest = all ? words.slice(0, -1) : words;
	if (rest.length > 1 || (rest[0] !== undefined && !/^[a-z]+$/i.test(rest[0]))) return undefined;
	const tickets = board.list(rest[0] === undefined ? project : byPrefix(board, rest[0].toUpperCase()).name);
	const full = boardText(tickets, true);
	return all || full.length <= MESSAGE ? full : boardText(tickets, false);
};

// `/task` prefixes the ticket's status; `/findings` of a ticket without the file, or with an empty one, says so.
function fileReply(board: Board, words: readonly string[], project: string | undefined, file: "ticket.md" | "findings.md"): string | undefined {
	const [, letters = "", digits] = /^([a-z]*)(\d+)$/i.exec(words.length === 1 ? (words[0] ?? "") : "") ?? [];
	if (digits === undefined) return undefined;
	const projects = board.projects();
	const where = letters !== "" ? byPrefix(board, letters.toUpperCase()) : projects.find((each) => project === undefined || each.name === project);
	if (where === undefined) throw new Error(`unknown project ${project}; projects: ${projects.map((each) => each.name).join(", ")}`);
	const id = `${where.prefix}${digits.padStart(4, "0")}`;
	const ticket = board.get(id);
	if (ticket === undefined) throw new Error(`${id}: not on the board of project ${where.name}`);
	const path = `${dirname(ticket.path)}/${file}`;
	let text: string;
	try {
		text = readFileSync(join(where.path, path), "utf8");
	} catch (error) {
		if (file === "findings.md" && (error as NodeJS.ErrnoException).code === "ENOENT") return `${id}: no findings (${path} does not exist)`;
		throw new Error(`${id}: cannot read ${path}: ${(error as Error).message}`);
	}
	if (file === "ticket.md") return `${id} ${ticket.status}\n${text}`;
	return text.trim() === "" ? `${id}: no findings (${path} is empty)` : text;
}

function byPrefix(board: Board, prefix: string): Project {
	const projects = board.projects();
	const found = projects.find((each) => each.prefix === prefix);
	if (found === undefined) throw new Error(`unknown prefix ${prefix}; prefixes: ${projects.map((each) => each.prefix).join(", ")}`);
	return found;
}
