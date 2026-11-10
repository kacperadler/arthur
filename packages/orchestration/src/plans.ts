import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Host, Project } from "@arthur/core/plugin";
import { decisions, readLog } from "./decision-log.ts";
import { filePlan, filePlanReview } from "./plan-file.ts";

// Planning of large tickets (spec/roadmap.md, entry 28): the kinds `plan` and `plan-review` with their roles and filing, the
// refusals before a spawn, and the procedure the coordinator's wake carries when one ends: docs/commands/plan.md.

export const PLAN = "plan";
const PLAN_REVIEW = "plan-review";
// A plan's budget when `plan.budgetUsd` is left out: plans of the harness Arthur replaces stopped at $2 twice.
export const PLAN_BUDGET = 5;
// The ticket a task's `Ticket:` path lies in, and its folder: `spec/features/<id>-<slug>/...`.
const FEATURE = /(?:^|\/)(spec\/features\/([A-Z]+\d{4,})-[^/]+)\//;
const TICKET = /^spec\/features\/[A-Z]+\d{4,}-[^/]+\/ticket\.md$/;
// Under a ticket's Goal: it gets a plan the owner approves before a worker; any spelling, case or language but `- Plan: yes` is refused.
const MARK = /^\s*(?:[-*+–]|\d+[.)])\s*\**plan\**\s*:/i;
// Under its Decisions: the owner's approval of the plan.md that commit holds, with the decision id `arthur decision answer` wrote
// at its end (a cut line's too); and that answer's decision as the log holds it.
const APPROVED = /^- \d{4}-\d\d-\d\d: Plan approved by the owner: plan\.md at ([0-9a-f]{7,40})\b(?:.*\(([A-Z]+-D\d+)\b[^()]*\)\s*$)?/;
const DECIDED = /^Plan approved by the owner: plan\.md at ([0-9a-f]{7,40})\b/;
// Under its Decisions: autopilot's record (autopilot.ts) with the budget it checked, and an approval the owner gave after it.
const PRE_APPROVED = /^- \d{4}-\d\d-\d\d: Pre-approved by policy: .*, budget \$(\d+(?:\.\d+)?) of the \$\S+ cap\s*$/;
const OWNER = /^- \d{4}-\d\d-\d\d: .*\b(?:the owner approved|approved by the owner)\b/i;

export function plans(host: Host): void {
	const budgetUsd = (host.options.plan as { readonly budgetUsd?: number } | undefined)?.budgetUsd ?? PLAN_BUDGET;
	host.jobs.registerRole({ name: "planner", file: new URL("../roles/planner.md", import.meta.url), criteria: ["styleguide"] });
	host.jobs.registerRole({ name: "plan-reviewer", file: new URL("../roles/plan-reviewer.md", import.meta.url), criteria: ["styleguide"] });
	host.jobs.registerKind({ name: PLAN, readOnly: true, role: "planner", budgetUsd, resumeOnBudget: true, file: filePlan });
	host.jobs.registerKind({ name: PLAN_REVIEW, readOnly: true, role: "plan-reviewer", verdicts: ["PASS", "FAIL"], file: filePlanReview });
	host.jobs.beforeSpawn(({ kind, project, task, tickets, budgetUsd, free }) => {
		const plan = kind === PLAN || kind === PLAN_REVIEW;
		if (!plan && (kind !== "worker" || tickets.length === 0)) return undefined;
		// Only once a task names a ticket: the board needs the project list.
		const where = host.board.projects().find((each) => each.name === project);
		return plan ? planTicket(host, kind, () => where?.path ?? "", tickets) : unapproved(where, task, tickets, budgetUsd, free);
	});
	const procedure = new URL("../roles/coordinator/plan-ended.md", import.meta.url);
	host.provide("coordinator.wake", (job: { readonly kind?: unknown }) => (job.kind === PLAN || job.kind === PLAN_REVIEW ? readFileSync(procedure, "utf8").trim() : undefined));
}

// A plan or a plan review names its one ticket as `Ticket: spec/features/<id>-<slug>/ticket.md`, so placement reads the ticket's
// labels; a plan review needs the ticket's committed plan.md.
function planTicket(host: Host, kind: string, at: () => string, tickets: readonly string[]): string | undefined {
	const [path = ""] = tickets;
	if (tickets.length !== 1 || !TICKET.test(path))
		return `a ${kind} job names its one ticket on a line Ticket: spec/features/<id>-<slug>/ticket.md; its task names ${tickets.length === 0 ? "none" : tickets.join(", ")}`;
	const [, folder = "", id = ""] = FEATURE.exec(path) ?? [];
	if (host.board.get(id) === undefined) return `${id} is not on the board`;
	if (kind === PLAN_REVIEW && blob(at(), "HEAD", `${folder}/plan.md`) === undefined)
		return `${id} has no committed plan.md to review; file its plan first (arthur ticket file ${id} <plan job>) and commit it`;
	return undefined;
}

// A worker, or a continue, on a ticket with a Plan line under its Goal needs the plan the owner approved: committed at HEAD as at the
// commit a Decisions line names, and on the task's `Plan:` line; one pre-approved by policy, its budget (overBudget) until the owner's ok.
function unapproved(where: Project | undefined, task: string, tickets: readonly string[], budgetUsd: number, free: boolean): string | undefined {
	const at = where?.path ?? "";
	const folders = new Map(tickets.map((path) => FEATURE.exec(path)?.slice(1, 3) ?? []).flatMap(([folder, id]) => (folder === undefined || id === undefined ? [] : [[folder, id] as const])));
	const planned = new Set(Array.from(task.matchAll(/\bPlan:\s*`?([^\s`]+)/g), (match) => (match[1] ?? "").replace(/[.,;:!?)]+$/, "")));
	const refused = [...folders].flatMap(([folder, id]) => {
		const shown = spawnSync("git", ["--no-replace-objects", "-C", at, "cat-file", "blob", `HEAD:${folder}/ticket.md`], { encoding: "utf8" });
		if (shown.status !== 0) return [];
		const decisions = section(shown.stdout, "Decisions"), marks = section(shown.stdout, "Goal").filter((line) => MARK.test(line));
		return [marks.length > 0 && where !== undefined ? unplanned(where, folder, id, decisions, planned, marks) : undefined, overBudget(id, decisions, budgetUsd, free)].flatMap((reason) => reason ?? []);
	});
	return refused.length > 0 ? refused.join("; ") : undefined;
}

// Why a worker may not start yet on a ticket with Plan lines (`marks`) under its Goal, if it may not; any but `- Plan: yes` first (AR0608).
// The approval of this plan.md counts only as its decision in the log: a plan question of this ticket whose later answer is the
// owner's own, naming his message (AR0664), and approves the same commit (AR0665), so a line written by hand does not.
function unplanned(where: Project, folder: string, id: string, lines: readonly string[], planned: ReadonlySet<string>, marks: string[]): string | undefined {
	for (const line of marks) if (line.trimEnd() !== "- Plan: yes") return `${id}: its Goal line "${line.trim()}" is not "- Plan: yes", the one accepted form`;
	const plan = `${folder}/plan.md`;
	const now = blob(where.path, "HEAD", plan);
	if (now === undefined) return `${id} says "- Plan: yes" and has no committed plan.md; plan it first: arthur spawn --kind plan 'Ticket: ${folder}/ticket.md', then the owner's ok`;
	const approvals = lines.map((line) => APPROVED.exec(line)).filter((match): match is RegExpExecArray => match !== null && blob(where.path, match[1] ?? "", plan) === now);
	if (approvals.length === 0)
		return `${id}: its plan.md at HEAD is not one the owner approved: no "- YYYY-MM-DD: Plan approved by the owner: plan.md at <commit>" under its Decisions names a commit with this plan.md`;
	const log = decisions(readLog(where));
	const proved = approvals.some(([, commit, decision]) => {
		const found = log.find((each) => each.ask.id === decision);
		const answer = found?.answers.at(-1);
		return found?.ask.kind === "plan" && found.ask.ticket === id && answer?.message !== undefined && DECIDED.exec(answer.decided)?.[1] === commit;
	});
	if (!proved)
		return `${id}: the approval of its plan.md (${approvals.map(([, , decision]) => decision ?? "no decision id").join(", ")}) is no plan decision of ${id} in the decision log that the owner answered in his own message, approving that commit; ask him: arthur decision ask --kind plan --ticket ${id}`;
	return planned.has(plan) ? undefined : `${id}: the task needs the line Plan: ${plan}, so the worker follows the approved plan`;
}

// The last `Pre-approved by policy` line's budget, above 0 (0 on a free model, which spends nothing), unless the owner approved after it.
function overBudget(id: string, decisions: readonly string[], budgetUsd: number, free: boolean): string | undefined {
	const at = decisions.findLastIndex((line) => PRE_APPROVED.test(line));
	if (at < 0 || decisions.slice(at + 1).some((line) => OWNER.test(line))) return undefined;
	const held = Number(PRE_APPROVED.exec(decisions[at] ?? "")?.[1]);
	if ((budgetUsd > 0 || free) && budgetUsd <= held) return undefined;
	return `${id} is pre-approved by policy with a budget of $${held}; its worker gets at most that, above 0, not $${budgetUsd}${budgetUsd === 0 ? " (no limit)" : ""}: --budget ${held}, or the owner's approval under its Decisions ("- YYYY-MM-DD: The owner approved ...")`;
}

// The object id of `path` in `commit`, undefined when it has none there.
function blob(at: string, commit: string, path: string): string | undefined {
	const parsed = spawnSync("git", ["--no-replace-objects", "-C", at, "rev-parse", "--verify", "--quiet", `${commit}:${path}`], { encoding: "utf8" });
	return parsed.status === 0 ? parsed.stdout.trim() : undefined;
}

// The lines of a ticket.md's `## <name>` section, up to the next `## ` heading; autopilot.ts reads its sections with it too.
export function section(text: string, name: string): string[] {
	const lines = text.split("\n");
	const start = lines.findIndex((line) => line.trimEnd() === `## ${name}`);
	if (start < 0) return [];
	const end = lines.findIndex((line, at) => at > start && line.startsWith("## "));
	return lines.slice(start + 1, end < 0 ? undefined : end);
}
