import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Command, Host, JobRecord } from "@arthur/core/plugin";
import { failsSincePass, LIMIT } from "./review-records.ts";

// `arthur review <worker job> [--round <n>]` (spec/roadmap.md, entry 52): a review of a worker's branch at its tip, its task
// built here so it carries the ticket, the branch and the commit; refused at the limit with the procedure for the owner's
// choice. docs/commands/review.md.

const USAGE = "usage: arthur review <worker job> [--round <n>]";
export const FEATURE = /(?:^|\/)(spec\/features\/[A-Z]+\d{4,}-[^/]+)\//;

export function reviewCommand(host: Host, procedure: URL): Command {
	return {
		name: "review",
		doc: new URL("../docs/commands/review.md", import.meta.url),
		async run({ args }) {
			const parsed = parse(args);
			if (typeof parsed === "string") {
				console.error(`arthur review: ${parsed}\n${USAGE}`);
				return 2;
			}
			const job = worker(host, parsed.job);
			const { task, commit } = reviewTask(host, job, parsed.round);
			let started;
			try {
				// The tip goes to the review's machine with its base, so the review checks it out there wherever the worker ran.
				started = await host.jobs.spawn({ task, kind: "review", project: job.project, fetch: commit });
			} catch (error) {
				console.error(`arthur review: ${error instanceof Error ? error.message : String(error)}`);
				if (parsed.round === undefined && failsSincePass(host, job.branch).length >= LIMIT) console.error(`\n${readFileSync(procedure, "utf8").trim()}`);
				return 1;
			}
			for (const warning of started.warnings) console.error(`warning: ${warning}`);
			if (started.modelWhy !== undefined) console.error(`model: ${started.modelWhy}`);
			console.log(started.id);
			if (started.failed === undefined) return;
			console.error(`failed: ${started.failed}`);
			return 1;
		},
	};
}

// One job, by its id or the 8 hex digits that end it, and `--round` once, a whole number of 1 or more.
function parse(args: readonly string[]): { readonly job: string; readonly round?: number } | string {
	const words: string[] = [];
	let round: number | undefined;
	for (let at = 0; at < args.length; at++) {
		const arg = args[at] ?? "";
		if (arg !== "--round") {
			if (arg.startsWith("-")) return `unknown flag ${arg}`;
			words.push(arg);
			continue;
		}
		if (round !== undefined) return "--round given twice";
		const value = args[++at];
		if (value === undefined || !/^[1-9]\d*$/.test(value)) return `--round needs a whole number of 1 or more, got ${value ?? "nothing"}`;
		round = Number(value);
	}
	const [job] = words;
	if (job === undefined || words.length > 1) return words.length === 0 ? "no job" : `one job; got ${words.length}`;
	return { job, round };
}

// The ended worker job `name` names, by its id or the 8 hex digits that end it; `arthur review-needed` asks it too.
export function worker(host: Host, name: string): JobRecord {
	const job = host.jobs.list().find((each) => each.id === name || each.id.endsWith(`-${name}`));
	if (job === undefined) throw new Error(`no job ${name}; arthur jobs lists them`);
	if (job.kind !== "worker" || job.branch === "") throw new Error(`${job.id} is a ${job.kind} job; a review is of a worker's branch`);
	if (host.jobs.running().includes(job.id)) throw new Error(`${job.id} is in a run (${job.state}); review its branch once the run has ended`);
	return job;
}

// The review's task: its head, the lines the plugin and placement read (the one `Ticket:`, `Branch:`, `Commit:`, `Round:` past
// the limit), then the range to judge and the worker's final message, whose own `Ticket:` words are escaped so the core and
// placement read the review's ticket alone; the hand-back's next review is built the same way.
export function reviewTask(host: Host, job: JobRecord, round: number | undefined): { readonly task: string; readonly commit: string } {
	const { folder, commit, base, head } = branchOf(host, job);
	const result = host.jobs.result(job.id).trim().replaceAll(/\bTicket:/g, "Ticket\\:");
	const task = [
		[`Ticket: ${folder}/ticket.md`, `Branch: ${job.branch}`, `Commit: ${commit}`, ...(round === undefined ? [] : [`Round: ${round}`])].join("\n"),
		`Review the branch ${job.branch} at ${commit}: your worktree is a detached checkout of that commit. The range to judge is ${base}..${commit}: \`git diff ${base}..${commit}\` and \`git log --oneline ${base}..${commit}\`. Read the ticket as main holds it: \`git show ${head}:${folder}/ticket.md\`.`,
		`## The worker's final message (job ${job.id})\n\n${result === "" ? "None." : result}`,
	].join("\n\n");
	return { task, commit };
}

// What a review and `arthur review-needed` judge of an ended worker: its one ticket's folder, its project's main checkout, its
// branch's tip there, HEAD, and where the branch leaves HEAD; refused for a branch that adds nothing to HEAD.
export function branchOf(host: Host, job: JobRecord): { readonly folder: string; readonly root: string; readonly commit: string; readonly head: string; readonly base: string } {
	const folders = [...new Set(job.tickets.flatMap((path) => FEATURE.exec(path)?.[1] ?? []))];
	const [folder] = folders;
	if (folder === undefined || folders.length > 1) throw new Error(`${job.id}'s task names ${folders.length === 0 ? "no ticket" : `${folders.length} tickets (${folders.join(", ")})`}; a review is of one ticket's branch`);
	const root = host.board.projects().find((project) => project.name === job.project)?.path;
	if (root === undefined) throw new Error(`${job.id}'s project ${job.project} is not in the project list`);
	const git = (...args: string[]) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" }).stdout.trim();
	const commit = git("rev-parse", "--verify", "--quiet", `${job.branch}^{commit}`);
	if (commit === "") throw new Error(`${job.branch} is not in ${root}: pruned, or not brought back from its machine`);
	const [head, base] = [git("rev-parse", "HEAD"), git("merge-base", "HEAD", commit)];
	if (base === commit) throw new Error(`${job.branch} at ${commit.slice(0, 7)} adds nothing to HEAD (${head.slice(0, 7)}): nothing to review`);
	return { folder, root, commit, head, base };
}
