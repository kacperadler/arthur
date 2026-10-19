import { clock, type Day } from "@arthur/core/clock";

// One schedule entry (spec/roadmap.md, entry 39), from the config or the `file` option: a daily "HH:MM", only on `days` when
// given, or a one-off "YYYY-MM-DDTHH:MM", in core.timeZone; it does an action (a message to the coordinator, with the text of
// a procedure file under it) or a job (a spawn): docs/commands/schedule.md. Its check is schedule-options.ts's.
export type Action = { readonly message: string; readonly procedure?: string };
export type JobEntry = { readonly task: string; readonly kind?: string; readonly project?: string };
export type Entry = { readonly id: string; readonly at: string; readonly days?: readonly Day[]; readonly action?: Action; readonly job?: JobEntry };

const ID = /^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$/;
export const DAILY = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ONE_OFF = /^(\d{4}-\d{2}-\d{2})T(([01]\d|2[0-3]):[0-5]\d)$/;
const HOUR = 3_600_000;

type Fields = Readonly<Record<string, unknown>>;
export const isObject = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
export const isId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

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
