import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// The silent mode (spec/roadmap.md, entry 47, AR0127): `arthur silent` and `/silent`, its state in `<folder>/silent.json`, the
// reply it holds (inbox.ts, `held`), the notice it holds (`coordinator.silent`, which every channel asks) and its line in the
// coordinator's context: docs/commands/silent.md.

type State = { readonly since: string; readonly seq: number; readonly work: string } | "broken" | undefined;

const [FILE, ASK] = ["silent.json", "silent-ask"];
const USAGE = "usage: arthur silent [on '<the work; its stop condition>' | off | ask]";

// No file is off; a file that does not parse, or holds something else, counts as on.
export function silentState(folder: string): State {
	let text: string;
	try {
		text = readFileSync(join(folder, FILE), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	try {
		const state = JSON.parse(text) as Exclude<State, string>;
		if (typeof state?.since === "string" && Number.isSafeInteger(state.seq) && typeof state.work === "string") return state;
	} catch {}
	return "broken";
}

// Whether the reply written to `outbox/<name>`, of a turn holding no owner message, is held: silent is on, and `arthur silent
// ask` did not run before the reply was written (the name starts with that time in ms); one ask lets one reply through.
export function held(folder: string, name: string): boolean {
	if (silentState(folder) === undefined) return false;
	const asked = existsSync(join(folder, ASK)) ? Number(readFileSync(join(folder, ASK), "utf8")) : Number.NaN;
	if (!(Number(name.split("-")[0]) >= asked)) return true;
	rmSync(join(folder, ASK), { force: true });
	return false;
}

// The notice of a job blocked on the owner (blocked-notice.ts) carries `blocked`; while silent is on, every other is held.
const holds = (notice: unknown) => typeof (notice as { blocked?: unknown } | undefined)?.blocked !== "string";

export function silentMode(host: Host): void {
	const { folder } = host;
	const answer = (verb: string, work: string): string | undefined => {
		const state = silentState(folder);
		if (verb === "") return answer(state === undefined ? "on" : "off", "");
		if (verb === "ask") {
			if (state === undefined) return "silent: off";
			writeFileSync(join(folder, ASK), String(Date.now()));
			return "silent: on; the reply of this turn goes to the owner";
		}
		if (verb === "on") {
			// From off, an ask left behind goes; while on, since when and the event number stay.
			if (typeof state !== "object") rmSync(join(folder, ASK), { force: true });
			const kept = typeof state === "object" ? state : { since: host.clock.now().toISOString(), seq: host.events.read(1).at(-1)?.seq ?? 0 };
			writeFileSync(join(folder, `${FILE}.new`), `${JSON.stringify({ since: kept.since, seq: kept.seq, work })}\n`);
			renameSync(join(folder, `${FILE}.new`), join(folder, FILE));
			return "silent: on";
		}
		if (verb !== "off") return undefined;
		if (state === undefined) return "silent: off";
		rmSync(join(folder, FILE), { force: true });
		rmSync(join(folder, ASK), { force: true });
		return `silent: off, ${state === "broken" ? `${join(folder, FILE)} did not parse, so what happened meanwhile is unknown` : meanwhile(host, state.seq)}`;
	};
	host.commands.register({
		name: "silent",
		doc: new URL("../docs/commands/silent.md", import.meta.url),
		run({ args }) {
			const [verb = "", ...work] = args;
			const said = verb === "on" || work.length === 0 ? answer(verb, work.join(" ").trim()) : undefined;
			console[said === undefined ? "error" : "log"](said ?? USAGE);
			return said === undefined ? 2 : 0;
		},
		phone: {
			about: "Silent mode on or off: while on, only the end of delegated work, a decision and your answers reach you",
			reply: (text) => {
				const [, verb = "", work = ""] = /^(\S*)\s*([\s\S]*)$/.exec(text.trim()) ?? [];
				return (verb === "on" || work === "" ? answer(verb, work.trim()) : undefined) ?? USAGE.replace("arthur silent", "/silent");
			},
		},
	});
	host.provide("coordinator.silent", (notice: unknown) => silentState(folder) !== undefined && holds(notice));
}

// The context's `## Silent` section, empty while off.
export function silentContext(host: Host): string {
	const state = silentState(host.folder);
	if (state === undefined) return "";
	if (state === "broken") return `On: ${join(host.folder, FILE)} does not parse, so it counts as on; \`arthur silent off\` removes it.`;
	const { date, time, day } = host.clock.local(new Date(state.since));
	return `On since ${time} on ${day} ${date}, for: ${state.work || "nothing named; the owner turned it on"}.`;
}

// What happened since event `seq`, built without the model: the jobs that ended, by state; the tickets merged; the notices held.
function meanwhile(host: Host, seq: number): string {
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
