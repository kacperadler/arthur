import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Host } from "@arthur/core/plugin";
import { filePlan, filePlanReview } from "./plan-file.ts";

// Planning of large tickets (spec/roadmap.md, entry 28): the kinds `plan` and `plan-review` with their roles and filing, the
// refusals before a spawn, and the procedure the coordinator's wake carries when one ends: docs/commands/plan.md.

export const PLAN = "plan";
export const PLAN_REVIEW = "plan-review";
// A plan's budget when `plan.budgetUsd` is left out: plans of the harness Arthur replaces stopped at $2 twice.
export const PLAN_BUDGET = 5;
// The ticket a task's `Ticket:` path lies in, and its folder: `spec/features/<id>-<slug>/...`.
const FEATURE = /(?:^|\/)(spec\/features\/([A-Z]+\d{4,})-[^/]+)\//;
const TICKET = /^spec\/features\/[A-Z]+\d{4,}-[^/]+\/ticket\.md$/;
// Under a ticket's Goal: it gets a plan the owner approves before a worker.
const MARK = /^- Plan: yes\s*$/;
// Under its Decisions: the owner's approval of the plan.md that commit holds.
const APPROVED = /^- \d{4}-\d\d-\d\d: Plan approved by the owner: plan\.md at ([0-9a-f]{7,40})\b/;
// Under its Decisions: autopilot's record (autopilot.ts) with the budget it checked, and an approval the owner gave after it.
const PRE_APPROVED = /^- \d{4}-\d\d-\d\d: Pre-approved by policy: .*, budget \$(\d+(?:\.\d+)?) of the \$\S+ cap\s*$/;
const OWNER = /^- \d{4}-\d\d-\d\d: .*\b(?:the owner approved|approved by the owner)\b/i;

export function plans(host: Host): void {
	const budgetUsd = (host.options.plan as { readonly budgetUsd?: number } | undefined)?.budgetUsd ?? PLAN_BUDGET;
	host.jobs.registerRole({ name: "planner", file: new URL("../roles/planner.md", import.meta.url), criteria: ["styleguide"] });
	host.jobs.registerRole({ name: "plan-reviewer", file: new URL("../roles/plan-reviewer.md", import.meta.url), criteria: ["styleguide"] });
	host.jobs.registerKind({ name: PLAN, readOnly: true, role: "planner", budgetUsd, resumeOnBudget: true, file: filePlan });
	host.jobs.registerKind({ name: PLAN_REVIEW, readOnly: true, role: "plan-reviewer", file: filePlanReview });
	host.jobs.beforeSpawn(({ kind, project, task, tickets, budgetUsd, free }) => {
		const plan = kind === PLAN || kind === PLAN_REVIEW;
		if (!plan && (kind !== "worker" || tickets.length === 0)) return undefined;
		// Only once a task names a ticket: the board needs the project list.
		const at = () => host.board.projects().find((each) => each.name === project)?.path ?? "";
		return plan ? planTicket(host, kind, at, tickets) : unapproved(at(), task, tickets, budgetUsd, free);
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

// A worker on a ticket with `- Plan: yes` under its Goal needs the plan the owner approved: committed at HEAD, the same plan.md
// as at the commit a Decisions line names, and named on the task's `Plan:` line, so the worker follows it. A worker, or a
// continue, on a ticket pre-approved by policy is held to its budget (overBudget) until the owner approves it.
function unapproved(at: string, task: string, tickets: readonly string[], budgetUsd: number, free: boolean): string | undefined {
	// Each ticket's folder once, with its id.
	const folders = new Map(tickets.map((path) => FEATURE.exec(path)?.slice(1, 3) ?? []).flatMap(([folder, id]) => (folder === undefined || id === undefined ? [] : [[folder, id] as const])));
	const planned = new Set(Array.from(task.matchAll(/\bPlan:\s*`?([^\s`]+)/g), (match) => (match[1] ?? "").replace(/[.,;:!?)]+$/, "")));
	const refused = [...folders].flatMap(([folder, id]) => {
		const shown = spawnSync("git", ["-C", at, "cat-file", "blob", `HEAD:${folder}/ticket.md`], { encoding: "utf8" });
		if (shown.status !== 0) return [];
		const decisions = section(shown.stdout, "Decisions");
		return [section(shown.stdout, "Goal").some((line) => MARK.test(line)) ? unplanned(at, folder, id, decisions, planned) : undefined, overBudget(id, decisions, budgetUsd, free)].flatMap((reason) => reason ?? []);
	});
	return refused.length > 0 ? refused.join("; ") : undefined;
}

// Why a worker may not start yet on a `- Plan: yes` ticket, if it may not.
function unplanned(at: string, folder: string, id: string, decisions: readonly string[], planned: ReadonlySet<string>): string | undefined {
	const plan = `${folder}/plan.md`;
	const now = blob(at, "HEAD", plan);
	if (now === undefined) return `${id} says "- Plan: yes" and has no committed plan.md; plan it first: arthur spawn --kind plan 'Ticket: ${folder}/ticket.md', then the owner's ok`;
	const commits = decisions.flatMap((line) => APPROVED.exec(line)?.[1] ?? []);
	if (!commits.some((commit) => blob(at, commit, plan) === now))
		return `${id}: its plan.md at HEAD is not one the owner approved: no "- YYYY-MM-DD: Plan approved by the owner: plan.md at <commit>" under its Decisions names a commit with this plan.md`;
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
	const parsed = spawnSync("git", ["-C", at, "rev-parse", "--verify", "--quiet", `${commit}:${path}`], { encoding: "utf8" });
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
