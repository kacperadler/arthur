import type { Message } from "./inbox.ts";

// The text a turn's messages reach the coordinator's agent in: the inbox extension hands them over in it (inbox-extension.ts),
// and `coordinator.turn` answers it for one event (inbox.ts), so `arthur eval` replays what the coordinator gets. One paragraph
// per message, marked with where it came from and, when given, when; after Arthur's own, the line that says so.

const ARTHUR = "The lines marked [Arthur] come from Arthur (a job's end, a schedule), not from the owner.";

export function handOver(messages: readonly (Message & { readonly when?: string })[]): string {
	const lines = messages.map(({ channel, text, when = "" }) => `[${channel === undefined ? "Arthur" : `via ${channel}`}${when === "" ? "" : `, ${when}`}] ${text}`);
	return [...lines, ...(messages.every((message) => message.channel !== undefined) ? [] : [ARTHUR])].join("\n\n");
}
