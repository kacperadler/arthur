import type { QuietHours } from "./config.ts";

// The clock every plugin shares (spec/roadmap.md, entry 7): the core's `timeZone` and `quietHours`. A time of day is a
// wall-clock "HH:MM" in `timeZone`; an instant is a Date.

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

// One instant as a wall clock in `timeZone` shows it: `date` "YYYY-MM-DD", `time` "HH:MM".
export type LocalTime = { readonly date: string; readonly time: string; readonly day: Day };

export type Clock = {
	readonly timeZone: string;
	now(): Date;
	local(at?: Date): LocalTime;
	// Quiet from `quietHours.from` up to, not including, `quietHours.to`, across midnight when `from` is the later time.
	// No quiet hours, or `from` equal to `to`, is never quiet.
	isQuiet(at?: Date): boolean;
	// The first slot at `time` strictly after now, so a timer that fires at the slot's minute gets the next one; only on
	// `days` when given. A time the spring gap skips is the first minute after the jump (02:30 is 03:00); a time the autumn
	// repeat shows twice is its first pass only.
	next(time: string, days?: readonly Day[]): Date;
};

// In `getUTCDay` order.
const DAYS: readonly Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTE = 60_000;
const DAY = 86_400_000;

export function clock(timeZone: string, quietHours: QuietHours | undefined, now: () => Date = () => new Date()): Clock {
	const format = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	});
	// The wall clock at `at` written as if it were UTC, whole seconds: `wall(at) - at` is the zone's offset then.
	const wall = (at: number): number => {
		const parts = format.formatToParts(at);
		const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value);
		return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
	};
	// The instant the wall clock shows `target`: the earlier of two in the autumn repeat, the jump's minute in the spring gap.
	const instant = (target: number): number => {
		const before = wall(target - DAY) - (target - DAY);
		const after = wall(target + DAY) - (target + DAY);
		const shown = [target - before, target - after].filter((at) => wall(at) === target);
		if (shown.length > 0) return Math.min(...shown);
		// In the gap the wall clock is before `target` at `low` and past it at `high`: the first minute past is the jump.
		let low = target - after;
		let high = target - before;
		while (high - low > MINUTE) {
			const middle = low + Math.floor((high - low) / MINUTE / 2) * MINUTE;
			if (wall(middle) < target) low = middle;
			else high = middle;
		}
		return high;
	};
	const quiet = quietHours && { from: minuteOfDay(quietHours.from, "quietHours.from"), to: minuteOfDay(quietHours.to, "quietHours.to") };
	return {
		timeZone,
		now,
		local(at = now()) {
			const shown = new Date(wall(at.getTime()));
			const text = shown.toISOString();
			// `getUTCDay` is 0 to 6, so the index is always in DAYS.
			return { date: text.slice(0, 10), time: text.slice(11, 16), day: DAYS[shown.getUTCDay()] as Day };
		},
		isQuiet(at = now()) {
			if (quiet === undefined || quiet.from === quiet.to) return false;
			const minute = Math.floor((wall(at.getTime()) % DAY) / MINUTE);
			return quiet.from < quiet.to ? minute >= quiet.from && minute < quiet.to : minute >= quiet.from || minute < quiet.to;
		},
		next(time, days) {
			const minute = minuteOfDay(time, "clock.next");
			const allowed = days === undefined ? DAYS : checkDays(days);
			const from = now().getTime();
			const today = wall(from) - (wall(from) % DAY);
			for (let date = today; ; date += DAY) {
				if (!allowed.includes(DAYS[new Date(date).getUTCDay()] as Day)) continue;
				const at = instant(date + minute * MINUTE);
				if (at > from) return new Date(at);
			}
		},
	};
}

function minuteOfDay(time: string, what: string): number {
	const match = HH_MM.exec(time);
	if (match === null) throw new Error(`${what}: expected a time "HH:MM" from 00:00 to 23:59, got ${JSON.stringify(time)}`);
	return Number(match[1]) * 60 + Number(match[2]);
}

function checkDays(days: readonly Day[]): readonly Day[] {
	if (days.length === 0) throw new Error("clock.next: an empty day list never comes; leave days out for every day");
	for (const day of days)
		if (!DAYS.includes(day)) throw new Error(`clock.next: unknown day ${JSON.stringify(day)}; expected mon, tue, wed, thu, fri, sat or sun`);
	return days;
}
