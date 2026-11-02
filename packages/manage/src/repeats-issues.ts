import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Project, Ticket } from "@arthur/core/plugin";
import type { Ask } from "./repeats.ts";

// The recurring issues of `arthur repeats` (AR0562), from the ticket history: tickets made from findings and their longest
// chain, tickets with 2 or more FAIL reviews, the questions of jobs blocked on the owner by cause, the line budgets per package
// under the tickets' Decisions, and the drops by source; with the few helpers both halves of the digest share.
// docs/commands/repeats.md, "Recurring issues".

const SOURCE = /^.*Source: F\d+ of ([A-Z]+\d+)/m;
const REVIEW = /^review-\d+\.md$/;
const TOP = 5;

export const share = (part: number, whole: number) => `${part} of ${whole}${whole === 0 ? "" : ` (${((part / whole) * 100).toFixed(1)}%)`}`;
export const counted = (counts: ReadonlyMap<string, number>) => [...counts].map(([name, count]) => `${name} ${count}`).join(", ") || "none";
export const examples = (ids: readonly string[]) => (ids.length <= 6 ? ids : [...ids.slice(0, 4), "…", ids.at(-1)]).join(", ");
export function cut(text: string, most = 100): string {
	const line = text.replace(/\s+/g, " ").trim();
	return line.length > most ? `${line.slice(0, most - 1)}…` : line;
}
export function tally<T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, number> {
	const counts = new Map<string, number>();
	for (const item of items) {
		const name = key(item);
		if (name !== undefined) counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return counts;
}

// The section: the tickets made on `day` or later (their JSON block's `date`), every one when undefined; `asks` the questions
// of the period, whose blocked jobs it counts.
export function issues(where: Project, tickets: readonly Ticket[], asks: readonly Ask[], day: string | undefined): string {
	const text = new Map(tickets.map((ticket) => [ticket.id, existsSync(join(where.path, ticket.path)) ? readFileSync(join(where.path, ticket.path), "utf8") : ""]));
	const made = tickets.filter((ticket) => day === undefined || (/^\s*"date":\s*"(\d{4}-\d{2}-\d{2})"/m.exec(text.get(ticket.id) ?? "")?.[1] ?? "") >= day);
	const source = (id: string) => SOURCE.exec(text.get(id) ?? "")?.[1];
	// A finding's chain, from the ticket back to the first one; a loop a hand edit made ends it.
	const chain = (id: string) => {
		const links = [id];
		for (let next = source(id); next !== undefined && !links.includes(next); next = source(next)) links.push(next);
		return links;
	};
	const longest = made.map((ticket) => chain(ticket.id)).reduce<string[]>((best, links) => (links.length > best.length ? links : best), []);
	const fails = made.flatMap((ticket) => {
		const folder = join(where.path, dirname(ticket.path));
		const count = existsSync(folder) ? readdirSync(folder).filter((name) => REVIEW.test(name) && /^- Verdict: FAIL$/m.test(readFileSync(join(folder, name), "utf8"))).length : 0;
		return count >= 2 ? [[ticket.id, count] as const] : [];
	});
	const blocked = asks.filter((ask) => ask.kind === "job" && ask.job !== undefined);
	const cause = (ask: Ask) => (/\bline budget|\bbudget\b/i.test(ask.question) ? "line budget" : /\b\d+-line\b|\bfile size\b/i.test(ask.question) ? "file size" : "other");
	const causes = [...Map.groupBy(blocked, cause)].map(([name, list]) => `${name} ${list.length} (${examples(list.map((ask) => ask.id))})`);
	const packages = existsSync(join(where.path, "packages")) ? readdirSync(join(where.path, "packages"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
	const named = new RegExp(`\\b(${packages.map((name) => name.replace(/[^\w-]/g, "")).join("|")})(?: line)?(?: budget)?:? (?:from |to |by )?\\+?\\d{2,}`, "g");
	const budgets = tally(
		made.flatMap((ticket) => {
			const decisions = (text.get(ticket.id) ?? "").split(/^## Decisions[ \t]*$/m)[1]?.split(/^## /m)[0] ?? "";
			const lines = decisions.split("\n").filter((line) => /budget/i.test(line));
			return packages.length === 0 ? [] : [...new Set(lines.flatMap((line) => Array.from(line.matchAll(named), (found) => found[1] ?? "")))];
		}),
		(name) => name,
	);
	const dropped = made.filter((ticket) => ticket.status === "dropped");
	return [
		"## Recurring issues",
		[
			`- Tickets from findings: ${share(made.filter((ticket) => source(ticket.id) !== undefined).length, made.length)} come from a finding (\`Source: F<n> of <ticket>\`)${longest.length < 2 ? "" : `; the longest chain, ${longest.length - 1} deep: ${longest.join(" ← ")}`}`,
			`- Tickets with 2 or more FAIL reviews: ${fails.length}${fails.length === 0 ? "" : `; most: ${fails.toSorted((a, b) => b[1] - a[1]).slice(0, TOP).map(([id, count]) => `${id} ${count}`).join(", ")}`}`,
			`- Jobs blocked on the owner: ${blocked.length} question${blocked.length === 1 ? "" : "s"}${causes.length === 0 ? "" : `: ${causes.join(", ")}`}`,
			`- Line budgets under the tickets' Decisions, tickets per package: ${packages.length === 0 ? "no packages/ folder" : [...budgets].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(", ") || "none"}`,
			`- Drops: ${dropped.length} tickets${dropped.length === 0 ? "" : `: from a finding ${dropped.filter((ticket) => source(ticket.id) !== undefined).length}, other ${dropped.filter((ticket) => source(ticket.id) === undefined).length}`}`,
		].join("\n"),
	].join("\n\n");
}
