import { join } from "node:path";
import type { Plugin } from "@arthur/core/plugin";
import { sayCommand } from "./say-command.ts";
import { speaker } from "./say.ts";
import { checkOptions, type SpeakOptions, speakOptions } from "./speak-options.ts";
import { requirements } from "./speak-tools.ts";

// The speak plugin (AR0553), the listen plugin's reverse: `speak.say` speaks a text on this server with Piper into an OGG/Opus
// voice note in `.arthur/speak/`, which orchestration sends back for a reply to the owner's voice note; `arthur say` does the
// same from the shell. docs/speak.md.

export function speak(options: { readonly enabled?: boolean } & Partial<SpeakOptions> = {}): Plugin {
	return {
		name: "speak",
		module: import.meta.url,
		options,
		check: checkOptions,
		doctor: (given, core) => requirements(speakOptions(given), join(core.home, "speak")),
		setup(host) {
			const say = speaker(host, speakOptions(host.options));
			host.provide("speak.say", (text: unknown): Promise<string> => {
				if (typeof text !== "string") return Promise.reject(new Error(`speak.say: expected a text, got ${JSON.stringify(text)}`));
				return say(text);
			});
			host.commands.register(sayCommand(host));
		},
	};
}
