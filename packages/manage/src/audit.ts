import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host, Job } from "@arthur/core/plugin";
import { fileReport, lastReport, type Reports } from "./report-file.ts";
import { AUDIT_BUDGET, type AuditOptions } from "./manage-options.ts";
import { scheduleKind } from "./scheduled-kind.ts";
import { stats } from "./stats.ts";

// The audit (spec/roadmap.md, entry 62): the kind `audit`, read-only, with the auditor role and the audit criteria; every audit's
// prompt gets the commits since the last audit, the board digest, the stats and the open findings of its project; the schedule
// entry of `audit.at` and `audit.days` (scheduled-kind.ts), which starts none with no commit since the last audit; the filing
// (report-file.ts) and the procedure its end brings. docs/manage.md, "The audit".

const KIND = "audit";
const ROLE = "auditor";
export const AUDIT_TASK = "Audit the commits since the last audit, then the rest of the repository, as your role and the audit criteria say.";
export const AUDITS: Reports = { folder: "spec/quality", title: "Audit", commit: "Commit audited" };
// A commit that changes only the reports and the board, as the procedure's commit of an audit does, is no commit to audit.
const AUDITED_PATHS = ["--", ".", `:(exclude)${AUDITS.folder}`, ":(exclude)spec/build.json", ":(exclude)spec/features"];
const FINDING = /^## (F\d+)\.[ \t]*(.*)$/m;

// Git's output, or undefined when it exits with an error; Git missing throws.
function git(root: string, args: readonly string[]): string | undefined {
	const ran = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
	if (ran.error !== undefined) throw ran.error;
	return ran.status === 0 ? ran.stdout : undefined;
}

const lines = (text: string) => text.split("\n").filter((line) => line.trim() !== "");

export function audit(host: Host, options: AuditOptions | undefined): void {
	host.jobs.registerRole({ name: ROLE, file: new URL("../roles/auditor.md", import.meta.url), criteria: ["audit", "styleguide"] });
	host.jobs.registerKind({ name: KIND, readOnly: true, role: ROLE, budgetUsd: options?.budgetUsd ?? AUDIT_BUDGET, resumeOnBudget: true, file: (filing) => fileReport(AUDITS, filing) });
	host.provide("prompt", (role: string, job: Job) => (role === ROLE ? context(host, job) : undefined));
	const procedure = new URL("../roles/coordinator/audit-ended.md", import.meta.url);
	host.provide("coordinator.wake", (job: { readonly kind?: unknown }) => (job.kind === KIND ? readFileSync(procedure, "utf8").trim() : undefined));
	if (options === undefined) return;
	scheduleKind(host, { kind: KIND, option: "audit", daysOption: "audit.days", at: options.at, ...(options.days === undefined ? {} : { days: options.days }), task: AUDIT_TASK, ...(options.model === undefined ? {} : { model: options.model }), skip: (main) => noNewCommit(main.path) });
}

// The commits to audit up to `head`, newest first, and what they are since: the last audit's commit, or the last 24 hours when
// no report names one, or it is no commit of the repository.
function since(root: string, head: string): { readonly last?: string; readonly heading: string; readonly commits: readonly string[] } {
	const last = lastReport(root, AUDITS);
	const listed = last === undefined ? undefined : git(root, ["log", "--format=%h %s", `${last.commit}..${head}`, ...AUDITED_PATHS]);
	if (last !== undefined && listed !== undefined) return { last: last.commit, heading: `since the last audit, ${last.commit.slice(0, 12)} (${last.path})`, commits: lines(listed) };
	const why = last === undefined ? `no report in ${AUDITS.folder}/ names an audited commit` : `${last.commit} of ${last.path} is no commit of this repository`;
	return { heading: `of the last 24 hours (${why})`, commits: lines(git(root, ["log", "--format=%h %s", "--since=24.hours", head, ...AUDITED_PATHS]) ?? "") };
}

// Every `- Status: open` entry of the findings.md of each ticket on the project's board: its ticket, number, title and Where.
function openFindings(host: Host, project: string, root: string): string[] {
	return host.board.list(project).flatMap((ticket) => {
		const path = join(root, dirname(ticket.path), "findings.md");
		if (!existsSync(path)) return [];
		return readFileSync(path, "utf8")
			.split(/^(?=## )/m)
			.flatMap((entry) => {
				const [, number, title = ""] = FINDING.exec(entry) ?? [];
				if (number === undefined || !/^- Status: open\b/m.test(entry)) return [];
				const where = /^- Where: (.*)$/m.exec(entry)?.[1]?.trim();
				return [`- ${ticket.id} ${number}: ${title.trim()}${where ? `. Where: ${where}` : ""}`];
			});
	});
}

// The section every audit's prompt gets, from the project's checkout: what it audits and since when, the board, the stats of
// the tickets merged since the last audited commit, the open findings, and where the vision is.
function context(host: Host, job: Job): string {
	const root = host.board.projects().find((each) => each.name === job.project)?.path ?? job.root;
	const { last, heading, commits } = since(root, job.base);
	const made = last === undefined ? undefined : git(root, ["show", "-s", "--format=%cI", last])?.trim();
	const vision = host.jobs.vision(job.project);
	return [
		`## This audit\n\nYou audit project ${job.project} at ${job.base}; your worktree is a detached checkout of that commit.`,
		`### Commits ${heading}\n\n${commits.length === 0 ? "none" : commits.join("\n")}`,
		`### Board\n\n${host.board.digest(job.project)}`,
		`### Stats\n\n${stats(host, job.project, made === undefined ? undefined : new Date(made))}`,
		`### Open findings\n\n${openFindings(host, job.project, root).join("\n") || "none"}`,
		`### Vision\n\n${vision.text === undefined ? `none: ${vision.path} is ${vision.problem}` : `\`${vision.path}\`: read it first, and rank each proposal by how far it moves the project there.`}`,
	].join("\n\n");
}

// Why the schedule's audit of the main project starts no job: no commit since the last audit's.
function noNewCommit(root: string): string | undefined {
	const head = git(root, ["rev-parse", "HEAD"])?.trim();
	if (head === undefined) throw new Error(`${root} has no HEAD to audit`);
	const { last, commits } = since(root, head);
	return last !== undefined && commits.length === 0 ? `no commit since the last audit's ${last.slice(0, 12)}` : undefined;
}
