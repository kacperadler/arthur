import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command, Host } from "@arthur/core/plugin";

// `/findings <id>`, also `arthur findings <id>` (moved from orchestration, spec/roadmap.md, entries 18 and 83): a ticket's
// `findings.md`, from its worker's branch before the merge. docs/commands/findings.md.

const USAGE = "<id>";

export function findingsCommand(host: Host): Command {
	return {
		name: "findings",
		doc: new URL("../docs/commands/findings.md", import.meta.url),
		phone: { about: "a ticket's findings.md: /findings 14, /findings AR14", reply: (text) => reply(host, text.split(/\s+/).filter(Boolean), undefined) ?? `usage: /findings ${USAGE}` },
		run({ args, project }) {
			const answer = reply(host, args, project);
			if (answer === undefined) {
				console.error(`usage: arthur findings ${USAGE}`);
				return 2;
			}
			console.log(answer);
		},
	};
}

// Undefined: the words are wrong usage.
function reply({ board, jobs }: Host, words: readonly string[], project: string | undefined): string | undefined {
	const [, letters = "", digits] = /^([a-z]*)(\d+)$/i.exec(words.length === 1 ? (words[0] ?? "") : "") ?? [];
	if (digits === undefined) return undefined;
	const projects = board.projects();
	const where = letters !== "" ? projects.find((each) => each.prefix === letters.toUpperCase()) : projects.find((each) => project === undefined || each.name === project);
	if (where === undefined && letters !== "") throw new Error(`unknown prefix ${letters.toUpperCase()}; prefixes: ${projects.map((each) => each.prefix).join(", ")}`);
	if (where === undefined) throw new Error(`unknown project ${project}; projects: ${projects.map((each) => each.name).join(", ")}`);
	const id = `${where.prefix}${digits.padStart(4, "0")}`;
	const ticket = board.get(id);
	if (ticket === undefined) throw new Error(`${id}: not on the board of project ${where.name}`);
	const path = `${dirname(ticket.path)}/findings.md`;
	let text: string | undefined;
	try {
		text = readFileSync(join(where.path, path), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`${id}: cannot read ${path}: ${(error as Error).message}`);
	}
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
