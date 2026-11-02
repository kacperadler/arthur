import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Host, PhoneFrom } from "@arthur/core/plugin";
import { RED, repeats } from "./repeats.ts";
import { RETRO_TASK, sendFile } from "./retro.ts";

// `arthur repeats` and `/repeats` (AR0562): the digest of repeats.ts printed, or sent as a page in the report style; with
// `--retro` (`/repeats retro`) the retro kind started with the focus on decisions, its prompt holding the digest of its period
// (retro.ts). docs/commands/repeats.md.

const USAGE = "usage: arthur repeats [--project <name>] [--since <date|decision id>], or arthur repeats [--project <name>] --retro ['<focus>']";
const SINCE = /^(?:\d{4}-\d{2}-\d{2}|[A-Z]+-D\d+)$/;
// The report style the owner set (AR-D298): black on white, centred, blue as the accent, red only for what matters.
const STYLE =
	"body{margin:0 auto;max-width:46em;padding:1em;font:16px/1.5 system-ui,sans-serif;color:#000;background:#fff}h1,h2,h3{color:#1d4ed8}code{color:#1d4ed8;overflow-wrap:anywhere}li{margin:.3em 0}.red{color:#b91c1c}";

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
	writeFileSync(`${file}.tmp`, page(repeats(host, undefined)));
	renameSync(`${file}.tmp`, file);
	return sendFile(host, from, file, name);
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The digest as one self-contained page for a phone: headings, lists and paragraphs, a backticked span as code, and each line
// of a RED section in red.
function page(markdown: string): string {
	let section = "";
	const body = markdown
		.split("\n")
		.map((line) => {
			const text = escape(line.replace(/^(?:#{1,3} |- )/, "")).replace(/`([^`]+)`/g, "<code>$1</code>");
			const level = /^(#{1,3}) /.exec(line)?.[1]?.length;
			if (level === 2) section = line.slice(3);
			if (level !== undefined) return `<h${level}>${text}</h${level}>`;
			if (line.startsWith("- ")) return `<li${RED.includes(section) ? ' class="red"' : ""}>${text}</li>`;
			return line.trim() === "" ? "" : `<p>${text}</p>`;
		})
		.filter(Boolean)
		.join("\n")
		.replace(/(?:^<li.*<\/li>$\n?)+/gm, (items) => `<ul>\n${items.trimEnd()}\n</ul>\n`);
	const title = escape(/^# (.*)$/m.exec(markdown)?.[1] ?? "Repeats");
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${STYLE}</style></head>\n<body>\n${body.trimEnd()}\n</body></html>\n`;
}
