import { readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import type { Session } from "./sessions.ts";

// The silent mode's state and its end (spec/roadmap.md, entry 47; AR0739): `<folder>/silent.json` as it is read; how the mode
// goes off, by `arthur silent off` (silent.ts) or on its own once its end came, which each sweep of `arthur run` checks
// (inbox.ts), so it never stays on past its work unseen; and what happened meanwhile, built without the model: docs/commands/silent.md.

// A grant's id, `G<the number of the event that recorded it>`, and its bounds, every one given holding.
export type Grant = { readonly id: string; readonly until?: string; readonly usage?: number; readonly tickets?: readonly string[] };
// `until`: when the mode ends on its own; a state an Arthur before AR0739 wrote has none, and ends 24 hours after its `since`.
export type On = { readonly since: string; readonly seq: number; readonly work: string; readonly until?: string; readonly grant?: Grant };
type State = On | "broken" | undefined;

export const [FILE, ASK] = ["silent.json", "silent-ask"];
export const DAY_MS = 86_400_000;

// No file is off; a file that does not parse, or holds something else (a `since` or `until` that is no time, a grant without its
// id, a bound of another type), counts as on. `name`: the file a `turnOff` took.
export function silentState(folder: string, name = FILE): State {
	let text: string;
	try {
		text = readFileSync(join(folder, name), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	try {
		const state = JSON.parse(text) as On;
		const grant = state?.grant;
		const kept = grant === undefined || (typeof grant?.id === "string" && Array.isArray(grant.tickets ?? []) && [grant.until ?? "", ...(grant.tickets ?? [])].every((each) => typeof each === "string") && !Number.isNaN(Date.parse(grant.until ?? "0")) && ["undefined", "number"].includes(typeof grant.usage));
		const times = [state?.since, ...(state?.until === undefined ? [] : [state.until])].every((each) => typeof each === "string" && !Number.isNaN(Date.parse(each)));
		if (times && Number.isSafeInteger(state.seq) && typeof state.work === "string" && kept) return state;
	} catch {}
	return "broken";
}

// When the mode ends on its own, in ms.
export const endOf = (state: On): number => (state.until === undefined ? Date.parse(state.since) + DAY_MS : Date.parse(state.until));

// A time as the mode's lines say it, in `core.timeZone`.
export const when = (host: Pick<Host, "clock">, at: number | string): string => (({ time, day, date }) => `${time} on ${day} ${date}`)(host.clock.local(new Date(at)));

// Turns the mode off, for `arthur silent off` and its own end alike: the state file is taken by a rename, so of two that end it
// at once one gets the state and tells what happened, and the other undefined, as when it was off; then each session's ask goes.
export function turnOff(folder: string, sessions: readonly Pick<Session, "folder">[]): State {
	const taken = `${FILE}.${process.pid}`;
	try {
		renameSync(join(folder, FILE), join(folder, taken));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	const state = silentState(folder, taken);
	for (const file of [join(folder, taken), ...sessions.map((each) => join(each.folder, ASK))]) rmSync(file, { force: true });
	return state;
}

// The mode's own end (AR0739: it stayed on for six days after its work, every reply to Arthur's own messages held): once the end
// of its state came, `arthur run` turns it off and tells the owner in one `notice`, which nothing holds any more, when it was to
// end, since when and for what it was on, and what happened meanwhile. A broken state has no end: the context names it each turn.
export function silentEnd(host: Host, sessions: readonly Pick<Session, "folder">[]): void {
	const state = silentState(host.folder);
	if (typeof state !== "object" || host.clock.now().getTime() < endOf(state) || turnOff(host.folder, sessions) === undefined) return;
	host.events.emit("notice", { text: `silent: off on its own, its end ${when(host, endOf(state))} came (on since ${when(host, state.since)}, for: ${state.work || "nothing named"}); ${meanwhile(host, state.seq)}` });
}

// The notice of a job blocked on the owner (blocked-notice.ts) carries `blocked`, the one of an answer he must see recorded
// (decision-writes.ts) `decision`; while silent is on, every other is held.
export const holds = (notice: unknown) => !["blocked", "decision"].some((key) => typeof (notice as Readonly<Record<string, unknown>> | undefined)?.[key] === "string");

// What happened since event `seq`, built without the model: the jobs that ended, by state; the tickets merged; the notices held.
export function meanwhile(host: Host, seq: number): string {
	const ended = new Map<string, string[]>();
	const [merged, notices] = [[] as string[], [] as string[]];
	for (const { name, data } of host.events.read(seq + 1)) {
		const each = (data ?? {}) as Readonly<Record<string, unknown>>;
		if (name === "job-ended") {
			const state = each.state === "blocked" ? "blocked" : String(each.reason ?? each.state).split(":")[0] || "ended";
			ended.set(state, [...(ended.get(state) ?? []), String(each.id)]);
		}
		if (name === "ticket-moved" && each.to === "merged") merged.push(String(each.id));
		if (name === "notice" && typeof each.text === "string" && holds(data)) notices.push(`- ${each.text}`);
	}
	const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
	const parts = [
		...(ended.size === 0 ? [] : [`${count([...ended.values()].flat().length, "job")} ended: ${[...ended].map(([state, ids]) => `${ids.length} ${state} (${ids.join(", ")})`).join(", ")}`]),
		...(merged.length === 0 ? [] : [`${count(merged.length, "ticket")} merged: ${merged.join(", ")}`]),
		...(notices.length === 0 ? [] : [`${count(notices.length, "notice")} held:\n${notices.join("\n")}`]),
	];
	return parts.length === 0 ? "nothing happened meanwhile" : `meanwhile: ${parts.join("; ")}`;
}
