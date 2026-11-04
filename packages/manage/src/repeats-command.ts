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
// The rules this page uses of .agents/arthur/criteria/report.md's base style (AR-D298); its header never holds a code span.
const STYLE = [
	":root{--ink:#0a0a0a;--paper:#ffffff;--grey:#f2f2f2;--blue:#0033ff;--red:#d40000}*{box-sizing:border-box}",
	'body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif}',
	"header{background:var(--ink);color:var(--paper);padding:32px 18px 24px;text-align:center;border-bottom:6px solid var(--blue)}",
	"header h1{margin:0 auto;max-width:860px;font-size:30px;line-height:1.1;font-weight:800}header p{margin:12px auto 0;max-width:720px;color:#cfcfcf}",
	"main{max-width:900px;margin:0 auto;padding:0 16px 48px}li{margin:.3em 0}.red{color:var(--red)}",
	"h2{font-size:22px;line-height:1.2;font-weight:800;margin:40px 0 6px;padding-bottom:6px;border-bottom:3px solid var(--ink);text-align:center}",
	"code{font:13px ui-monospace,Menlo,monospace;background:var(--grey);color:var(--ink);padding:1px 4px;overflow-wrap:anywhere}",
].join("");

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

// The digest as one self-contained page for a phone: its title and first line in a header, the rest in `main` from the first
// section on, a backticked span as code, and each line of a RED section in red.
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
	const at = body.indexOf("<h2>");
	const head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">';
	return `<!doctype html>\n<html lang="en"><head>${head}<title>${title}</title><style>${STYLE}</style></head>\n<body>\n<header>\n${body.slice(0, at).trimEnd()}\n</header>\n<main>\n${body.slice(at).trimEnd()}\n</main>\n</body></html>\n`;
}
