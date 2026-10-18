import { isAbsolute, normalize, sep } from "node:path";
import { describe } from "@arthur/core";
import { clock, type Day } from "@arthur/core/clock";
import type { OptionProblem } from "@arthur/core/plugin";

// One schedule entry (spec/roadmap.md, entry 39), from the config or the `file` option: a daily "HH:MM", only on `days` when
// given, or a one-off "YYYY-MM-DDTHH:MM", in core.timeZone; it does an action (a message to the coordinator, with the text of
// a procedure file under it) or a job (a spawn): docs/commands/schedule.md.
export type Action = { readonly message: string; readonly procedure?: string };
export type JobEntry = { readonly task: string; readonly kind?: string; readonly project?: string };
export type Entry = { readonly id: string; readonly at: string; readonly days?: readonly Day[]; readonly action?: Action; readonly job?: JobEntry };

const ID = /^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$/;
const DAILY = /^([01]\d|2[0-3]):[0-5]\d$/;
const ONE_OFF = /^(\d{4}-\d{2}-\d{2})T(([01]\d|2[0-3]):[0-5]\d)$/;
const DAYS: readonly unknown[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const HOUR = 3_600_000;

type Fields = Readonly<Record<string, unknown>>;
export const isObject = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
export const isId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

// What keeps `entry` from running, each problem's path under `path` ("entries[0]", or "" for an entry of the file).
export function entryProblems(entry: unknown, path: string): OptionProblem[] {
	const under = (key: string) => (path === "" ? key : `${path}.${key}`);
	if (!isObject(entry)) return [{ path, problem: `expected an entry { id, at, action or job }, got ${describe(entry)}` }];
	const { id, at, days, action, job, ...unknown } = entry;
	const problems: OptionProblem[] = Object.keys(unknown).map((key) => ({ path: under(key), problem: "unknown key; keys: id, at, days, action, job" }));
	if (!isId(id)) problems.push({ path: under("id"), problem: `expected letters and digits, joined by single dots, dashes or underscores, got ${describe(id)}` });
	const once = typeof at === "string" ? ONE_OFF.exec(at) : null;
	if (!(typeof at === "string" && DAILY.test(at)) && !(once !== null && realDate(once[1] as string)))
		problems.push({ path: under("at"), problem: `expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got ${describe(at)}` });
	if (days !== undefined && once !== null) problems.push({ path: under("days"), problem: "a one-off entry takes no days" });
	else if (days !== undefined && !(Array.isArray(days) && days.length > 0 && days.every((day) => DAYS.includes(day))))
		problems.push({ path: under("days"), problem: `expected a non-empty list of ${DAYS.join(", ")}, got ${describe(days)}` });
	if ((action === undefined) === (job === undefined)) problems.push({ path: under("action"), problem: "expected either action or job" });
	if (action !== undefined) problems.push(...fieldProblems(action, under("action"), { message: true, procedure: false }));
	if (job !== undefined) problems.push(...fieldProblems(job, under("job"), { task: true, kind: false, project: false }));
	const procedure = isObject(action) ? action.procedure : undefined;
	if (typeof procedure === "string" && procedure.trim() !== "" && !markdownInside(procedure))
		problems.push({ path: under("action.procedure"), problem: `expected the relative path of a .md file inside the folder arthur runs in, got ${describe(procedure)}` });
	return problems;
}

// An object of non-empty strings, `true` the keys it needs.
function fieldProblems(value: unknown, path: string, keys: Readonly<Record<string, boolean>>): OptionProblem[] {
	if (!isObject(value)) return [{ path, problem: `expected an object with ${Object.keys(keys).join(", ")}, got ${describe(value)}` }];
	const problems = Object.keys(value)
		.filter((key) => !(key in keys))
		.map((key) => ({ path: `${path}.${key}`, problem: `unknown key; keys: ${Object.keys(keys).join(", ")}` }));
	for (const [key, needed] of Object.entries(keys)) {
		const field = value[key];
		if ((needed || field !== undefined) && !(typeof field === "string" && field.trim() !== "")) problems.push({ path: `${path}.${key}`, problem: `expected non-empty text, got ${describe(field)}` });
	}
	return problems;
}

function markdownInside(path: string): boolean {
	const plain = normalize(path);
	return !isAbsolute(plain) && plain !== ".." && !plain.startsWith(`..${sep}`) && plain.endsWith(".md");
}

function realDate(date: string): boolean {
	return !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
}

export const isOneOff = (entry: Entry) => ONE_OFF.test(entry.at);

// The slot of `entry` at or before `now`: a daily entry's latest, a one-off's own instant once it has come. A time the spring
// gap skips is the first minute after the jump; one the autumn repeat shows twice, its first pass (the core's clock).
export function lastSlot(entry: Entry, timeZone: string, now: Date): Date | undefined {
	const once = ONE_OFF.exec(entry.at);
	const [date, time] = once === null ? ["", entry.at] : [once[1] as string, once[2] as string];
	// From 15 hours before the date's UTC midnight, the time of day before it in every zone, or 8 days before now, which holds a
	// slot of any day list; each `next` is the following slot.
	let from = new Date(once === null ? now.getTime() - 192 * HOUR : Date.parse(`${date}T00:00:00Z`) - 15 * HOUR);
	const zone = clock(timeZone, undefined, () => from);
	let last: Date | undefined;
	for (let next = zone.next(time, entry.days); next <= now; next = zone.next(time, entry.days)) {
		if (once !== null && zone.local(next).date >= date) return next;
		last = from = next;
	}
	return once === null ? last : undefined;
}
