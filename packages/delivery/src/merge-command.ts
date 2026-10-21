import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Command, Host, JobRecord } from "@arthur/core/plugin";
import { failed, mainChecks, reinstall } from "./merge-checks.ts";
import { settleTicket } from "./merge-outcome.ts";
import { FEATURE } from "./review-command.ts";
import { reviewsOf } from "./review-records.ts";

// `arthur merge <job> [--unreviewed]` (spec/roadmap.md, entry 54): an ended job's branch merged into the branch its project's
// checkout has, main, after every refusal; the checks run there, and main reset when one fails; then the ticket's side
// (merge-outcome.ts) and the procedure after a merge. It commits nothing past the merge and prunes nothing; main is pushed by
// the plugin that provides `github.push` (entry 58), when one is loaded. docs/commands/merge.md.

const USAGE = "usage: arthur merge <job> [--unreviewed]";
// The board's moves since the last commit are left uncommitted until the commit after a merge, so they are no dirt.
const BOARD = "spec/build.json";
const MERGEABLE = ["in-progress", "review", "done"];

export function mergeCommand(host: Host, procedure: URL): Command {
	return {
		name: "merge",
		doc: new URL("../docs/commands/merge.md", import.meta.url),
		async run({ args }) {
			const words = args.filter((arg) => arg !== "--unreviewed");
			const flag = words.find((word) => word.startsWith("-"));
			const [name] = words;
			if (name === undefined || words.length > 1 || flag !== undefined) {
				console.error(`arthur merge: ${flag !== undefined ? `unknown flag ${flag}` : name === undefined ? "no job" : `one job; got ${words.length}`}\n${USAGE}`);
				return 2;
			}
			const branch = merge(host, name, args.includes("--unreviewed"));
			const pushed = await Promise.all(host.collect<Promise<string>>("github.push", branch));
			for (const line of pushed) console.log(line);
			console.log(`nothing committed but the merge, nothing ${pushed.length === 0 ? "pushed or " : ""}pruned\n\n${readFileSync(procedure, "utf8").trim()}`);
		},
	};
}

// Merges, and returns main as `github.push` takes it.
function merge(host: Host, name: string, unreviewed: boolean): { readonly project: string; readonly branch: string } {
	const job = host.jobs.list().find((each) => each.id === name || each.id.endsWith(`-${name}`));
	if (job === undefined) throw new Error(`no job ${name}; arthur jobs lists them`);
	if (job.branch === "") throw new Error(`${job.id} is a ${job.kind} job, read-only: it has no branch to merge`);
	if (host.jobs.running().includes(job.id)) throw new Error(`${job.id} is in a run (${job.state}); merge its branch once the run has ended`);
	const root = host.board.projects().find((project) => project.name === job.project)?.path;
	if (root === undefined) throw new Error(`${job.id}'s project ${job.project} is not in the project list`);
	const git = (...words: string[]) => spawnSync("git", ["-C", root, ...words], { encoding: "utf8" });
	const last = (ran: { readonly stdout: string; readonly stderr: string }) => (ran.stderr.trim() || ran.stdout.trim()).split("\n").at(-1) ?? "";
	const tip = git("rev-parse", "--verify", "--quiet", `${job.branch}^{commit}`).stdout.trim();
	if (tip === "") throw new Error(`${job.branch} is not in ${root}: pruned, or not brought back from its machine`);
	const main = git("symbolic-ref", "--quiet", "--short", "HEAD").stdout.trim();
	if (main === "") throw new Error(`${root} has no branch checked out (a detached HEAD); check out its main branch first`);
	const folders = [...new Set(job.tickets.flatMap((path) => FEATURE.exec(path)?.[1] ?? []))];
	if (folders.length > 1) throw new Error(`${job.id}'s task names ${folders.length} tickets (${folders.join(", ")}); a merge is of one ticket's branch`);
	const [folder] = folders;
	const ticket = folder === undefined ? undefined : host.board.get(basename(folder).split("-")[0] ?? "");
	if (folder !== undefined) {
		if (ticket === undefined) throw new Error(`${basename(folder).split("-")[0]} is not on the board`);
		if (!MERGEABLE.includes(ticket.status)) throw new Error(`${ticket.id} is ${ticket.status}; a merge is of a ticket in-progress, review or done`);
		if (existsSync(join(root, folder, "outcome.md"))) throw new Error(`${folder}/outcome.md already exists: ${ticket.id} was merged before`);
	}
	const status = git("status", "--porcelain", "--untracked-files=no");
	const dirty = status.stdout.split("\n").flatMap((line) => (line.length > 3 && line.slice(3) !== BOARD ? [line.slice(3)] : []));
	if (status.status !== 0 || dirty.length > 0) throw new Error(`${main} has uncommitted changes in ${dirty.join(", ") || `?: ${last(status)}`}; commit or stash them first; main is unchanged`);
	const before = git("rev-parse", "HEAD").stdout.trim();
	const subjects = git("log", "--reverse", "--no-merges", "--format=%s", `${before}..${tip}`).stdout.trim();
	if (subjects === "") throw new Error(`${job.branch} at ${tip.slice(0, 7)} adds nothing to ${main} (${before.slice(0, 7)}): nothing to merge`);
	const gap = passGap(host, job, tip);
	if (gap !== "" && !unreviewed) throw new Error(`${gap}; review it with arthur review ${job.id}, or merge it with --unreviewed on the owner's word only; main is unchanged`);
	const refusals = host.collect("merge.check", job).filter((answer) => typeof answer === "string" && answer !== "");
	if (refusals.length > 0) throw new Error(`refused by merge.check: ${refusals.join("; ")}; main is unchanged`);

	const merged = git("merge", "--no-ff", "-m", ticket === undefined ? `Merge ${job.branch}` : `Merge ${ticket.id}: ${ticket.title}`, tip);
	if (merged.status !== 0) {
		const conflicts = git("diff", "--name-only", "--diff-filter=U").stdout.trim();
		if (git("rev-parse", "--quiet", "--verify", "MERGE_HEAD").status === 0) git("merge", "--abort");
		if (conflicts === "") throw new Error(`git merge ${job.branch} failed: ${last(merged)}; main is unchanged`);
		throw new Error(`${job.branch} conflicts with ${main} in ${conflicts.split("\n").join(", ")}; merge aborted, main is unchanged`);
	}
	const hash = git("rev-parse", "--short", "HEAD").stdout.trim();
	console.log(`merged ${job.branch} into ${main}: ${hash}`);
	const steps = mainChecks(root, before, console.log);
	if (steps.length === 0) console.log("no checks: package.json declares no check or test script");
	const failing = steps.filter(failed).map((each) => each.command);
	if (failing.length > 0) {
		// `--keep`, unlike `--hard`, keeps the board's uncommitted moves, which the merge never touches.
		const reset = git("reset", "--quiet", "--keep", before);
		if (reset.status !== 0) throw new Error(`check failed on main (${failing.join(", ")}), and main could not be reset to ${before.slice(0, 7)}: ${last(reset)}`);
		throw new Error(`check failed on main (${failing.join(", ")}); main reset to ${before.slice(0, 7)}, branch kept${reinstall(root, steps, console.log)}`);
	}
	if (ticket === undefined || folder === undefined) console.log("no ticket: no outcome.md, nothing moved");
	else settleTicket(host, { job, ticket, folder, root, hash, subjects: subjects.split("\n"), steps, gap }, console.log);
	return { project: job.project, branch: main };
}

// Why the branch's tip has no PASS, or "" when it has one: the newest review of that commit with a verdict says PASS, or
// `arthur review-needed` answered `no review` for it.
function passGap(host: Host, job: JobRecord, tip: string): string {
	const reviews = reviewsOf(host, job.branch);
	const onTip = reviews.findLast(([review, verdict]) => tip.startsWith(review.commit) && (verdict === "PASS" || verdict === "FAIL"));
	if (onTip?.[1] === "PASS") return "";
	let kept: unknown;
	try {
		kept = JSON.parse(readFileSync(join(host.folder, job.id, "review-needed"), "utf8"));
	} catch {
		// No answer of `arthur review-needed`, or a broken one: no `no review`.
	}
	if (typeof kept === "object" && kept !== null && "answer" in kept && "commit" in kept && String(kept.answer).startsWith("no review") && kept.commit === tip) return "";
	const pass = reviews.findLast(([, verdict]) => verdict === "PASS")?.[0].commit.slice(0, 7) ?? "none";
	return `no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: ${onTip === undefined ? "no review of it has a verdict" : `its newest review, ${onTip[0].id}, says FAIL`} (last PASS: ${pass})`;
}
