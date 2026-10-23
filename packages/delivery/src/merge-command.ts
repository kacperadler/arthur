import { execFile, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Command, Host, JobRecord, Requirement } from "@arthur/core/plugin";
import { autoRefusal } from "./auto-merge.ts";
import { writeChangelog } from "./changelog.ts";
import { endWait } from "./ci-wait.ts";
import { failed, mainChecks, reinstall } from "./merge-checks.ts";
import { settleTicket } from "./merge-outcome.ts";
import { FEATURE } from "./review-command.ts";
import { reviewsOf } from "./review-records.ts";

// `arthur merge <job> [--unreviewed]` (spec/roadmap.md, entry 54): an ended job's branch merged into the branch its project's
// checkout has, main, after every refusal; the checks run there, and main reset when one fails; then the ticket's side
// (merge-outcome.ts) and the procedure after a merge. It commits nothing past the merge and prunes nothing; main is pushed by
// the plugin that provides `github.push` (entry 58), when one is loaded. `--auto [--no-ci]` (entry 59): the merge without the
// owner, after the refusals of auto-merge.ts. docs/commands/merge.md.

const USAGE = "usage: arthur merge <job> [--unreviewed | --auto [--no-ci]]";
const FLAGS = ["--unreviewed", "--auto", "--no-ci"];
// The board's moves since the last commit are left uncommitted until the commit after a merge, so they are no dirt; nor is the
// changelog each merge rebuilds (changelog.ts).
const DERIVED = ["spec/build.json", "CHANGELOG.md"];
const MERGEABLE = ["in-progress", "review", "done"];

// `held`: whether a path is on the always-review list, which `--auto` refuses.
export function mergeCommand(host: Host, procedure: URL, held: (path: string) => boolean): Command {
	return {
		name: "merge",
		doc: new URL("../docs/commands/merge.md", import.meta.url),
		async run({ args }) {
			const words = args.filter((arg) => !FLAGS.includes(arg));
			const flag = words.find((word) => word.startsWith("-"));
			const [name] = words;
			const [unreviewed = false, auto = false, noCi = false] = FLAGS.map((each) => args.includes(each));
			const mixed = auto && unreviewed ? "--auto merges only with a PASS, --unreviewed without one: one or the other" : noCi && !auto ? "--no-ci goes with --auto only" : undefined;
			if (name === undefined || words.length > 1 || flag !== undefined || mixed !== undefined) {
				console.error(`arthur merge: ${flag !== undefined ? `unknown flag ${flag}` : (mixed ?? (name === undefined ? "no job" : `one job; got ${words.length}`))}\n${USAGE}`);
				return 2;
			}
			const branch = await merge(host, name, { unreviewed, auto, ci: !noCi, held });
			const pushed = await Promise.all(host.collect<Promise<string>>("github.push", branch));
			for (const line of pushed) console.log(line);
			console.log(`nothing committed but the merge, nothing ${pushed.length === 0 ? "pushed or " : ""}pruned\n\n${readFileSync(procedure, "utf8").trim()}`);
		},
	};
}

// Merges, and returns main as `github.push` takes it.
async function merge(host: Host, name: string, mode: { readonly unreviewed: boolean; readonly auto: boolean; readonly ci: boolean; readonly held: (path: string) => boolean }): Promise<{ readonly project: string; readonly branch: string }> {
	const job = host.jobs.list().find((each) => each.id === name || each.id.endsWith(`-${name}`));
	if (job === undefined) throw new Error(`no job ${name}; arthur jobs lists them`);
	if (job.branch === "") throw new Error(`${job.id} is a ${job.kind} job, read-only: it has no branch to merge`);
	if (host.jobs.running().includes(job.id)) throw new Error(`${job.id} is in a run (${job.state}); merge its branch once the run has ended`);
	const root = host.board.projects().find((project) => project.name === job.project)?.path;
	if (root === undefined) throw new Error(`${job.id}'s project ${job.project} is not in the project list`);
	// No hook or fsmonitor the main checkout's config names runs: a program a job runs may have set them (AR0330).
	const git = (...words: string[]) => spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, ...words], { encoding: "utf8" });
	const last = (ran: { readonly stdout: string; readonly stderr: string }) => (ran.stderr.trim() || ran.stdout.trim()).split("\n").at(-1) ?? "";
	const tip = git("rev-parse", "--verify", "--quiet", `${job.branch}^{commit}`).stdout.trim();
	if (tip === "") throw new Error(`${job.branch} is not in ${root}: pruned, or not brought back from its machine`);
	const main = git("symbolic-ref", "--quiet", "--short", "HEAD").stdout.trim();
	if (main === "") throw new Error(`${root} has no branch checked out (a detached HEAD); check out its main branch first`);
	const identity = identityRequirement(job.project, root);
	const said = await identity.check();
	if (said !== "ok") throw new Error(`git has no identity for the merge commit: ${said.replace(/^missing: /, "")}; set one: ${identity.fix}; main is unchanged`);
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
	const dirty = status.stdout.split("\n").flatMap((line) => (line.length > 3 && !DERIVED.includes(line.slice(3)) ? [line.slice(3)] : []));
	if (status.status !== 0 || dirty.length > 0) throw new Error(`${main} has uncommitted changes in ${dirty.join(", ") || `?: ${last(status)}`}; commit or stash them first; main is unchanged`);
	const before = git("rev-parse", "HEAD").stdout.trim();
	const subjects = git("log", "--reverse", "--no-merges", "--format=%s", `${before}..${tip}`).stdout.trim();
	if (subjects === "") throw new Error(`${job.branch} at ${tip.slice(0, 7)} adds nothing to ${main} (${before.slice(0, 7)}): nothing to merge`);
	const gap = passGap(host, job, tip);
	if (gap !== "" && !mode.unreviewed && !mode.auto) throw new Error(`${gap}; review it with arthur review ${job.id}, or merge it with --unreviewed on the owner's word only; main is unchanged`);
	const auto = mode.auto ? await autoRefusal(host, mode.held, { job, root, tip, before, ci: mode.ci }) : "";
	if (auto !== "") throw new Error(`${auto}; main is unchanged`);
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
	const ask = { install: (commit: string) => host.call<string>("projects.install", { project: job.project, commit }), path: () => host.collect<string>("nvm.path", { root })[0] ?? "" };
	const steps = mainChecks(root, ask, console.log);
	if (steps.length === 0) console.log("no checks: package.json declares no check or test script");
	const failing = steps.filter(failed).map((each) => each.command);
	if (failing.length > 0) {
		// `--keep`, unlike `--hard`, keeps the board's uncommitted moves, which the merge never touches.
		const reset = git("reset", "--quiet", "--keep", before);
		if (reset.status !== 0) throw new Error(`check failed on main (${failing.join(", ")}), and main could not be reset to ${before.slice(0, 7)}: ${last(reset)}`);
		throw new Error(`check failed on main (${failing.join(", ")}); main reset to ${before.slice(0, 7)}, branch kept${reinstall(root, ask, steps, console.log)}`);
	}
	endWait(host, job.id);
	if (ticket === undefined || folder === undefined) console.log("no ticket: no outcome.md, nothing moved");
	else settleTicket(host, { job, ticket, folder, root, hash, subjects: subjects.split("\n"), steps, gap }, console.log);
	console.log(writeChangelog(host, job.project));
	return { project: job.project, branch: main };
}

// `arthur doctor`'s requirement, also asked before each merge: an author and a committer for the merge commit, as `git merge`
// in `root` reads them (`user.name`/`user.email` of the repository, the user or the system, or `GIT_AUTHOR_*`/`GIT_COMMITTER_*`);
// `git var` exits 128 on one it cannot find, as `git merge` does. Arthur never sets one: the owner's identity signs main.
export function identityRequirement(project: string, root: string): Requirement {
	const missing = (variable: string) =>
		new Promise<string>((resolve) => execFile("git", ["-C", root, "var", variable], (error, _out, stderr) => resolve(error === null ? "" : `missing: git var ${variable} in ${root}: ${stderr.trim().split("\n").at(-1)}`)));
	return {
		name: `${project} identity`,
		check: async () => (await missing("GIT_AUTHOR_IDENT")) || (await missing("GIT_COMMITTER_IDENT")) || "ok",
		costs: `arthur merge refuses every branch of ${project}: git has no author for the merge commit`,
		fix: `git config --global user.name "<your name>" and git config --global user.email "<your email>", or both with git -C ${root} config for this project alone`,
	};
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
