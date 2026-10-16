// What the wrapper reads from the agent (spec/roadmap.md, entry 11): `omp --mode json` prints one JSON event per line on
// stdout. Of them a job record needs a tool call's start and end, a turn's start and each assistant message; a line that is
// not JSON comes back as it is, for the log.

export type AgentEvent =
	| { readonly kind: "tool"; readonly name: string; readonly detail: string }
	// `command` is the bash command the call ran, undefined for any other tool; `output` its text.
	| { readonly kind: "tool-end"; readonly name: string; readonly command: string | undefined; readonly output: string; readonly failed: boolean }
	| { readonly kind: "turn" }
	// `stopReason` as omp says it (`stop` ends the run, `toolUse` a turn); `error` omp's text for a failed one; `cost` in USD.
	| { readonly kind: "message"; readonly text: string; readonly stopReason: string; readonly error: string; readonly cost: number }
	| { readonly kind: "line"; readonly line: string };

type Part = { readonly type?: unknown; readonly text?: unknown };
type Raw = {
	readonly type?: unknown;
	readonly toolCallId?: unknown;
	readonly toolName?: unknown;
	readonly args?: { readonly command?: unknown; readonly path?: unknown; readonly pattern?: unknown };
	readonly result?: { readonly content?: unknown };
	readonly isError?: unknown;
	readonly message?: {
		readonly role?: unknown;
		readonly content?: unknown;
		readonly stopReason?: unknown;
		readonly errorMessage?: unknown;
		readonly usage?: { readonly cost?: { readonly total?: unknown } };
	};
};

// Takes stdout in chunks of any size: a line waits, however long, until its line break or the end.
export function agentStream(): { push(chunk: string): AgentEvent[]; end(): AgentEvent[] } {
	let buffer = "";
	// A tool's end event carries no arguments, so a bash call's command waits here under its call id.
	const commands = new Map<unknown, string>();
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
		return interpret(event as Raw, commands);
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

function interpret(event: Raw, commands: Map<unknown, string>): AgentEvent[] {
	const name = typeof event.toolName === "string" ? event.toolName : "";
	if (event.type === "tool_execution_start") {
		const command = event.args?.command;
		if (name === "bash" && typeof command === "string") commands.set(event.toolCallId, command);
		const detail = String(command ?? event.args?.path ?? event.args?.pattern ?? "");
		return [{ kind: "tool", name, detail: detail.replace(/\s+/g, " ").slice(0, 100) }];
	}
	if (event.type === "tool_execution_end") {
		const command = commands.get(event.toolCallId);
		commands.delete(event.toolCallId);
		return [{ kind: "tool-end", name, command, output: text(event.result?.content), failed: event.isError === true }];
	}
	if (event.type === "turn_start") return [{ kind: "turn" }];
	const message = event.message;
	if (event.type !== "message_end" || message?.role !== "assistant") return [];
	const total = message.usage?.cost?.total;
	return [
		{
			kind: "message",
			text: text(message.content).trim(),
			stopReason: typeof message.stopReason === "string" ? message.stopReason : "",
			error: typeof message.errorMessage === "string" ? message.errorMessage.trim() : "",
			cost: typeof total === "number" && Number.isFinite(total) ? total : 0,
		},
	];
}

// The text parts of a content list joined; anything else in it (thinking, a tool call, an image) is left out.
function text(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return (content as readonly Part[]).map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : "")).join("");
}
