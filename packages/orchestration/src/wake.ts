import { describe } from "@arthur/core";
import { received, turnText } from "@arthur/core/parts";
import type { Host } from "@arthur/core/plugin";
import { redact, redactValues } from "./credential.ts";
import { handOver } from "./hand-over.ts";

// The text of Arthur's own messages to a session (inbox.ts): a job's end, the wake, and `coordinator.turn`, what one event
// becomes for the agent: docs/commands/coordinator.md, "The coordinator's inbox".

const RESULT_LINES = 15;

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

// The wake: the state its run ended in (the question, when blocked on the owner), the first lines of its final message (the
// job's own unless `final` stands for it), its project when not the main one, and what the plugins add for it, asked with the
// job-ended data and that final message whole; the question redacted, the reason, those lines and the plugins' of the env
// file's values only, so their job ids, ticket folders and hashes stay readable, but for the line that holds the question.
export function wake(host: Host, data: unknown, final?: string): string {
	const job = (data ?? {}) as Readonly<Record<string, unknown>>;
	const id = String(job.id);
	const asks = job.state === "blocked" && typeof job.reason === "string" && job.reason.startsWith("user: ") ? redact(job.reason.slice("user: ".length), host.secrets) : undefined;
	const state = `${String(job.state)}${text(job.reason) ? ` (${redactValues(job.reason, host.secrets)})` : ""}`;
	const lines = [asks === undefined ? `Job ${id} ended its run: ${state}.` : `Job ${id} ended its run blocked on the owner; its question, also sent as a notice: ${asks}`];
	const main = host.collect("projects").length > 0 ? host.board.projects()[0]?.name : undefined;
	if (main !== undefined && job.project !== main) lines.push(`Project: ${String(job.project)}.`);
	const message = final ?? host.jobs.result(id);
	const result = redactValues(message, host.secrets).trimEnd().split("\n");
	// Its first line, `Blocked: user <question>`, holds the question: redacted as the question is.
	if (asks !== undefined) result[0] = redact(result[0] ?? "", host.secrets);
	if (result.join("") === "") lines.push("Its final message: none.");
	else {
		const cut = result.length > RESULT_LINES ? ` (the first ${RESULT_LINES} of ${result.length} lines)` : "";
		lines.push(`Its final message${cut}:`, ...result.slice(0, RESULT_LINES));
	}
	for (const line of host.collect("coordinator.wake", job, message)) if (text(line)) lines.push(redactValues(line, host.secrets));
	return lines.join("\n");
}

// What `coordinator.turn` answers (`arthur eval` asks it): the text the coordinator's agent gets for one event the inbox
// queues, handed over alone while idle; `more` stands for the final message of the job a `job-ended` names, and names the
// plugin that emitted a `coordinator-message`. A message's parts are text only, which no plugin is asked to resolve, so the
// answer acts on nothing.
export async function turn(host: Host, name: unknown, data: unknown, more: unknown): Promise<string> {
	if (name === "job-ended") return handOver([{ text: wake(host, data, typeof more === "string" ? more : "") }]);
	if (name === "coordinator-message") {
		const said = ((data ?? {}) as Readonly<Record<string, unknown>>).text;
		if (!text(said)) throw new Error("coordinator.turn: coordinator-message: expected { text }, non-empty text");
		if (!text(more)) throw new Error("coordinator.turn: coordinator-message: expected the plugin that emitted it, as text");
		return handOver([{ plugin: more, text: said }]);
	}
	if (name !== "message-received") throw new Error(`coordinator.turn: expected message-received, coordinator-message or job-ended, got ${describe(name)}`);
	const message = received(data);
	if (typeof message === "string") throw new Error(`coordinator.turn: message-received: ${message}`);
	const part = message.parts.find((each) => each.kind !== "text");
	if (part !== undefined) throw new Error(`coordinator.turn: message-received: text parts only; a ${part.kind} part is resolved by the plugins that claim it`);
	return handOver([{ channel: message.channel, text: await turnText(host, 0, message) }]);
}
