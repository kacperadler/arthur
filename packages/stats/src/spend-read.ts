import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { addUsage, readLines, type Usage } from "./stats-lines.ts";

// What `arthur stats` and `/stats` read (spec/roadmap.md, entry 111): each line of `runs.jsonl` and `sessions/*.jsonl` in the
// span `--since` names, narrowed by the other filters; a line with no time it can read counts as unread. docs/commands/stats.md.

type Clock = Host["clock"];
// One job run or coordinator turn. A run's role is its job's kind, a turn's its session's name; `sub` a subagent's turn.
export type Spent = { readonly [key in "role" | "project" | "state" | "reason"]: string } & { readonly [key in "time" | "seconds" | "cost"]: number } &
	{ readonly [key in "turn" | "sub" | "missing"]: boolean } & { readonly tickets: readonly string[]; readonly usage: Usage };
// From the start of the local day `date`, or from the instant `at`; `label` says which.
export type Since = { readonly date?: string; readonly at?: number; readonly label: string };
export type Filter = { readonly since: Since; readonly project?: string; readonly role?: string; readonly ticket?: string; readonly model?: string };

const DAY_MS = 86_400_000;

// `today`, `yesterday`, `<n>d` (the last n times 24 hours, n from 1 to 99999) or a real `YYYY-MM-DD`, in `core.timeZone`.
export function parseSince(word: string, clock: Clock): Since | undefined {
	const today = clock.local().date;
	if (word === "today") return { date: today, label: `since ${today} (today)` };
	const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
	if (word === "yesterday") return { date: yesterday, label: `since ${yesterday} (yesterday)` };
	const days = /^([1-9]\d{0,4})d$/.exec(word)?.[1];
	if (days !== undefined) {
		const at = clock.now().getTime() - Number(days) * DAY_MS;
		const { date, time } = clock.local(new Date(at));
		return { at, label: `since ${date} ${time} (${days} day${days === "1" ? "" : "s"})` };
	}
	const parsed = Date.parse(`${word}T00:00:00Z`);
	const real = /^\d{4}-\d{2}-\d{2}$/.test(word) && !Number.isNaN(parsed) && new Date(parsed).toISOString().startsWith(word);
	return real ? { date: word, label: `since ${word}` } : undefined;
}

export const inSpan = (since: Since, clock: Clock, time: number): boolean => (since.at === undefined ? clock.local(new Date(time)).date >= (since.date ?? "") : time >= since.at);

export function readSpend(folder: string, clock: Clock, filter: Filter): { readonly spent: Spent[]; readonly unread: number } {
	const unread = { lines: 0 };
	const sessions = join(folder, "sessions");
	const names = existsSync(sessions) ? readdirSync(sessions).filter((name) => name.endsWith(".jsonl")) : [];
	const text = (value: unknown) => (typeof value === "string" ? value : "");
	const read = (file: string, turn: boolean) =>
		readLines(file, unread).flatMap((line): Spent[] => {
			const time = Date.parse(String(line.time));
			if (Number.isNaN(time)) return (unread.lines++, []);
			const tickets = Array.isArray(line.tickets) ? line.tickets.filter((id): id is string => typeof id === "string") : [];
			const [role = "", project = "", state = "", reason = ""] = [turn ? line.session : line.kind, line.project, line.state, line.reason].map(text);
			const [seconds, cost] = [Number(line.seconds) || 0, Number(line.cost) || 0];
			return [{ time, role, project, state, reason, tickets, turn, sub: line.sub === true, missing: line.missing === true, seconds, cost, usage: addUsage({}, line.usage) }];
		});
	const all = [...read(join(folder, "runs.jsonl"), false), ...names.flatMap((name) => read(join(sessions, name), true))];
	const kept = all.flatMap((one) => {
		if (!inSpan(filter.since, clock, one.time)) return [];
		if ((filter.project !== undefined && one.project !== filter.project) || (filter.role !== undefined && one.role !== filter.role)) return [];
		if (filter.ticket !== undefined && !one.tickets.includes(filter.ticket)) return [];
		if (filter.model === undefined) return [one];
		const used = one.usage[filter.model];
		return used === undefined ? [] : [{ ...one, cost: used.cost, usage: { [filter.model]: used } }];
	});
	return { spent: kept.toSorted((a, b) => a.time - b.time), unread: unread.lines };
}
