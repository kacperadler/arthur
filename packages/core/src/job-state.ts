import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE, taskTickets } from "./board-jobs.ts";
import type { Bus } from "./events.ts";
import { withLock } from "./lock.ts";

// A job's state (spec/roadmap.md, entry 16), kept in its record as `state`, `reason` and `since`, with `hold`, the reason of a
// plugin's `block`, and `active`, whose time is the agent's last output: docs/commands/jobs.md.

// In the order `arthur jobs` groups them.
export const STATES = ["blocked", "working", "idle", "ended"] as const;
export type State = (typeof STATES)[number];
// The record's state; `hold` is empty when no plugin holds the job.
export type Current = { readonly state: string; readonly reason: string; readonly hold: string };

// `<date>-<kind>-<8 hex digits>`, as the spawn makes it: nothing else names a folder in `<home>/jobs/`.
export const ID = /^\d{4}-\d\d-\d\d-[a-z][a-z0-9]*(-[a-z0-9]+)*-[0-9a-f]{8}$/;

// A reader of one record's files; a missing one reads empty.
export const field = (home: string, id: string) => (name: string): string => {
	const path = join(home, "jobs", id, name);
	return existsSync(path) ? readFileSync(path, "utf8") : "";
};

export function current(home: string, id: string): Current {
	const [state = "", reason = "", hold = ""] = ["state", "reason", "hold"].map(field(home, id));
	return { state, reason, hold };
}

// In a run: its wrapper runs and writes its end. A job whose run ended `blocked` is not.
export const inRun = ({ state, hold }: Current): boolean => state === "working" || state === "idle" || hold !== "";
export const told = ({ state, reason }: Current): string => `${state || "without a state"}${reason === "" ? "" : ` (${reason})`}`;

// The reason a run's final message blocks it, from its first line, `Blocked: user <question>` or `Blocked: on <ticket or job>`.
export function blockedBy(result: string): string | undefined {
	const [, on, what = ""] = /^Blocked: (user|on) (.*\S)/.exec(result.split("\n", 1)[0] ?? "") ?? [];
	return on === undefined ? undefined : `${on === "user" ? "user" : "dependency"}: ${what.trim()}`;
}

// Whether a job whose agent was last active at `active` (ms) has done nothing for `idleMinutes` at `now`; 0 is never.
export const quiet = (active: number, now: number, idleMinutes: number): boolean => idleMinutes > 0 && now - active >= idleMinutes * 60_000;

// Under the record's lock, moves job `id` to what `decide` makes of its state: `reason` and `since` (`at`) written first,
// `state` last, then `job-state` emitted. Undefined, or the same state and reason, writes and emits nothing; returns whether it moved.
export function moveJob(home: string, id: string, bus: Bus, decide: (now: Current) => readonly [State, string] | undefined, at = new Date()): boolean {
	const folder = join(home, "jobs", id);
	if (!ID.test(id) || !existsSync(join(folder, "kind"))) throw new Error(`${id}: no such job in ${join(home, "jobs")}`);
	const moved = withLock(join(folder, "state.lock"), () => {
		const now = current(home, id);
		const [to, reason] = decide(now) ?? [now.state, now.reason];
		if (to === now.state && reason === now.reason) return undefined;
		for (const [name, text] of [["reason", reason], ["since", at.toISOString()], ["state", to]] as const) write(folder, name, text);
		return { from: now.state, to, reason };
	});
	if (moved === undefined) return false;
	const read = field(home, id);
	const ticket = taskTickets(read("task")).map((path) => FEATURE.exec(path)?.[1]).find(Boolean) ?? null;
	bus.emit("core", "job-state", { id, project: read("project"), ticket, machine: read("machine") || "local", ...moved });
	return true;
}

// `host.jobs.block`: holds a job in a run `blocked` on `dependency: <reason>` until `unblock`, whatever its activity.
export function blockJob(home: string, id: string, reason: string, bus: Bus, at: Date): void {
	const what = typeof reason === "string" ? reason.replace(/\s+/g, " ").trim() : "";
	if (what === "") throw new Error(`block ${id}: the reason is empty`);
	moveJob(home, id, bus, (now) => {
		if (!inRun(now)) throw new Error(`block ${id}: it is ${told(now)}, not in a run; only a job in a run is held`);
		write(join(home, "jobs", id), "hold", what);
		return ["blocked", `dependency: ${what}`];
	}, at);
}

// `host.jobs.unblock`: a held job goes back to working, or idle when its agent did nothing for its `idle-minutes` by `at`.
export function unblockJob(home: string, id: string, bus: Bus, at: Date): void {
	const folder = join(home, "jobs", id);
	moveJob(home, id, bus, (now) => {
		if (now.hold === "") return undefined;
		rmSync(join(folder, "hold"));
		const active = statSync(join(folder, "active"), { throwIfNoEntry: false })?.mtimeMs ?? 0;
		return [quiet(active, at.getTime(), Number(field(home, id)("idle-minutes"))) ? "idle" : "working", ""];
	}, at);
}

export function write(folder: string, name: string, text: string): void {
	writeFileSync(join(folder, `.${name}`), text);
	renameSync(join(folder, `.${name}`), join(folder, name));
}
