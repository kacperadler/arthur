import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// `/board`, `/task` and `/findings`, also as `arthur <name>`: docs/commands/board.md, task.md and findings.md.

type Board = Host["board"];
type Command = Parameters<Host["commands"]["register"]>[0];

// Telegram's limit for one message: a full board longer than that is sent as its digest, so no ticket is lost to a cut.
const MESSAGE = 4096;

// Undefined: the words are wrong usage.
type Reply = (words: readonly string[], project: string | undefined) => string | undefined;

export function boardCommands(host: Host): Command[] {
	const { board, jobs } = host;
	return [
		command("board", "[PREFIX] [all]", "the board, or its digest when it does not fit one message; all: every ticket", (words, project) => boardReply(board, words, project)),
		command("task", "<id>", "a ticket's status and its ticket.md: /task 14, /task AR14", (words, project) => fileReply(board, words, project, "ticket.md", jobs)),
		command("findings", "<id>", "a ticket's findings.md: /findings 14, /findings AR14", (words, project) => fileReply(board, words, project, "findings.md", jobs)),
	];
}

function command(name: string, usage: string, about: string, reply: Reply): Command {
	return {
		name,
		doc: new URL(`../docs/commands/${name}.md`, import.meta.url),
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

function fileReply(board: Board, words: readonly string[], project: string | undefined, file: "ticket.md" | "findings.md", jobs: Host["jobs"]): string | undefined {
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
	const branch = branchFindings(jobs, where.name, where.path, ticket.path, path, text);
	if (branch !== undefined) return `findings from branch ${branch.name} (not merged)\n${branch.text}`;
	if (text === undefined) return `${id}: no findings (${path} does not exist)`;
	return text.trim() === "" ? `${id}: no findings (${path} is empty)` : text;
}

// The first branch of the ticket's jobs whose own commits changed `findings.md` to a text of its own: docs/commands/findings.md.
function branchFindings(jobs: Host["jobs"], project: string, root: string, ticketPath: string, path: string, main: string | undefined): { readonly name: string; readonly text: string } | undefined {
	const branches = jobs.list().flatMap((job) => (job.project === project && job.branch !== "" && job.tickets.includes(ticketPath) ? [job.branch] : []));
	if (branches.length === 0) return undefined;
	const git = (...args: readonly string[]) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
	const refs = git("for-each-ref", "--sort=-committerdate", "--format=%(refname:lstrip=2)", ...branches.map((name) => `refs/heads/${name}`));
	if (refs.status !== 0) throw new Error(`git for-each-ref: ${refs.error?.message ?? refs.stderr.trim()}`);
	// A pattern also lists the refs under it: only the records' own count.
	for (const name of refs.stdout.split("\n").filter((each) => branches.includes(each))) {
		if (git("diff", "--quiet", `HEAD...refs/heads/${name}`, "--", path).status !== 1) continue;
		const show = git("cat-file", "blob", `refs/heads/${name}:${path}`);
		if (show.status === 0 && show.stdout !== main && show.stdout.trim() !== "") return { name, text: show.stdout };
	}
	return undefined;
}

function byPrefix(board: Board, prefix: string) {
	const projects = board.projects();
	const found = projects.find((each) => each.prefix === prefix);
	if (found === undefined) throw new Error(`unknown prefix ${prefix}; prefixes: ${projects.map((each) => each.prefix).join(", ")}`);
	return found;
}
