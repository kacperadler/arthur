// What the wrapper reads from the agent (spec/roadmap.md, entry 11): `omp --mode json` prints one JSON event per line on
// stdout. Of them a job record needs a tool call's start and end, a turn's start and each assistant message; a line that is
// not JSON comes back as it is, for the log.

export type AgentEvent =
	| { readonly kind: "tool"; readonly name: string; readonly detail: string }
	| { readonly kind: "tool-end" }
	| { readonly kind: "turn" }
	// `stopReason` as omp says it (`stop` ends the run, `toolUse` a turn); `error` omp's text for a failed one; `model` `<provider>/<model>`.
	| ({ readonly kind: "message"; readonly text: string; readonly stopReason: string; readonly error: string; readonly model: string } & Spent)
	| { readonly kind: "line"; readonly line: string };
// What a message spent: its tokens as omp counts them, and its `cost` in USD.
export type Spent = { readonly [key in "input" | "output" | "cacheRead" | "cacheWrite" | "cost"]: number };

type Part = { readonly type?: unknown; readonly text?: unknown };
type Raw = {
	readonly type?: unknown;
	readonly toolName?: unknown;
	readonly args?: { readonly command?: unknown; readonly path?: unknown; readonly pattern?: unknown };
	readonly message?: {
		readonly role?: unknown;
		readonly content?: unknown;
		readonly stopReason?: unknown;
		readonly errorMessage?: unknown;
		readonly provider?: unknown;
		readonly model?: unknown;
		readonly usage?: { readonly [key: string]: unknown; readonly cost?: { readonly total?: unknown } };
	};
};

// Takes stdout in chunks of any size: a line waits, however long, until its line break or the end.
export function agentStream(): { push(chunk: string): AgentEvent[]; end(): AgentEvent[] } {
	let buffer = "";
	const take = (line: string): AgentEvent[] => {
		const trimmed = line.trim();
		if (trimmed === "") return [];
		let event: unknown;
		try {
			event = JSON.parse(trimmed);
		} catch {
			return [{ kind: "line", line: trimmed }];
		}
		if (typeof event !== "object" || event === null || Array.isArray(event)) return [{ kind: "line", line: trimmed }];
		return interpret(event as Raw);
	};
	return {
		push(chunk) {
			buffer += chunk;
			if (!chunk.includes("\n")) return [];
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			return lines.flatMap(take);
		},
		end() {
			const events = take(buffer);
			buffer = "";
			return events;
		},
	};
}

function interpret(event: Raw): AgentEvent[] {
	const name = typeof event.toolName === "string" ? event.toolName : "";
	if (event.type === "tool_execution_start") {
		const detail = String(event.args?.command ?? event.args?.path ?? event.args?.pattern ?? "");
		return [{ kind: "tool", name, detail: detail.replace(/\s+/g, " ").slice(0, 100) }];
	}
	if (event.type === "tool_execution_end") return [{ kind: "tool-end" }];
	if (event.type === "turn_start") return [{ kind: "turn" }];
	const message = event.message;
	if (event.type !== "message_end" || message?.role !== "assistant") return [];
	const usage = message.usage;
	return [
		{
			kind: "message",
			text: text(message.content).trim(),
			stopReason: typeof message.stopReason === "string" ? message.stopReason : "",
			error: typeof message.errorMessage === "string" ? message.errorMessage.trim() : "",
			cost: count(usage?.cost?.total),
			model: [message.provider, message.model].map((name) => (typeof name === "string" ? name : "")).join("/"),
			input: count(usage?.input),
			output: count(usage?.output),
			cacheRead: count(usage?.cacheRead),
			cacheWrite: count(usage?.cacheWrite),
		},
	];
}

// A number omp gave, or 0 for anything else: a missing field, a broken one.
export const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

// The text parts of a content list joined; anything else in it (thinking, a tool call, an image) is left out.
function text(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return (content as readonly Part[]).map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : "")).join("");
}
