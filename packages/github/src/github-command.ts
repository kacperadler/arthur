import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { insideJob } from "@arthur/core/inside-job";
import type { Command, Host } from "@arthur/core/plugin";
import type { Instance, Repository } from "./github-api.ts";
import { branch } from "./github-branch.ts";
import { git } from "./github-git.ts";
import { issue } from "./github-issue.ts";
import { pr } from "./github-pr.ts";

// `arthur github pr|issue|branch ...` (AR0556's plan; AR0557 the command and the pull request reads; AR0558 the pull request writes; AR0559 the issues; AR0555 `branch sweep`; AR0560 `branch list|delete`):
// a project's pull requests and issues on GitHub, asked with the token of the instance its repository's owner names, and its branches
// on origin, asked with git's own credentials. A read runs inside a job too; a write is refused there before any request.
// Text people wrote on GitHub is printed only after `> `, as data. docs/commands/github.md, and a page per group: github-pr.md,
// github-issue.md, github-branch.md.

export type Entry = { readonly name: string; readonly path: string; readonly pieces?: { readonly github?: CiPiece } };
// A project's piece: the workflow whose runs build its branches.
export type CiPiece = { readonly workflow: string };

const USAGE =
	"usage: arthur github pr list [--all]|get <n>|create <branch> <file> [--base <branch>]|comment <n> <file>|close <n>|merge <n> | issue list [--all]|get <n>|create <file>|comment <n> <file>|label <n> <label>|close <n> | branch list|delete <branch> [--unmerged]|sweep [--dry-run] [--project <name>]";
// The words each verb of a group takes after it, and the flags it takes.
const VERBS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
	pr: { list: [], get: ["n"], create: ["branch", "file"], comment: ["n", "file"], close: ["n"], merge: ["n"] },
	issue: { list: [], get: ["n"], create: ["file"], comment: ["n", "file"], label: ["n", "label"], close: ["n"] },
	branch: { list: [], delete: ["branch"], sweep: [] },
};
const FLAGS: Readonly<Record<string, readonly string[]>> = { "pr list": ["--all"], "pr create": ["--base"], "issue list": ["--all"], "branch delete": ["--unmerged"], "branch sweep": ["--dry-run"] };
// The verbs that only read; a job runs only these.
const READS = ["list", "get"];

export function githubCommand(host: Host, list: readonly Entry[], accounts: readonly Instance[]): Command {
	return {
		name: "github",
		doc: new URL("../docs/commands/github.md", import.meta.url),
		inJob: true,
		async run({ args, project }) {
			// `--base` takes the word after it, a branch's name.
			const at = args.indexOf("--base");
			const base = at === -1 ? undefined : (args[at + 1] ?? "");
			const rest = at === -1 ? args : args.toSpliced(at + 1, 1);
			const flags = rest.filter((arg) => arg.startsWith("-"));
			const [group = "", verb = "", ...words] = rest.filter((arg) => !arg.startsWith("-"));
			const shape = Object.hasOwn(VERBS, group) && Object.hasOwn(VERBS[group]!, verb) ? VERBS[group]![verb]! : undefined;
			const wrong = base === "" || base?.startsWith("-") === true || new Set(flags).size !== flags.length;
			if (shape === undefined || wrong || words.length !== shape.length || flags.some((flag) => !(FLAGS[`${group} ${verb}`] ?? []).includes(flag))) return (console.error(USAGE), 2);
			// `insideJob` tells a job's process from the coordinator's (AR0354), as for `arthur ci --rerun`.
			const job = insideJob(dirname(host.folder));
			if (job !== undefined && !READS.includes(verb))
				return (console.error(`arthur github ${group} ${verb}: refused inside a job ${job}: a job runs only the commands its role needs; put what the coordinator should do in your final message`), 1);
			const entry = project === undefined ? list[0] : list.find((each) => each.name === project);
			if (entry === undefined) throw new Error(`${project === undefined ? "no project to act on" : `no project ${project}`}; projects: ${list.map((each) => each.name).join(", ") || "none"}`);
			if (group === "branch") return branch(host, entry, verb, words[0] ?? "", flags);
			return group === "issue" ? issue(repository(entry, accounts), verb, words, flags.includes("--all")) : pr(repository(entry, accounts), verb, words, flags.includes("--all"), base);
		},
	};
}

// A project's GitHub repository, from its checkout's `origin`, and the instance named after the repository's owner, else the
// unnamed one; one neither fits is refused, `ci` starting the refusal of a missing origin (`github.project({ workflow }) is set, but `, at
// load). The remote's URL is never said: it may hold a credential.
export function repository(project: Entry, accounts: readonly Instance[], ci = ""): Repository {
	const remote = git(project.path, "remote", "get-url", "origin");
	if (remote === undefined) throw new Error(`project ${project.name}: ${ci}its checkout has no origin remote to name its GitHub repository`);
	// An owner is letters, digits and dashes, a repository adds `.` and `_`: what a credential in the URL can never pass as.
	const [, owner, name] = /[/:]([A-Za-z0-9-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote) ?? [];
	if (owner === undefined || name === undefined) throw new Error(`project ${project.name}: its origin remote names no <owner>/<repository>`);
	const instance = accounts.find((each) => each.name === owner.toLowerCase()) ?? accounts.find((each) => each.name === undefined);
	if (instance === undefined)
		throw new Error(`project ${project.name}: no instance of github is named ${owner.toLowerCase()}, the owner of ${owner}/${name}, and none is unnamed; github's instances: ${accounts.map((each) => each.label).join(", ")}`);
	return { project: project.name, path: project.path, repo: `${owner}/${name}`, instance };
}

// GitHub's text as it may be printed: control characters, which could drive the terminal, dropped; a missing one empty.
export function text(value: unknown): string {
	return typeof value === "string" || typeof value === "number" ? String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "") : "";
}

// Text people wrote on GitHub, each of its lines after `> `, so none reads as Arthur's or the owner's; none for an empty one.
export function quoted(value: unknown): string[] {
	const lines = text(value).trimEnd();
	return lines === "" ? [] : lines.split("\n").map((line) => `> ${line}`);
}

// A file's text, trimmed, as a write sends it; one that cannot be read, or is empty, is refused before any request.
export function fileText(file: string): string {
	let read: string;
	try {
		read = readFileSync(file, "utf8").trim();
	} catch (error) {
		throw new Error(`cannot read ${file}: ${error instanceof Error && "code" in error ? String(error.code) : String(error)}; nothing was asked of GitHub`);
	}
	if (read === "") throw new Error(`${file} is empty; nothing was asked of GitHub`);
	return read;
}

// The file's first line, a Markdown heading's `#` dropped, is a title, the rest, trimmed, a body (as `youtrack issue create`).
export function titled(file: string): { readonly title: string; readonly body: string } {
	const [first = "", ...rest] = fileText(file).split("\n");
	const title = first.replace(/^#+(\s+|$)/, "").trim();
	if (title === "") throw new Error(`${file} starts with an empty heading; its first line is the title, the rest the body; nothing was asked of GitHub`);
	return { title, body: rest.join("\n").trim() };
}

// The day of GitHub's ISO time.
export function day(value: unknown): string {
	return text(value).slice(0, 10);
}
