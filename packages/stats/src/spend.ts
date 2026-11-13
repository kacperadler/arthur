import type { Host, Ticket } from "@arthur/core/plugin";
import { type Filter, inSpan, readSpend, type Spent } from "./spend-read.ts";
import type { Usage } from "./stats-lines.ts";

// `arthur stats` and `/stats` (spec/roadmap.md, entry 111): the spend of the job runs and coordinator turns in a span, at list
// price: the total, by role, project, model and day, the most expensive tickets, whether it pays, and what is unknown; `short`
// (`/stats`) the total, by role and the top 3 tickets; with a ticket, its runs one per line. docs/commands/stats.md.

type From = Pick<Host, "folder" | "clock" | "board">;
type Fields = Usage[string];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const money = (usd: number) => `$${usd.toFixed(2)}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const percent = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;
const cost = (rows: readonly { readonly cost: number }[]) => rows.reduce((sum, row) => sum + row.cost, 0);
// A run that failed, was stopped, or was stopped at a limit (`arthur spawn --help`, the end's reasons); a turn has no reason.
const failed = (row: Spent) => /^(?:failed|stopped|limit:)/.test(row.reason);

const hours = (seconds: number) => `${Math.floor(seconds / 3600)}h${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m`;

function tokens(usages: readonly Fields[]): string {
	const sum = (key: "input" | "output" | "cacheRead" | "cacheWrite") => compact.format(usages.reduce((all, used) => all + used[key], 0));
	return `${sum("input")} in, ${sum("output")} out, ${sum("cacheRead")} cache read, ${sum("cacheWrite")} cache write`;
}

// Runs, how many of them failed or were stopped, and turns; a subagent's turn is part of its session's.
function counts(rows: readonly Spent[]): string {
	const runs = rows.filter((row) => !row.turn);
	const turns = rows.filter((row) => row.turn && !row.sub).length;
	const said = runs.length > 0 ? [`${plural(runs.length, "run")} (${runs.filter(failed).length} failed or stopped)`] : [];
	return [...said, ...(turns > 0 || runs.length === 0 ? [plural(turns, "turn")] : [])].join(", ");
}

// A titled list, one line per name `key` gives: its cost and share of `all`, then `more`; the most expensive first, by name when `ordered`.
function by<T extends { readonly cost: number }>(title: string, rows: readonly T[], key: (row: T) => string, all: number, more: (rows: T[], spent: number) => string, ordered = false): string[] {
	const groups = [...Map.groupBy(rows, key)].map(([name, its]) => ({ name, its, spent: cost(its) }));
	const sorted = groups.toSorted((a, b) => (ordered ? 0 : b.spent - a.spent) || (a.name < b.name ? -1 : 1));
	return [`${title}:`, ...sorted.map(({ name, its, spent }) => `- ${name}: ${money(spent)} (${percent(spent, all)})${more(its, spent)}`)];
}

function ticketOf(host: From, id: string): Ticket | undefined {
	try {
		return host.board.get(id);
	} catch {
		// A board broken by hand costs its status only, not the view.
		return undefined;
	}
}

// Each ticket's share of each run that names it: a run naming several gives each an equal share.
const shares = (rows: readonly Spent[]) => rows.flatMap((row) => row.tickets.map((id) => ({ id, role: row.role, cost: row.cost / row.tickets.length })));

function topTickets(host: From, rows: readonly Spent[], count: number): string[] {
	const ranked = [...Map.groupBy(shares(rows), (share) => share.id)].map(([id, its]) => ({ id, its, spent: cost(its) }));
	const top = ranked.toSorted((a, b) => b.spent - a.spent || (a.id < b.id ? -1 : 1)).slice(0, count);
	if (top.length === 0) return ["Most expensive tickets: none"];
	const split = (its: { readonly role: string; readonly cost: number }[]) =>
		[...Map.groupBy(its, (share) => share.role)].map(([role, part]) => ({ role, spent: cost(part) })).toSorted((a, b) => b.spent - a.spent).map(({ role, spent }) => `${role} ${money(spent)}`);
	return ["Most expensive tickets:", ...top.map(({ id, its, spent }) => `- ${id} (${ticketOf(host, id)?.status ?? "status unknown"}): ${money(spent)}: ${split(its).join(", ")}`)];
}

function pays(host: From, filter: Filter, rows: readonly Spent[]): string[] {
	const tickets = new Map(shares(rows).map(({ id }) => [id, ticketOf(host, id)]));
	const on = (test: (ticket: Ticket) => boolean) => cost(shares(rows).filter(({ id }) => { const ticket = tickets.get(id); return ticket !== undefined && test(ticket); }));
	const merged = (ticket: Ticket) => ticket.status === "merged" && inSpan(filter.since, host.clock, Date.parse(ticket.updated));
	const count = [...tickets.values()].filter((ticket) => ticket !== undefined && merged(ticket)).length;
	const stopped = rows.filter(failed);
	return [
		"Whether it pays:",
		`- on ${plural(count, "ticket")} merged ${filter.since.label}: ${money(on(merged))}, ${money(count > 0 ? on(merged) / count : 0)} per ticket`,
		`- on dropped tickets: ${money(on((ticket) => ticket.status === "dropped"))}`,
		`- on runs that failed or were stopped: ${money(cost(stopped))} in ${plural(stopped.length, "run")}`,
		`- on work with no ticket (the coordinator, audits): ${money(cost(rows.filter((row) => row.tickets.length === 0)))}`,
	];
}

function ticketRuns(host: From, filter: Filter, rows: readonly Spent[], scope: string): string {
	const runs = rows.map((row) => {
		const { date, time } = host.clock.local(new Date(row.time));
		const share = row.tickets.length > 1 ? `${money(row.cost / row.tickets.length)} (its share of ${money(row.cost)}, ${row.tickets.length} tickets)` : money(row.cost);
		const models = Object.keys(row.usage).join("+") || "model not recorded";
		return `- ${date} ${time} ${row.role}, ${models}, ${row.state}: ${row.reason}, ${share}, ${tokens(Object.values(row.usage))}, ${hours(row.seconds)}`;
	});
	const spent = cost(rows.map((row) => ({ cost: row.cost / row.tickets.length })));
	return [`Runs of ${filter.ticket} ${filter.since.label}, ${scope}: ${money(spent)} at list price, ${plural(rows.length, "run")}`, ...runs].join("\n");
}

export function spend(host: From, filter: Filter, short = false): string {
	const { spent: rows, unread } = readSpend(host.folder, host.clock, filter);
	const scope = [filter.project === undefined ? "every project" : `project ${filter.project}`, ...(filter.role === undefined ? [] : [`role ${filter.role}`]), ...(filter.model === undefined ? [] : [`model ${filter.model}`])].join(", ");
	const unknown = `Unknown: ${plural(rows.filter((row) => row.missing).length, "run")} whose record was gone, ${plural(unread, "line")} not read`;
	if (filter.ticket !== undefined) return ticketRuns(host, filter, rows, scope);
	if (rows.length === 0) return [`No job run or coordinator turn ${filter.since.label}, ${scope}.`, ...(unread > 0 ? [unknown] : [])].join("\n");
	const all = cost(rows);
	const seconds = rows.reduce((sum, row) => sum + (row.sub ? 0 : row.seconds), 0);
	const total = [`Spend ${filter.since.label}, ${scope}: ${money(all)} at list price, ${counts(rows)}, ${hours(seconds)}`, `Tokens: ${tokens(rows.flatMap((row) => Object.values(row.usage)))}`];
	const roles = by("By role", rows, (row) => row.role, all, (its) => `, ${counts(its)}`);
	if (short) return [...total, ...roles, ...topTickets(host, rows, 3)].join("\n");
	const models = rows.flatMap((row) => (Object.keys(row.usage).length === 0 ? (row.missing ? [] : [{ model: "not recorded", cost: row.cost, used: [] }]) : Object.entries(row.usage).map(([model, used]) => ({ model, cost: used.cost, used: [used] }))));
	return [
		...total,
		...roles,
		...by("By project", rows, (row) => row.project || "no project", all, (its) => `, ${counts(its)}`),
		...by("By model", models, (part) => part.model, all, (its, spent) => `${spent === 0 ? ", free" : ""}, ${tokens(its.flatMap((part) => part.used))}`),
		...by("By day", rows, (row) => host.clock.local(new Date(row.time)).date, all, (its) => `, ${counts(its)}`, true),
		...topTickets(host, rows, 5),
		...pays(host, filter, rows),
		unknown,
	].join("\n");
}
