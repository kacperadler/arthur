import type { Message } from "./inbox.ts";

// The text a turn's messages reach the coordinator's agent in: the inbox extension hands them over in it (inbox-extension.ts),
// and `coordinator.turn` answers it for one event (inbox.ts), so `arthur eval` replays what the coordinator gets. One paragraph
// per message: a line that marks where it came from (a plugin's message with that plugin) and, when given, when, then each
// line of its text quoted, at every line break a reader may take for one, so no line of a job's or a plugin's text reads as
// a mark or a message of its own; after Arthur's own, the line that says so. Each mention omp 18.3.0 acts on, with no option to
// stop it, gets a word joiner first: `@<path>` reads a file (utils/file-mentions.ts), `^<model>` adds a model agent (expandMentions).

const ARTHUR = "The messages marked [Arthur] or [Arthur: <plugin>] come from Arthur (a job's end, a plugin), not from the owner.";
export function handOver(messages: readonly (Message & { readonly when?: string })[]): string {
	const paragraphs = messages.map(({ channel, plugin, text, when = "" }) => {
		const from = channel !== undefined ? `via ${channel}` : plugin !== undefined ? `Arthur: ${plugin}` : "Arthur";
		const quoted = text.split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/).map((line) => (line === "" ? ">" : `> ${line.replace(/(?<=^|[\s([{<"'`])@|(?<=^|\s)\^/g, "\u2060$&")}`));
		return [`[${from}${when === "" ? "" : `, ${when}`}]`, ...quoted].join("\n");
	});
	return [...paragraphs, ...(messages.every((message) => message.channel !== undefined) ? [] : [ARTHUR])].join("\n\n");
}
