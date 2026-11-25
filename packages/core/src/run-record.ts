import { type AgentEvent, count, type Spent } from "./agent-stream.ts";

// What the agent's events make of the job record while the wrapper runs it (spec/roadmap.md, entries 11 and 108): `log`, `tool-calls`,
// `activity`, `cost` and `usage` kept current through `save`, each message's text in `log` too, a line `> <line>` per line of it (AR0670);
// `end` writes `cost`, `tool-calls` and `activity` with their final value, and `result`. It also tells a loop (AR0739): the same
// tool call, its arguments too, failed `LOOP` times in a row, no other call ending between.

type Save = (name: string, text: string, append?: boolean) => void;
// Per `<provider>/<model>`: its messages, its tokens and its cost in USD.
export type Usage = { readonly [model: string]: Spent & { readonly messages: number } };
const FIELDS = ["messages", "input", "output", "cacheRead", "cacheWrite", "cost"] as const;
export const LOOP = 5;

// The record's `usage` file, `{}` when it is missing or not a JSON object; a field that is no number counts 0.
export function usageOf(text: string | undefined): Usage {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text ?? "");
	} catch {
		return {};
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
	const models = Object.entries(parsed as Record<string, Record<string, unknown> | null>);
	return Object.fromEntries(models.map(([model, each]) => [model, Object.fromEntries(FIELDS.map((key) => [key, count(each?.[key])]))])) as Usage;
}

export type RunRecord = {
	apply(events: readonly AgentEvent[]): void;
	// The USD spent so far, the runs before this wrapper's included.
	readonly cost: () => number;
	// The text of the last message that had text, empty when none.
	readonly result: () => string;
	// The last message's stop when it was not a normal one: `error` or `aborted`, with omp's text; empty otherwise.
	readonly stopped: () => string;
	// Forgets the stop of a run before a resume.
	clearStop(): void;
	// The call a loop repeated, `<tool> <detail>`; empty while none was told.
	readonly looped: () => string;
	end(): void;
};

// `cost` and `used` are what the record held at the start; `message` hears the cost after each message; `loop` is called once, at a loop.
export function runRecord(save: Save, cost: number, used: Usage, message: (cost: number) => void, loop: () => void): RunRecord {
	const usage: Record<string, Usage[string]> = { ...used };
	let calls = 0;
	let activity = "";
	let result = "";
	let stopped = "";
	// The calls not ended yet by their id; the call that ended last, and how often it failed in a row.
	const open = new Map<string, { readonly call: string; readonly shown: string }>();
	let [last, failures, looped] = ["", 0, ""];
	const act = (name: string) => name !== activity && save("activity", (activity = name));
	return {
		apply(events) {
			for (const event of events) {
				if (event.kind === "line") save("log", `${event.line}\n`, true);
				else if (event.kind === "turn") act("think");
				else if (event.kind === "tool") {
					save("tool-calls", String(++calls));
					act("tool");
					save("log", `${event.name} ${event.detail}\n`, true);
					open.set(event.id, { call: event.call, shown: `${event.name} ${event.detail}`.trim() });
				} else if (event.kind === "tool-end") {
					act("think");
					const ended = open.get(event.id);
					open.delete(event.id);
					if (!event.failed || ended === undefined) failures = 0;
					else {
						failures = ended.call === last ? failures + 1 : 1;
						last = ended.call;
						// Told once, with the first call that looped.
						if (failures !== LOOP || looped !== "") continue;
						looped = ended.shown;
						loop();
					}
				} else {
					if (event.text !== "") save("log", (result = event.text).replace(/^/gm, "> ").concat("\n"), true);
					stopped = event.stopReason === "error" || event.stopReason === "aborted" ? [event.stopReason, event.error].filter(Boolean).join(": ") : "";
					cost += event.cost;
					const was = usage[event.model];
					usage[event.model] = Object.fromEntries(FIELDS.map((key) => [key, (was?.[key] ?? 0) + (key === "messages" ? 1 : event[key])])) as Usage[string];
					save("cost", cost.toFixed(4));
					save("usage", JSON.stringify(usage));
					message(cost);
				}
			}
		},
		cost: () => cost,
		result: () => result,
		stopped: () => stopped,
		clearStop: () => void (stopped = ""),
		looped: () => looped,
		end() {
			save("result", result);
			save("cost", cost.toFixed(4));
			save("tool-calls", String(calls));
			save("activity", activity);
		},
	};
}
