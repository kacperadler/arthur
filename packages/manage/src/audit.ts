import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host, Job } from "@arthur/core/plugin";
import { fileAudit, lastAudit, QUALITY } from "./audit-file.ts";
import { AUDIT_BUDGET, type AuditOptions } from "./manage-options.ts";
import { stats } from "./stats.ts";

// The audit (spec/roadmap.md, entry 62): the kind `audit`, read-only, with the auditor role and the audit criteria; every audit's
// prompt gets the commits since the last audit, the board digest, the stats and the open findings of its project; the schedule
// entry of `audit.at` and `audit.days`, which starts none on another day or with no commit since the last audit; the filing
// (audit-file.ts) and the procedure its end brings. docs/manage.md, "The audit".

const KIND = "audit";
const ROLE = "auditor";
export const AUDIT_TASK = "Audit the commits since the last audit, then the rest of the repository, as your role and the audit criteria say.";
// A commit that changes only the reports, as the procedure's commit of a NO PROPOSALS report does, is no commit to audit.
const AUDITED_PATHS = ["--", ".", `:(exclude)${QUALITY}`];
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
	host.jobs.registerKind({ name: KIND, readOnly: true, role: ROLE, budgetUsd: options?.budgetUsd ?? AUDIT_BUDGET, resumeOnBudget: true, file: fileAudit });
	host.provide("prompt", (role: string, job: Job) => (role === ROLE ? context(host, job) : undefined));
	const procedure = new URL("../roles/coordinator/audit-ended.md", import.meta.url);
	host.provide("coordinator.wake", (job: { readonly kind?: unknown }) => (job.kind === KIND ? readFileSync(procedure, "utf8").trim() : undefined));
	if (options === undefined) return;
	const entry = { id: KIND, at: options.at, ...(options.days === undefined ? {} : { days: options.days }), option: "audit.at", run: () => nightly(host, options) };
	if (host.collect("schedule.register", host.name, [entry]).length === 0) throw new Error("audit.at needs the schedule plugin, which starts the audit; add schedule() to the config's plugins, or leave audit out");
}

// The commits to audit up to `head`, newest first, and what they are since: the last audit's commit, or the last 24 hours when
// no report names one, or it is no commit of the repository.
function since(root: string, head: string): { readonly last?: string; readonly heading: string; readonly commits: readonly string[] } {
	const last = lastAudit(root);
	const listed = last === undefined ? undefined : git(root, ["log", "--format=%h %s", `${last.commit}..${head}`, ...AUDITED_PATHS]);
	if (last !== undefined && listed !== undefined) return { last: last.commit, heading: `since the last audit, ${last.commit.slice(0, 12)} (${last.path})`, commits: lines(listed) };
	const why = last === undefined ? `no report in ${QUALITY}/ names an audited commit` : `${last.commit} of ${last.path} is no commit of this repository`;
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

// The schedule entry's run: an audit of the main project, none on a day not in `audit.days` (a late run of a missed day too) or
// with no commit since the last audit's.
async function nightly(host: Host, options: AuditOptions): Promise<void> {
	const day = host.clock.local().day;
	if (options.days !== undefined && !options.days.includes(day)) return console.log(`manage: audit: no job, ${day} is not in audit.days (${options.days.join(", ")})`);
	const [main] = host.board.projects();
	if (main === undefined) throw new Error("no project to audit");
	const head = git(main.path, ["rev-parse", "HEAD"])?.trim();
	if (head === undefined) throw new Error(`${main.path} has no HEAD to audit`);
	const { last, commits } = since(main.path, head);
	if (last !== undefined && commits.length === 0) return console.log(`manage: audit: no job, no commit since the last audit's ${last.slice(0, 12)}`);
	const job = await host.jobs.spawn({ task: AUDIT_TASK, kind: KIND, project: main.name, ...(options.model === undefined ? {} : { model: options.model }) });
	if (job.failed !== undefined) throw new Error(`job ${job.id} did not start: ${job.failed}`);
	console.log(`manage: audit: started job ${job.id}`);
}
