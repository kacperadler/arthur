import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Host, PhoneFrom } from "@arthur/core/plugin";
import { reportPage } from "./report-file.ts";
import { RED, repeats } from "./repeats.ts";
import { RETRO_TASK, sendFile } from "./retro.ts";

// `arthur repeats` and `/repeats` (AR0562): the digest of repeats.ts printed, or sent as a page in the report style; with
// `--retro` (`/repeats retro`) the retro kind started with the focus on decisions, its prompt holding the digest of its period
// (retro.ts). docs/commands/repeats.md.

const USAGE = "usage: arthur repeats [--project <name>] [--since <date|decision id>], or arthur repeats [--project <name>] --retro ['<focus>']";
const SINCE = /^(?:\d{4}-\d{2}-\d{2}|[A-Z]+-D\d+)$/;

export function repeatsCommand(host: Host): void {
	host.commands.register({
		name: "repeats",
		doc: new URL("../docs/commands/repeats.md", import.meta.url),
		phone: {
			about: "what the owner decides again and again, as a page; /repeats retro <focus> starts a decisions retro",
			reply: (text, from) => {
				const retro = /^retro(?:\s+([\s\S]*))?$/.exec(text.trim());
				if (text.trim() === "") return sendDigest(host, from);
				return retro === null ? "usage: /repeats [retro [<focus>]]" : startRetro(host, undefined, retro[1]?.trim() ?? "");
			},
		},
		async run({ args, project }) {
			let parsed: { readonly values: { readonly since?: string; readonly retro?: boolean }; readonly positionals: readonly string[] };
			try {
				parsed = parseArgs({ args: [...args], options: { since: { type: "string" }, retro: { type: "boolean" } }, allowPositionals: true });
			} catch {
				return (console.error(USAGE), 2);
			}
			const { values, positionals } = parsed;
			const since = values.since;
			if (since !== undefined && (values.retro === true || !SINCE.test(since))) return (console.error(USAGE), 2);
			if (positionals.length > (values.retro === true ? 1 : 0)) return (console.error(USAGE), 2);
			console.log(values.retro === true ? await startRetro(host, project, positionals[0]?.trim() ?? "") : repeats(host, project, since));
		},
	});
}

// The retro kind on `project`, its task the retro's with the focus on decisions; refused, it throws.
async function startRetro(host: Host, project: string | undefined, focus: string): Promise<string> {
	const job = await host.jobs.spawn({ task: `${RETRO_TASK}\n\nFocus: decisions${focus === "" ? "" : `: ${focus}`}`, kind: "retro", ...(project === undefined ? {} : { project }) });
	if (job.failed !== undefined) throw new Error(`job ${job.id} did not start: ${job.failed}`);
	return `retro: started job ${job.id}`;
}

// `/repeats`: the main project's digest as a page in manage's own folder, written whole and renamed, then sent.
function sendDigest(host: Host, from: PhoneFrom): Promise<string> {
	const name = `repeats-${host.clock.local().date}.html`;
	const file = join(host.folder, name);
	writeFileSync(`${file}.tmp`, reportPage(repeats(host, undefined), RED));
	renameSync(`${file}.tmp`, file);
	return sendFile(host, from, file, name);
}
