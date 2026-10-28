import { join, resolve } from "node:path";
import type { Claim, Part } from "@arthur/core/parts";
import type { Plugin } from "@arthur/core/plugin";
import { type Transcript, transcriber } from "./transcribe.ts";
import { transcribeCommand } from "./transcribe-command.ts";
import { checkOptions, type VoiceOptions, voiceOptions } from "./voice-options.ts";
import { requirements } from "./voice-tools.ts";

// The voice plugin (spec/roadmap.md, entry 81; AR0550): every `voice` and `audio` part from any channel reaches the
// coordinator as its text, transcribed on this server by whisper.cpp; `voice.transcribe` and `arthur transcribe` do the same
// for any file, through the same queue. docs/voice.md.

export function voice(options: { readonly enabled?: boolean } & Partial<VoiceOptions> = {}): Plugin {
	return {
		name: "voice",
		module: import.meta.url,
		options,
		check: checkOptions,
		doctor: (given, core) => requirements(voiceOptions(given), join(core.home, "voice")),
		setup(host) {
			const loaded = voiceOptions(host.options);
			const transcribe = transcriber(host, loaded);
			host.provide("message.part", (part: Part): Promise<Claim> | undefined => {
				if ((part.kind !== "voice" && part.kind !== "audio") || part.path === undefined) return undefined;
				const { kind, path } = part;
				return transcribe(path, part.seconds).then((done): Claim => {
					if ("text" in done) return { text: done.text === "" ? `[${kind}: no speech] (${path})` : `[${kind} ${done.seconds} s] ${done.text} (${path})` };
					const text = `[${kind}${done.seconds === undefined ? "" : ` ${done.seconds} s`}: not transcribed: ${done.why}] (${path})`;
					return done.over ? { text, reply: `${kind === "voice" ? "voice note" : "audio"} of ${done.seconds} s is over maxSeconds ${loaded.maxSeconds}; not transcribed` } : { text };
				});
			});
			// Any file by its path, for the coordinator and other plugins: its transcript, or an error saying why there is none.
			host.provide("voice.transcribe", async (path: unknown): Promise<Transcript> => {
				if (typeof path !== "string" || path.trim() === "") throw new Error(`voice.transcribe: expected a file's path, got ${JSON.stringify(path)}`);
				const done = await transcribe(resolve(path));
				if ("text" in done) return done;
				throw new Error(done.over ? `${path}: audio of ${done.seconds} s is over maxSeconds ${loaded.maxSeconds}; not transcribed` : `${path}: not transcribed: ${done.why}`);
			});
			host.commands.register(transcribeCommand(host));
		},
	};
}
