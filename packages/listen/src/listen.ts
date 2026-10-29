import { join, resolve } from "node:path";
import type { Claim, Part } from "@arthur/core/parts";
import type { Plugin } from "@arthur/core/plugin";
import { type Transcript, transcriber } from "./transcribe.ts";
import { transcribeCommand } from "./transcribe-command.ts";
import { checkOptions, type ListenOptions, listenOptions } from "./listen-options.ts";
import { requirements } from "./listen-tools.ts";

// The listen plugin (spec/roadmap.md, entry 81; AR0550, renamed from voice in AR0554): every `voice` and `audio` part from
// any channel reaches the coordinator as its text, transcribed on this server by whisper.cpp; `listen.transcribe` and
// `arthur transcribe` do the same for any file, through the same queue. docs/listen.md.

export function listen(options: { readonly enabled?: boolean } & Partial<ListenOptions> = {}): Plugin {
	return {
		name: "listen",
		module: import.meta.url,
		options,
		check: checkOptions,
		doctor: (given, core) => requirements(listenOptions(given), join(core.home, "listen")),
		setup(host) {
			const loaded = listenOptions(host.options);
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
			host.provide("listen.transcribe", async (path: unknown): Promise<Transcript> => {
				if (typeof path !== "string" || path.trim() === "") throw new Error(`listen.transcribe: expected a file's path, got ${JSON.stringify(path)}`);
				const done = await transcribe(resolve(path));
				if ("text" in done) return done;
				throw new Error(done.over ? `${path}: audio of ${done.seconds} s is over maxSeconds ${loaded.maxSeconds}; not transcribed` : `${path}: not transcribed: ${done.why}`);
			});
			host.commands.register(transcribeCommand(host));
		},
	};
}
