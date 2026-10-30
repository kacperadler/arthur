import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { insideJob } from "@arthur/core/inside-job";
import type { Command, Host } from "@arthur/core/plugin";
import { ask, field, type Run, type Watched, workflowRuns } from "./github-api.ts";
import { quoted, text } from "./github-command.ts";
import { DEPTH, git, nearestRun } from "./github-git.ts";

// `arthur ci <branch> [--rerun]` (spec/roadmap.md, entry 58): the run that built the branch, as the poll finds it (the newest
// run of its nearest commit that has one), and why it failed: each failed job, its failed step, and the end of the first one's
// log; `--rerun` asks GitHub to rerun a failed or cancelled run, once per run. docs/commands/ci.md. Entry 59: the same run for
// `github.ci`, and a run cancelled for `github.cancel`, which delivery's `arthur merge` (AR0362) and its CI waits ask.

const USAGE = "usage: arthur ci <branch> [--rerun] [--project <name>]";
// The conclusions of a run that failed or was cancelled, and of a job or step that failed.
const FAILED = ["failure", "timed_out", "startup_failure", "cancelled"];
// The lines of a log shown: those that end at its last error.
const LOG_LINES = 30;
const LINE_CHARS = 300;

export function ciCommand(host: Host, watched: readonly Watched[]): Command {
	return {
		name: "ci",
		doc: new URL("../docs/commands/ci.md", import.meta.url),
		inJob: true,
		async run({ args, project }) {
			const words = args.filter((arg) => arg !== "--rerun");
			const flag = words.find((word) => word.startsWith("-"));
			const [branch] = words;
			if (branch === undefined || words.length > 1 || flag !== undefined) {
				console.error(`arthur ci: ${flag !== undefined ? `unknown flag ${flag}` : branch === undefined ? "no branch" : `one branch; got ${words.length}`}\n${USAGE}`);
				return 2;
			}
			// Inside a job (`insideJob`) `ci` reads a run only: `--rerun` refuses itself there (AR0386).
			const job = insideJob(dirname(host.folder));
			if (job !== undefined && args.includes("--rerun")) return (console.error(`arthur ci --rerun: refused inside a job ${job}: a job runs only the commands its role needs; put what the coordinator should do in your final message`), 1);
			const name = project ?? host.board.projects()[0]?.name;
			const refuse = (text: string) => (console.error(`arthur ci: ${text}`), 1);
			const asked = await built(watched, name, branch).catch((error: Error) => error);
			if (asked instanceof Error) return refuse(asked.message);
			const { each, runs, found } = asked;
			if (found === undefined) return refuse(`no run built ${branch}: none of its last ${DEPTH} commits has one among the ${runs} newest runs of ${each.workflow}`);
			const { run, below } = found;
			const where = below === 0 ? `${branch}'s tip` : `${branch}, ${below} commit${below === 1 ? "" : "s"} below its tip`;
			console.log(`run ${run.id}, attempt ${run.attempt}, of ${each.workflow} on ${run.sha.slice(0, 7)} (${where}): ${run.status === "completed" ? run.conclusion : run.status}\n${run.url}`);
			if (args.includes("--rerun")) return rerun(host, each, run, refuse);
			if (run.status !== "completed" || !FAILED.includes(run.conclusion ?? "")) return 0;
			return why(each, run, refuse);
		},
	};
}

// The run that built `branch` of `project` (github-git.ts `nearestRun`), with the project and how many runs GitHub listed; a
// refusal throws: a project without `github.project({ workflow })`, a branch not in its checkout, GitHub's own.
export async function built(watched: readonly Watched[], project: string | undefined, branch: string) {
	const each = watched.find((one) => one.project === project);
	if (each === undefined) throw new Error(`project ${project} has no github.project({ workflow }), so github watches no run of it`);
	if (git(each.path, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`) === undefined) throw new Error(`no branch ${branch} in ${each.path}`);
	const answer = await workflowRuns(each.instance, each.repo, each.workflow, new AbortController().signal);
	if (!("runs" in answer)) throw new Error(answer.text);
	return { each, runs: answer.runs.length, found: nearestRun(each.path, branch, answer.runs) };
}

// Asks GitHub to cancel run `id` of `project`'s workflow: one line once it took the request; a refusal throws.
export async function cancel(watched: readonly Watched[], project: string, id: number): Promise<string> {
	const each = watched.find((one) => one.project === project);
	if (each === undefined) throw new Error(`project ${project} has no github.project({ workflow }), so github watches no run of it`);
	const answer = await ask(each.instance, `/repos/${each.repo}/actions/runs/${id}/cancel`, `run ${id} of ${each.repo}`, "Actions: read and write", new AbortController().signal, "POST");
	if (!("body" in answer)) throw new Error(answer.text);
	return `github: cancel of run ${id} of ${each.repo} asked`;
}

// Reruns the whole run, its failed and cancelled jobs with the rest; refused for a run not finished, one that did not fail or
// get cancelled, and one rerun before, by Arthur (`reruns`, by run id) or by hand (an attempt past the first).
async function rerun(host: Host, each: Watched, run: Run, refuse: (text: string) => number): Promise<number> {
	if (run.status !== "completed") return refuse(`run ${run.id} is ${run.status}, not finished; only a run that failed or was cancelled is rerun`);
	if (!FAILED.includes(run.conclusion ?? "")) return refuse(`run ${run.id} ${run.conclusion === "success" ? "passed" : `ended ${run.conclusion}`}; only a run that failed or was cancelled is rerun`);
	const file = join(host.folder, "reruns");
	let asked: string[] = [];
	try {
		asked = readFileSync(file, "utf8").split("\n");
	} catch {}
	if (asked.includes(String(run.id)) || run.attempt > 1)
		return refuse(`run ${run.id} was rerun before (attempt ${run.attempt}); arthur ci reruns a run once, and a further rerun is the owner's, on GitHub`);
	const answer = await ask(each.instance, `/repos/${each.repo}/actions/runs/${run.id}/rerun`, `run ${run.id} of ${each.repo}`, "Actions: read and write", new AbortController().signal, "POST");
	if (!("body" in answer)) return refuse(answer.text);
	appendFileSync(file, `${run.id}\n`);
	console.log(`rerun of run ${run.id} asked: its attempt ${run.attempt + 1} is told as ci-finished when it ends`);
	return 0;
}

// Each failed job of the run's attempt with its failed step, then the end of the first one's log; the jobs' and steps' names
// and the log's lines, written in the repository, each on a line of its own after `> `.
async function why(each: Watched, run: Run, refuse: (text: string) => number): Promise<number> {
	const signal = new AbortController().signal;
	const answer = await ask(each.instance, `/repos/${each.repo}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`, `the jobs of run ${run.id} of ${each.repo}`, "Actions: read", signal);
	if (!("body" in answer)) return refuse(answer.text);
	const jobs = field(answer.body, "jobs");
	const failed = (Array.isArray(jobs) ? jobs : []).filter((job) => FAILED.includes(String(field(job, "conclusion"))) && typeof field(job, "id") === "number");
	if (failed.length === 0) {
		console.log("no job of it failed: it ended before one ran");
		return 0;
	}
	for (const job of failed) {
		const steps = field(job, "steps");
		const step = (Array.isArray(steps) ? steps : []).find((one) => FAILED.includes(String(field(one, "conclusion"))));
		const named = [`job ${text(field(job, "id"))} ended ${text(field(job, "conclusion"))}, its name:`, ...quoted(field(job, "name"))];
		console.log([...named, ...(step === undefined ? ["no step of it failed"] : [`its step ${text(field(step, "number"))} failed:`, ...quoted(field(step, "name"))])].join("\n"));
	}
	const [first] = failed;
	const id = text(field(first, "id"));
	const log = await ask(each.instance, `/repos/${each.repo}/actions/jobs/${id}/logs`, `the log of job ${id} of ${each.repo}`, "Actions: read", signal);
	if (!("body" in log)) return refuse(log.text);
	// Each line starts with its time, `2026-01-01T00:00:00.0000000Z `, left out here.
	const lines = log.text.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((line) => text(line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, "")));
	const error = lines.findLastIndex((line) => line.startsWith("##[error]"));
	const end = error < 0 ? lines.length : error + 1;
	const shown = lines.slice(Math.max(0, end - LOG_LINES), end).map((line) => `> ${line.length > LINE_CHARS ? `${line.slice(0, LINE_CHARS)}…` : line}`);
	const cut = shown.length < lines.length ? `, its ${shown.length} lines up to ${error < 0 ? "its end" : "its last error"} of ${lines.length}` : "";
	console.log(`the log of job ${id}${cut}:\n${shown.join("\n")}`);
	return 0;
}
