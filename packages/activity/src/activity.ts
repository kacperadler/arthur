import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { Event, Host, OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { type JobInfo, LOGGED, line } from "./activity-line.ts";
import { append, lastSeq, prune } from "./day-files.ts";

// The activity plugin (spec/roadmap.md, entry 100): who did what, one file per day in `core.timeZone`, built from the logged
// events by `arthur run` alone. A command process never calls `start`, so it never writes. docs/activity.md.

export type ActivityOptions = { readonly enabled?: boolean; readonly keepDays?: number; readonly textChars?: number };

// Its options file too (`./options`), which `arthur setup` reads: what it is in one line, the tools it runs, its options.
export const summary = "activity: who did what, one file per day of the logged events, each with its actor and the messages it acted on";

export const tools: readonly Tool[] = [];

export const KEEP_DAYS = 90;
export const TEXT_CHARS = 300;
const whole = (what: string): Check => (value) => (Number.isInteger(value) && (value as number) >= 0 ? undefined : `a whole number of ${what}, 0 or more`);
const checks = { keepDays: whole("days"), textChars: whole("characters") };

export const table: OptionTable = {
	keepDays: { about: "Days a day file is kept after its day, then removed at arthur run's start or its first line of a new day", default: String(KEEP_DAYS), check: checks.keepDays },
	textChars: { about: "Characters of an event's text a line keeps, its full length noted as cut; 0 keeps none", default: String(TEXT_CHARS), check: checks.textChars },
};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.entries(options).flatMap(([key, value]) => {
		const check = Object.hasOwn(checks, key) ? checks[key as keyof typeof checks] : undefined;
		if (check === undefined) return [{ path: key, problem: `unknown option; options: ${Object.keys(checks).join(", ")}` }];
		const wrong = check(value);
		return wrong === undefined ? [] : [{ path: key, problem: `expected ${wrong}, got ${describe(value)}` }];
	});
}

export function activity(options: ActivityOptions = {}): Plugin {
	const [keepDays, textChars] = [options.keepDays ?? KEEP_DAYS, options.textChars ?? TEXT_CHARS];
	const jobs = new Map<string, JobInfo>();
	// The events delivered before `start` (the log replayed by `arthur run`, or a command's own), held unwritten.
	let held: Event[] | undefined = [];
	let [last, day, at]: [number | undefined, string | undefined, Host | undefined] = [undefined, undefined, undefined];
	const write = (host: Host, event: Event) => {
		const data = (event.data ?? {}) as { readonly id?: unknown; readonly kind?: unknown; readonly tickets?: unknown };
		if (event.name === "job-started" && typeof data.id === "string")
			jobs.set(data.id, { kind: typeof data.kind === "string" ? data.kind : undefined, ticket: Array.isArray(data.tickets) && typeof data.tickets[0] === "string" ? data.tickets[0] : undefined });
		const made = line(event, textChars, jobs);
		// A number already written is a replay after a crash: never twice.
		if (made === undefined || (last !== undefined && event.seq <= last)) return;
		const date = host.clock.local(new Date(event.time)).date;
		if (date !== day) prune(host.folder, date, keepDays);
		append(host.folder, date, made);
		[last, day] = [event.seq, date];
	};
	return {
		name: "activity",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			at = host;
			for (const name of LOGGED) host.events.on(name, (event) => (held === undefined ? write(host, event) : void held.push(event)));
		},
		start() {
			const host = at as Host;
			[last, day] = [lastSeq(host.folder), host.clock.local().date];
			prune(host.folder, day, keepDays);
			const queue = (held ?? []).sort((a, b) => a.seq - b.seq);
			held = undefined;
			// Events past the last line that never reached this plugin (`events.delivered` lost): read from the log once. A held
			// event at or below the last line is a replay, so the first above it tells.
			const next = queue.find((event) => last !== undefined && event.seq > last)?.seq ?? Number.POSITIVE_INFINITY;
			const gap = last !== undefined && next > last + 1 ? host.events.read(last + 1).filter((event) => LOGGED.includes(event.name)) : [];
			for (const event of [...gap, ...queue]) write(host, event);
		},
	};
}
