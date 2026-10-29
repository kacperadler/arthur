import { parseArgs } from "node:util";
import type { Command, Host } from "@arthur/core/plugin";
import type { Transcript } from "./transcribe.ts";

// `arthur transcribe <file> [--times]` (AR0550): a file's transcript through `listen.transcribe`, the queue and limits a voice
// note goes through. docs/commands/transcribe.md.

const USAGE = "usage: arthur transcribe <file> [--times]";

export function transcribeCommand(host: Pick<Host, "call">): Command {
	return {
		name: "transcribe",
		doc: new URL("../docs/commands/transcribe.md", import.meta.url),
		async run({ args }) {
			let parsed;
			try {
				parsed = parseArgs({ args: [...args], options: { times: { type: "boolean" } }, allowPositionals: true, strict: true });
			} catch (error) {
				console.error(`${(error as Error).message}\n${USAGE}`);
				return 2;
			}
			const [file, ...rest] = parsed.positionals;
			if (file === undefined || file === "" || rest.length > 0) {
				console.error(USAGE);
				return 2;
			}
			let done: Transcript;
			try {
				done = await host.call<Promise<Transcript>>("listen.transcribe", file);
			} catch (error) {
				console.error(`refused: ${(error as Error).message}`);
				return 1;
			}
			if (done.segments.length === 0) console.log(`[no speech in ${done.seconds} s]`);
			else if (parsed.values.times) for (const { start, end, text } of done.segments) console.log(`${start.toFixed(2)} ${end.toFixed(2)} ${text}`);
			else console.log(done.text);
			return 0;
		},
	};
}
