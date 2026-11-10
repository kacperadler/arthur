import { received } from "@arthur/core/parts";
import type { Event, Host } from "@arthur/core/plugin";

// The coordinator's reply to the owner's voice note goes back as a voice note too (AR0553), after its text and where its text
// goes: spoken by the plugin that provides `speak.say` (speak), sent by the `channel.send` of each channel a voice note came
// from, with no place, as the reply has none. When the voice note cannot go, one line on that channel says why; with no plugin
// providing `speak.say`, the text goes alone and nothing is said. One reply at a time, in the order they were sent:
// docs/commands/coordinator.md, "The coordinator's inbox".

export function voiceReplies(host: Pick<Host, "events" | "collectEach">): (reply: Event) => void {
	let last = Promise.resolve();
	return (reply) => {
		last = last.then(() => voice(host, reply)).catch((error: Error) => console.error(`orchestration: the voice note of reply ${reply.seq} failed: ${error.message}`));
	};
}

async function voice(host: Pick<Host, "events" | "collectEach">, reply: Event): Promise<void> {
	const { text, answers } = (reply.data ?? {}) as { readonly text?: unknown; readonly answers?: unknown };
	const seqs = Array.isArray(answers) ? answers.filter((seq): seq is number => Number.isSafeInteger(seq)) : [];
	if (typeof text !== "string" || seqs.length === 0) return;
	// Each channel a voice note it answers came from, with the event numbers of those messages.
	const channels = new Map<string, number[]>();
	for (const event of host.events.read(Math.min(...seqs))) {
		const message = event.name === "message-received" && seqs.includes(event.seq) ? received(event.data) : undefined;
		if (message !== undefined && typeof message !== "string" && message.parts.some((part) => part.kind === "voice")) channels.set(message.channel, [...(channels.get(message.channel) ?? []), event.seq]);
	}
	const [asked] = channels.size === 0 ? [] : host.collectEach<Promise<string>>("speak.say", text);
	if (asked === undefined) return;
	const spoken = "error" in asked ? asked.error : await Promise.resolve(asked.value).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
	for (const [channel, answered] of channels) {
		const why = spoken instanceof Error ? spoken.message : await send(host, spoken, channel);
		if (why !== undefined) host.events.emit("coordinator-replied", { text: `voice note not sent: ${why.split("\n").join("; ")}`, answers: answered, channels: [channel] });
	}
}

// The voice note at `path` sent by `channel`'s own `channel.send`; why it did not go, or undefined once it went.
async function send(host: Pick<Host, "collectEach">, path: string, channel: string): Promise<string | undefined> {
	const [answer] = host.collectEach<unknown>("channel.send", { files: [path] }).filter((each) => each.plugin === channel);
	if (answer === undefined) return `${channel} provides no channel.send`;
	if ("error" in answer) return answer.error.message;
	if (typeof answer.value !== "function") return `${channel}: channel.send answered no send`;
	try {
		await answer.value();
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}
