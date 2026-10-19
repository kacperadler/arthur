import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { queueLock } from "@arthur/core/lock";
import type { Host } from "@arthur/core/plugin";
import { section } from "./plans.ts";

// Autopilot (spec/roadmap.md, entry 29): `arthur ticket status <id> planned --autopilot [--budget <usd>]`, which the core hands
// to `ticket.autopilot`: a ticket pre-approved by policy instead of the owner's word. docs/commands/coordinator.md, "Autopilot".

// When `autopilot` leaves them out: the budget of a pre-approved ticket's worker, and the most `--budget` may give it.
export const AUTOPILOT_BUDGET = 1;
export const AUTOPILOT_CAP = 3;
const SCOPE_FILES = 3;
const KINDS = ["bug", "cleanup"];
// Under its Decisions, where the ticket came from: a finding of another ticket, or an audit's file.
const FINDING = /^- \d{4}-\d\d-\d\d: Source: (F(\d+) of ([A-Z]+\d{4,}))\s*$/;
const AUDIT = /^- \d{4}-\d\d-\d\d: Source: (audit (spec\/quality\/[\w.-]+\.md))\s*$/;
// A line number after a path in Scope (`file.ts:42`) is not part of it.
const LINE = /:\d+(-\d+)?$/;

export function autopilot(host: Host): void {
	const options = (host.options.autopilot ?? {}) as { readonly budgetUsd?: number; readonly budgetMaxUsd?: number };
	const cap = options.budgetMaxUsd ?? AUTOPILOT_CAP;
	host.provide("ticket.autopilot", async ({ id, budgetUsd = options.budgetUsd ?? AUTOPILOT_BUDGET }: { readonly id: string; readonly budgetUsd?: number }) => {
		// One pre-approval of a ticket at a time, across processes: the check, the record and the move are one step.
		const release = await queueLock(join(host.folder, `autopilot-${id.replace(/[^\w-]/g, "_")}.lock`));
		try {
			return await preApprove(host, id, budgetUsd, cap);
		} finally {
			release();
		}
	});
}

async function preApprove(host: Host, id: string, budgetUsd: number, cap: number): Promise<string> {
	const ticket = host.board.get(id);
	if (ticket === undefined) throw new Error(`${id} is not on the board`);
	const at = host.board.projects().find((each) => each.name === ticket.project)?.path ?? "";
	const file = join(at, ticket.path);
	const text = readFileSync(file, "utf8");
	const problems: string[] = [];
	if (ticket.status !== "planning") problems.push(`it is ${ticket.status}; autopilot pre-approves a ticket in planning`);
	const source = section(text, "Decisions").flatMap((line) => sourceOf(host, at, line) ?? []);
	if (source.length === 0) problems.push('it is not from a finding or an audit: no "- YYYY-MM-DD: Source: F<n> of <id>" or "Source: audit spec/quality/<file>.md" under its Decisions names one that exists');
	const kind = section(text, "Goal").flatMap((line) => /^- Kind:(.*)$/.exec(line)?.[1]?.trim() || [])[0];
	if (!KINDS.includes(kind ?? "")) problems.push(`its kind is ${kind ?? "missing (- Kind: under its Goal)"}; autopilot pre-approves only ${KINDS.join(" or ")}`);
	// A guidance comment of the template names no file the ticket changes.
	const scope = section(text.replace(/<!--[\s\S]*?-->/g, ""), "Scope");
	const out = scope.findIndex((line) => line.trim() === "Out:");
	const spans = scope.slice(0, out < 0 ? undefined : out).flatMap((line) => Array.from(line.matchAll(/`([^`]+)`/g), (match) => (match[1] ?? "").replace(LINE, "")));
	// A file is a backticked path without spaces that has a `/` or ends in `.<ext>`, each once.
	const files = [...new Set(spans.filter((span) => !/\s/.test(span) && (span.includes("/") || /\.[A-Za-z0-9]+$/.test(span))))];
	const loose = files.filter((path) => /[*?[{]/.test(path) || path.endsWith("/") || (existsSync(join(at, path)) && statSync(join(at, path)).isDirectory()));
	if (files.length === 0) problems.push("its Scope names no file (a backticked path before Out:)");
	if (files.length > SCOPE_FILES) problems.push(`its Scope names ${files.length} files, at most ${SCOPE_FILES}: ${files.join(", ")}`);
	if (loose.length > 0) problems.push(`its Scope names a folder or a pattern, not one file: ${loose.join(", ")}`);
	if (files.length > 0) problems.push(...(await alwaysReview(host, ticket.project, files)));
	if (!(typeof budgetUsd === "number" && Number.isFinite(budgetUsd) && budgetUsd > 0)) problems.push(`budget $${budgetUsd}; a pre-approved ticket needs a budget above 0 (--budget, or autopilot.budgetUsd)`);
	else if (budgetUsd > cap) problems.push(`budget $${budgetUsd} is over the cap of $${cap} (autopilot.budgetMaxUsd)`);
	if (problems.length > 0) throw new Error(`${id}: not pre-approved: ${problems.join("; ")}`);
	const plural = files.length === 1 ? "" : "s";
	const record = `Pre-approved by policy: ${kind} from ${source[0]}, ${files.length} Scope file${plural}, budget $${budgetUsd} of the $${cap} cap`;
	write(file, withDecision(text, `- ${host.clock.local().date}: ${record}`));
	try {
		host.board.move(id, "planned");
	} catch (error) {
		// The record goes only with the move: the ticket is as it was.
		write(file, text);
		throw error;
	}
	return `${id} planned: ${record}; spawn its worker with --budget ${budgetUsd}`;
}

// The source a Decisions line names, when what it names exists: the finding's `## F<n>.` heading in that ticket's findings.md,
// or the audit's file in this project.
function sourceOf(host: Host, at: string, line: string): string | undefined {
	const [, audit, path = ""] = AUDIT.exec(line) ?? [];
	if (audit !== undefined) return existsSync(join(at, path)) ? audit : undefined;
	const [, finding, n, id = ""] = FINDING.exec(line) ?? [];
	const from = host.board.get(id);
	if (finding === undefined || from === undefined) return undefined;
	const findings = join(host.board.projects().find((each) => each.name === from.project)?.path ?? "", dirname(from.path), "findings.md");
	return existsSync(findings) && readFileSync(findings, "utf8").split("\n").some((each) => each.startsWith(`## F${n}. `)) ? finding : undefined;
}

// Asked of delivery (`delivery.alwaysReview`, entry 53) with the project and the paths: those on its always-review list. Not
// provided (delivery off), or an answer of another shape, refuses rather than passes.
async function alwaysReview(host: Host, project: string, paths: readonly string[]): Promise<string[]> {
	let held: unknown;
	try {
		held = await host.call("delivery.alwaysReview", { project, paths });
	} catch (error) {
		return [`the always-review list was not asked (${error instanceof Error ? error.message : String(error)}); autopilot refuses rather than passes`];
	}
	if (!Array.isArray(held) || !held.every((path) => typeof path === "string")) return ["delivery.alwaysReview answered no list of paths; autopilot refuses rather than passes"];
	return held.length > 0 ? [`on delivery's always-review list: ${held.join(", ")}`] : [];
}

// The ticket's text with `line` after the last line of its Decisions.
function withDecision(text: string, line: string): string {
	const lines = text.split("\n");
	const start = lines.findIndex((each) => each.trimEnd() === "## Decisions");
	const next = lines.findIndex((each, at) => at > start && each.startsWith("## "));
	let end = next < 0 ? lines.length : next;
	while (end > start + 1 && (lines[end - 1] ?? "").trim() === "") end--;
	lines.splice(end, 0, line);
	return lines.join("\n");
}

// Written whole and renamed, so a reader never sees half of it.
function write(file: string, text: string): void {
	const draft = join(dirname(file), `.ticket.md.${process.pid}`);
	writeFileSync(draft, text);
	renameSync(draft, file);
}
