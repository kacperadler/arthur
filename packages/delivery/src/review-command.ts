import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command, Host, JobRecord } from "@arthur/core/plugin";
import { failsSincePass, LIMIT } from "./review-records.ts";

// `arthur review <worker job> [--round <n>]` (spec/roadmap.md, entry 52): a review of a worker's branch at its tip, its task
// built here so it carries the ticket, the branch and the commit; refused at the limit with the procedure for the owner's
// choice, and before the job's checks passed on the tip (AR0580). docs/commands/review.md.

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
	const { folder, commit, base, head, git } = branchOf(host, job);
	const gap = untested(host, job, { git, commit });
	if (gap !== undefined) throw new Error(gap);
	const result = host.jobs.result(job.id).trim().replaceAll(/\bTicket:/g, "Ticket\\:");
	const task = [
		[`Ticket: ${folder}/ticket.md`, `Branch: ${job.branch}`, `Commit: ${commit}`, ...(round === undefined ? [] : [`Round: ${round}`])].join("\n"),
		`Review the branch ${job.branch} at ${commit}: your worktree is a detached checkout of that commit. The range to judge is ${base}..${commit}: \`git diff ${base}..${commit}\` and \`git log --oneline ${base}..${commit}\`. Read the ticket as main holds it: \`git show ${head}:${folder}/ticket.md\`.`,
		`## The worker's final message (job ${job.id})\n\n${result === "" ? "None." : result}`,
	].join("\n\n");
	return { task, commit };
}

// What a review and `arthur review-needed` judge of an ended worker: its one ticket's folder, its project's main checkout, its
// branch's tip there, HEAD, where the branch leaves HEAD, and Git there; refused for a branch that adds nothing to HEAD.
export function branchOf(host: Host, job: JobRecord): { readonly folder: string; readonly root: string; readonly commit: string; readonly head: string; readonly base: string; readonly git: (...args: string[]) => string } {
	const folders = [...new Set(job.tickets.flatMap((path) => FEATURE.exec(path)?.[1] ?? []))];
	const [folder] = folders;
	if (folder === undefined || folders.length > 1) throw new Error(`${job.id}'s task names ${folders.length === 0 ? "no ticket" : `${folders.length} tickets (${folders.join(", ")})`}; a review is of one ticket's branch`);
	const root = host.board.projects().find((project) => project.name === job.project)?.path;
	if (root === undefined) throw new Error(`${job.id}'s project ${job.project} is not in the project list`);
	// No hook or fsmonitor the main checkout's config names runs, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
	const git = (...args: string[]) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, ...args], { encoding: "utf8" }).stdout.trim();
	const commit = git("rev-parse", "--verify", "--quiet", `${job.branch}^{commit}`);
	if (commit === "") throw new Error(`${job.branch} is not in ${root}: pruned, or not brought back from its machine`);
	const [head, base] = [git("rev-parse", "HEAD"), git("merge-base", "HEAD", commit)];
	if (base === commit) throw new Error(`${job.branch} at ${commit.slice(0, 7)} adds nothing to HEAD (${head.slice(0, 7)}): nothing to review`);
	return { folder, root, commit, head, base, git };
}

// The job's checks for its tip (docs/commands/review-needed.md, "The job's checks"): for each of `check`, `test` and `mutate`
// the tip's package.json declares, its latest line on the tip's clean tree, else its latest line, else none; `git` shows a file.
export function tipChecks(git: (...words: string[]) => string, tip: string, checks: string): (readonly [string, readonly string[] | undefined])[] {
	let scripts: readonly string[] = [];
	try {
		const { scripts: declared } = JSON.parse(git("show", `${tip}:package.json`)) as { readonly scripts?: Readonly<Record<string, unknown>> };
		scripts = ["check", "test", "mutate"].filter((name) => typeof declared?.[name] === "string");
	} catch {
		// No package.json at the tip, or a broken one: no checks.
	}
	const recorded = checks.split("\n").map((line) => line.split(" ")).filter((words) => words.length >= 4);
	return scripts.map((script) => [script, recorded.findLast((words) => words[0] === script && words.at(-2) === tip && words.at(-1) === "clean") ?? recorded.findLast(([name]) => name === script)]);
}

// Why no review of the worker's tip starts yet (AR0580), or undefined: each script of `tipChecks` on the tip's clean tree, `check` and
// `test` passing, `mutate` with any result (its survivors named by the worker); a job on another machine writes its checks there.
export function untested(host: Host, job: JobRecord, { git, commit: tip }: { readonly git: (...words: string[]) => string; readonly commit: string } = branchOf(host, job)): string | undefined {
	const file = join(host.folder, job.id, "checks");
	const latest = job.machine === "local" ? tipChecks(git, tip, existsSync(file) ? readFileSync(file, "utf8") : "") : [];
	const gaps = latest.flatMap(([script, words]) => {
		if (words === undefined) return [`no ${script}`];
		if (`${words.at(-2)} ${words.at(-1)}` !== `${tip} clean`) return [`${script} ran on ${words.at(-2) === tip ? "a dirty tree" : `${words.at(-2)?.slice(0, 7)}, not the tip`}`];
		return script === "mutate" || words[1] === "pass" ? [] : [words.slice(0, -2).join(" ")];
	});
	return gaps.length === 0 ? undefined : `${job.branch} at ${tip.slice(0, 7)} is reviewed only once the job's checks passed on its clean tip (check and test pass, mutate ran): ${gaps.join(", ")}`;
}
