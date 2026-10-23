import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command, Host } from "@arthur/core/plugin";

// `/board`, `/task` and `/plan`, also as `arthur <name>`: docs/commands/board.md, task.md and plan.md.

type Board = Host["board"];

// Telegram's limit for one message: a full board longer than that is sent as its digest, so no ticket is lost to a cut; a
// blocked job's question longer than that is cut (blocked-notice.ts).
export const MESSAGE = 4096;

// Undefined: the words are wrong usage.
type Reply = (words: readonly string[], project: string | undefined) => string | undefined;

export function boardCommands(host: Host): Command[] {
	const { board } = host;
	return [
		command("board", "[PREFIX] [all]", "the board, or its digest when it does not fit one message; all: every ticket", (words, project) => boardReply(board, words, project)),
		command("task", "<id>", "a ticket's status and its ticket.md: /task 14, /task AR14", (words, project) => fileReply(board, words, project, "ticket.md")),
		command("plan", "<id>", "a ticket's status and its plan.md: /plan 14, /plan AR14", (words, project) => fileReply(board, words, project, "plan.md")),
	];
}

function command(name: string, usage: string, about: string, reply: Reply): Command {
	return {
		name,
		doc: new URL(`../docs/commands/${name}.md`, import.meta.url),
		inJob: true,
		phone: { about, reply: (text) => reply(text.split(/\s+/).filter(Boolean), undefined) ?? `usage: /${name} ${usage}` },
		run({ args, project }) {
			const answer = reply(args, project);
			if (answer === undefined) {
				console.error(`usage: arthur ${name} ${usage}`);
				return 2;
			}
			console.log(answer);
		},
	};
}

function boardReply(board: Board, words: readonly string[], project: string | undefined): string | undefined {
	const all = words.at(-1)?.toLowerCase() === "all";
	const rest = all ? words.slice(0, -1) : words;
	if (rest.length > 1 || (rest[0] !== undefined && !/^[a-z]+$/i.test(rest[0]))) return undefined;
	const name = rest[0] === undefined ? project : byPrefix(board, rest[0].toUpperCase()).name;
	const full = board.full(name);
	return all || full.length <= MESSAGE ? full : board.digest(name);
}

function fileReply(board: Board, words: readonly string[], project: string | undefined, file: "ticket.md" | "plan.md"): string | undefined {
	const [, letters = "", digits] = /^([a-z]*)(\d+)$/i.exec(words.length === 1 ? (words[0] ?? "") : "") ?? [];
	if (digits === undefined) return undefined;
	const projects = board.projects();
	const where = letters !== "" ? byPrefix(board, letters.toUpperCase()) : projects.find((each) => project === undefined || each.name === project);
	if (where === undefined) throw new Error(`unknown project ${project}; projects: ${projects.map((each) => each.name).join(", ")}`);
	const id = `${where.prefix}${digits.padStart(4, "0")}`;
	const ticket = board.get(id);
	if (ticket === undefined) throw new Error(`${id}: not on the board of project ${where.name}`);
	const path = `${dirname(ticket.path)}/${file}`;
	let text: string | undefined;
	try {
		text = readFileSync(join(where.path, path), "utf8");
	} catch (error) {
		if (file === "ticket.md" || (error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`${id}: cannot read ${path}: ${(error as Error).message}`);
	}
	if (file === "ticket.md") return `${id} ${ticket.status}\n${text}`;
	return text === undefined ? `${id}: no plan (${path} does not exist)` : `${id} ${ticket.status}\n${text}`;
}

function byPrefix(board: Board, prefix: string) {
	const projects = board.projects();
	const found = projects.find((each) => each.prefix === prefix);
	if (found === undefined) throw new Error(`unknown prefix ${prefix}; prefixes: ${projects.map((each) => each.prefix).join(", ")}`);
	return found;
}
