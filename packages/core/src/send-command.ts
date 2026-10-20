import { resolve } from "node:path";
import type { Command } from "./commands.ts";
import { parseFlags, text } from "./flags.ts";
import type { Answer } from "./plugin.ts";

// `arthur send` (spec/roadmap.md, entry 49): files, with a caption, to a place when given, through every enabled channel. Each
// channel's `channel.send` checks the whole message and answers its send, so nothing goes before every channel took it:
// docs/commands/send.md.

export type Outgoing = { readonly files: readonly string[]; readonly caption?: string; readonly place?: string };

const USAGE = "usage: arthur send <file>... [--caption <text>] [--place <id>]";

// `channels` asks every plugin that provides `channel.send`; it throws when the config did not load.
export function sendCommand(channels: () => (message: Outgoing) => Answer<unknown>[]): Command {
	return {
		name: "send",
		doc: new URL("../docs/commands/send.md", import.meta.url),
		async run({ args }) {
			const parsed = parseFlags(args, { caption: text, place: text });
			if (typeof parsed === "string" || parsed.words.length === 0) {
				console.error(`arthur send: ${typeof parsed === "string" ? parsed : "no file"}\n${USAGE}`);
				return 2;
			}
			const { words, values: { caption, place } } = parsed;
			const answers = channels()({ files: words.map((file) => resolve(file)), ...(caption === undefined ? {} : { caption }), ...(place === undefined ? {} : { place }) });
			if (answers.length === 0) throw new Error("no channel is enabled: no plugin provides channel.send; enable one, such as telegram, in arthur.config.ts");
			const [refused, sends]: [string[], { readonly plugin: string; readonly send: Function }[]] = [[], []];
			for (const answer of answers) {
				if ("error" in answer) refused.push(...answer.error.message.split("\n").map((line) => `${answer.plugin}: ${line}`));
				else if (typeof answer.value === "function") sends.push({ plugin: answer.plugin, send: answer.value });
				else refused.push(`${answer.plugin}: channel.send answered no send`);
			}
			if (refused.length > 0) throw new Error(`nothing sent:\n${refused.join("\n")}`);
			let code = 0;
			for (const { plugin, send } of sends) {
				try {
					console.log(`${plugin}: ${String(await send())}`);
				} catch (error) {
					console.error(`arthur send: ${plugin}: ${error instanceof Error ? error.message : String(error)}`);
					code = 1;
				}
			}
			return code;
		},
	};
}
