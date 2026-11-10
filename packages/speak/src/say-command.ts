import { copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Command, Host } from "@arthur/core/plugin";

// `arthur say <text> [--out <file>]` (AR0553): a text spoken into a voice note through `speak.say`, the queue and limits a
// reply goes through. docs/commands/say.md.

const USAGE = "usage: arthur say <text> [--out <file>]";

export function sayCommand(host: Pick<Host, "call">): Command {
	return {
		name: "say",
		doc: new URL("../docs/commands/say.md", import.meta.url),
		async run({ args }) {
			let parsed;
			try {
				parsed = parseArgs({ args: [...args], options: { out: { type: "string" } }, allowPositionals: true, strict: true });
			} catch (error) {
				console.error(`${(error as Error).message}\n${USAGE}`);
				return 2;
			}
			const text = parsed.positionals.join(" ");
			const { out } = parsed.values;
			if (text.trim() === "" || out === "") {
				console.error(USAGE);
				return 2;
			}
			let path: string;
			try {
				path = await host.call<Promise<string>>("speak.say", text);
				if (out !== undefined) {
					const spoken = path;
					path = resolve(out);
					// Moved, or on a failed copy removed: either way no copy stays in .arthur/speak/.
					try {
						copyFileSync(spoken, path);
					} finally {
						rmSync(spoken);
					}
				}
			} catch (error) {
				console.error(`refused: ${(error as Error).message}`);
				return 1;
			}
			console.log(path);
			return 0;
		},
	};
}
