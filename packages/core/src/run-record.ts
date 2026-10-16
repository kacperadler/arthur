import type { AgentEvent } from "./agent-stream.ts";

// What the agent's events make of the job record while the wrapper runs it (spec/roadmap.md, entry 11): `log`, `tool-calls`,
// `activity` and `cost` kept current through `save`; `end` writes each with its final value and `result`.

type Save = (name: string, text: string, append?: boolean) => void;

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
	end(): void;
};

// `cost` is what the record held at the start; `message` hears the cost after each message.
export function runRecord(save: Save, cost: number, message: (cost: number) => void): RunRecord {
	let calls = 0;
	let activity = "";
	let result = "";
	let stopped = "";
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
				} else if (event.kind === "tool-end") act("think");
				else {
					if (event.text !== "") result = event.text;
					stopped = event.stopReason === "error" || event.stopReason === "aborted" ? [event.stopReason, event.error].filter(Boolean).join(": ") : "";
					cost += event.cost;
					save("cost", cost.toFixed(4));
					message(cost);
				}
			}
		},
		cost: () => cost,
		result: () => result,
		stopped: () => stopped,
		clearStop: () => void (stopped = ""),
		end() {
			save("result", result);
			save("cost", cost.toFixed(4));
			save("tool-calls", String(calls));
			save("activity", activity);
		},
	};
}
