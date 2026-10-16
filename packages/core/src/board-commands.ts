import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Board, Project } from "./board.ts";
import { boardText } from "./board-text.ts";
import type { Command } from "./commands.ts";

// The board's phone commands (spec/roadmap.md, entry 18): `/board [PREFIX] [all]`, `/task <id>` and `/findings <id>`, answered
// from the board's files without the model. Each also runs as `arthur <name>`, which prints the reply and reads a number alone
// in `--project`. An id is `14` (the main project's), `AR14` or `AR0014`, in either case; its prefix picks the project.

// Telegram's limit for one message: a full board longer than that is sent as its digest, so no ticket is lost to a cut.
const MESSAGE = 4096;

// The spawn's `Ticket: <path>` (jobs.ts), the path maybe in backticks; punctuation that ends the sentence is not part of it.
const TICKET = /\bTicket:\s*`?([^\s`]+)/g;

// Undefined: the words are wrong usage.
type Reply = (board: Board, words: readonly string[], project: string | undefined) => string | undefined;

// `home`: the folder of the job records, `<home>/jobs/<id>/`; undefined: no jobs are known.
export function boardCommands(board: () => Board, home: () => string | undefined): Command[] {
	return [
		command(board, "board", "[PREFIX] [all]", "the board, or its digest when it does not fit one message; all: every ticket", boardReply),
		command(board, "task", "<id>", "a ticket's status and its ticket.md: /task 14, /task AR14", (at, words, project) => fileReply(at, words, project, "ticket.md", undefined)),
		command(board, "findings", "<id>", "a ticket's findings.md: /findings 14, /findings AR14", (at, words, project) => fileReply(at, words, project, "findings.md", home())),
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

// `/task` prefixes the ticket's status. `/findings` answers with the `findings.md` a job of the ticket changed on its branch,
// headed so, when it is not main's; otherwise main's, and of a ticket without the file, or with an empty one, says so.
function fileReply(board: Board, words: readonly string[], project: string | undefined, file: "ticket.md" | "findings.md", home: string | undefined): string | undefined {
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
	const branch = home === undefined ? undefined : branchFindings(home, where, ticket.path, path, text);
	if (branch !== undefined) return `findings from branch ${branch.name} (not merged)\n${branch.text}`;
	if (text === undefined) return `${id}: no findings (${path} does not exist)`;
	return text.trim() === "" ? `${id}: no findings (${path} is empty)` : text;
}

// The jobs of the ticket are the records (spec/roadmap.md, entry 9) of the project whose `task` names `ticketPath` on a
// `Ticket:` line and that have a branch. Of those branches still there, newest last commit first, the first whose commits
// since it left HEAD changed `findings.md` (so not a merged one) to a text not blank and not `main`, main's text.
function branchFindings(home: string, where: Project, ticketPath: string, path: string, main: string | undefined): { readonly name: string; readonly text: string } | undefined {
	const branches = jobBranches(home, where.name, ticketPath);
	if (branches.length === 0) return undefined;
	const git = (...args: readonly string[]) => spawnSync("git", ["-C", where.path, ...args], { encoding: "utf8" });
	const refs = git("for-each-ref", "--sort=-committerdate", "--format=%(refname:lstrip=2)", ...branches.map((name) => `refs/heads/${name}`));
	if (refs.status !== 0) throw new Error(`git for-each-ref: ${refs.error?.message ?? refs.stderr.trim()}`);
	// A pattern also lists the refs under it, and a read-only job's empty branch every branch: only the records' own count.
	for (const name of refs.stdout.split("\n").filter((each) => branches.includes(each))) {
		if (git("diff", "--quiet", `HEAD...refs/heads/${name}`, "--", path).status !== 1) continue;
		const show = git("cat-file", "blob", `refs/heads/${name}:${path}`);
		if (show.status === 0 && show.stdout !== main && show.stdout.trim() !== "") return { name, text: show.stdout };
	}
	return undefined;
}

// A record being written (`.<id>`), or one missing a key, is skipped.
function jobBranches(home: string, project: string, ticketPath: string): string[] {
	const folder = join(home, "jobs");
	if (!existsSync(folder)) return [];
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const keys = ["task", "branch", "project"].map((key) => join(folder, entry.name, key));
		if (!entry.isDirectory() || entry.name.startsWith(".") || !keys.every((key) => existsSync(key))) return [];
		const [task = "", branch = "", owner] = keys.map((key) => readFileSync(key, "utf8"));
		if (owner !== project) return [];
		const tickets = Array.from(task.matchAll(TICKET), (match) => (match[1] ?? "").replace(/[.,;:!?)]+$/, ""));
		return tickets.includes(ticketPath) ? [branch] : [];
	});
}

function byPrefix(board: Board, prefix: string): Project {
	const projects = board.projects();
	const found = projects.find((each) => each.prefix === prefix);
	if (found === undefined) throw new Error(`unknown prefix ${prefix}; prefixes: ${projects.map((each) => each.prefix).join(", ")}`);
	return found;
}
