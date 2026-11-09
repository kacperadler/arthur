import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Filing } from "@arthur/core/plugin";

// How `arthur ticket file <job>` files the report of one of manage's read-only kinds, the audit (spec/roadmap.md, entry 62),
// the retro (entry 63) and the pyramid audit (AR0563), and the reports read back: docs/manage.md, "The audit", "The retro"
// and "The pyramid audit".

// Where a kind's reports go, their title, the line naming the commit the next one starts from, and the page written beside
// each, from the report's text.
export type Reports = { readonly folder: string; readonly title: string; readonly commit: string; readonly page?: (report: string) => string };

// A report's name: the day its job started, then `-2`, `-3` for a second and third that day.
const NAME = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.(md|html)$/;

// `<folder>/<date>.md`, the date the job's id starts with (the day it started, in core.timeZone), or the next `-<n>.md` when
// that day has one, and with `page` its phone page `<date>.html`; never over a file, and never a job filed before.
export function fileReport(reports: Reports, { root, job }: Filing): string {
	const folder = join(root, reports.folder);
	mkdirSync(folder, { recursive: true });
	const names = readdirSync(folder);
	const filed = names.find((name) => name.endsWith(".md") && NAME.test(name) && readFileSync(join(folder, name), "utf8").includes(`\n- Job: ${job.id}\n`));
	if (filed !== undefined) throw new Error(`${job.id} is already filed as ${reports.folder}/${filed}`);
	const date = job.id.slice(0, 10);
	let name = date;
	for (let n = 2; names.includes(`${name}.md`) || names.includes(`${name}.html`); n++) name = `${date}-${n}`;
	const text = `# ${reports.title} ${date}\n\n- Job: ${job.id}\n- ${reports.commit}: ${job.base}\n\n## Final message\n\n${job.result}`;
	// The page first: the report, which the next filing and the next job read, appears only beside its page.
	const files = [...(reports.page === undefined ? [] : [[`${name}.html`, reports.page(text)]]), [`${name}.md`, text]];
	const draft = join(folder, `.report.${process.pid}`);
	const linked: string[] = [];
	try {
		for (const [file = "", content = ""] of files) {
			writeFileSync(draft, content);
			// A link, unlike a rename, never replaces a file a second filer wrote meanwhile.
			try {
				linkSync(draft, join(folder, file));
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`${reports.folder}/${file} was written meanwhile; file ${job.id} again`);
				throw error;
			}
			linked.push(file);
			rmSync(draft);
		}
	} catch (error) {
		for (const file of linked) rmSync(join(folder, file));
		throw error;
	} finally {
		rmSync(draft, { force: true });
	}
	return `${reports.folder}/${name}.md`;
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The rules a page in the report style uses of .agents/arthur/criteria/report.md's base style (AR-D298), with `.cols` and
// `.tag`; its header never holds a code span.
const STYLE = [
	":root{--ink:#0a0a0a;--paper:#ffffff;--grey:#f2f2f2;--blue:#0033ff;--red:#d40000}*{box-sizing:border-box}",
	'body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif}',
	"header{background:var(--ink);color:var(--paper);padding:32px 18px 24px;text-align:center;border-bottom:6px solid var(--blue)}header ul{list-style:none;padding:0}",
	"header h1{margin:0 auto;max-width:860px;font-size:30px;line-height:1.1;font-weight:800}header p{margin:12px auto 0;max-width:720px;color:#cfcfcf}",
	"main{max-width:900px;margin:0 auto;padding:0 16px 48px}li{margin:.3em 0}li.sub{margin-left:1.5em;list-style:circle}.red{color:var(--red)}",
	"h2{font-size:22px;line-height:1.2;font-weight:800;margin:40px 0 6px;padding-bottom:6px;border-bottom:3px solid var(--ink);text-align:center}",
	"code{font:13px ui-monospace,Menlo,monospace;background:var(--grey);color:var(--ink);padding:1px 4px;overflow-wrap:anywhere}",
	".cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0}.cols>div{border:2px solid var(--ink);padding:0 14px}.cols>div.after{border-color:var(--blue)}",
	".cols p{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,Menlo,monospace}@media (max-width:640px){.cols{grid-template-columns:1fr}}",
	".tag{display:inline-block;font-size:12px;font-weight:700;padding:1px 6px;border:1.5px solid var(--ink);border-radius:3px;background:var(--paper);color:var(--ink)}",
	".tag.code{background:var(--ink);color:var(--paper)}.tag.static{border-color:var(--blue);color:var(--blue)}.tag.prose{border-color:#555555;color:#555555}.tag.you{border-color:var(--red);color:var(--red)}",
].join("");
const TAGS: Readonly<Record<string, string>> = { codebase: "code", "static analysis": "static", prose: "prose", "human review": "you" };

// Markdown as one self-contained page in the report style (`/repeats`, a retro's page, a pyramid's before and after page): its
// title and the lines before its first `## ` in the header, the rest in `main`, a `- ` line as a list item (indented, one level
// in), a backticked span as code, a `**` span around a word run as bold, each line of a `red` section in red, the `> ` lines
// after a `Before:` and an `After:` line side by side, a fenced block in them as typed without its fences, and the layer of a
// `Now at:` or `Move to:` line as its tag.
export function reportPage(text: string, red: readonly string[] = []): string {
	// A code span first, so the `**` in it stays as typed; a bold span's own code spans are code too. An opening mark follows the
	// line's start, a space, `(`, `[` or a quote, a closing one is followed by its end, a space, a closing bracket, a quote or a
	// stop, and neither touches a space, `/` or `*` inside: `2 ** 3`, `**/*.ts`, `src/**/*.ts` and `a**b` stay as typed. A bold
	// span holds no `**` outside its code spans, so a mark that cannot close ends it (`f(**kw) and **b**` bolds only `b`).
	const spans = /`([^`]+)`|(?<![^\s([\x22\x27])\*\*(?=[^\s/*])((?:\x60[^\x60]+\x60|(?!\*\*).)+?)(?<=[^\s/*])\*\*(?![^\s)\]\x22\x27.,;:!?])/g;
	const inline = (line: string) =>
		escape(line).replace(spans, (_, chip, bold) =>
			chip !== undefined ? `<code>${chip}</code>` : `<strong>${bold.replace(/`([^`]+)`/g, "<code>$1</code>")}</strong>`,
		);
	const out: string[] = [];
	let [side, section, quote] = ["", "", [] as string[]];
	// The open fence of the side's quote, `""` for none.
	let fence = "";
	// The open side's quote and its end; `close` ends the pair too.
	const column = () => void (out.push(`<p>${quote.splice(0).join("\n")}</p></div>`), (fence = ""));
	const close = () => {
		if (side !== "") (column(), out.push("</div>"));
		side = "";
	};
	for (const line of text.split("\n")) {
		if (line === "Before:" || line === "After:") {
			if (side === "Before" && line === "After:") column();
			else (close(), out.push(`<div class="cols">${line === "After:" ? "<div><h3>Before</h3><p></p></div>" : ""}`));
			out.push(line === "After:" ? '<div class="after"><h3>After</h3>' : "<div><h3>Before</h3>");
			side = line.slice(0, -1);
		} else if (side !== "" && (line.startsWith(">") || line.trim() === "")) {
			const quoted = line.replace(/^> ?/, "");
			// A fence opens with 3 or more backticks or tildes, and only as many or more of the same with nothing after close it.
			const [, run = "", rest = ""] = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(quoted) ?? [];
			if (run !== "" && (fence === "" || (run.startsWith(fence) && rest.trim() === ""))) fence = fence === "" ? run : "";
			else if (line.startsWith(">")) quote.push(fence !== "" ? escape(quoted) : inline(quoted));
		} else {
			close();
			const level = /^(#{1,3}) /.exec(line)?.[1]?.length;
			const layer = /^(Now at|Move to): (.+)$/.exec(line);
			const item = /^(\s*)- /.exec(line);
			if (level === 2) section = line.slice(3);
			if (level !== undefined && line !== "## Final message") out.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`);
			else if (layer !== null) out.push(`<p>${layer[1]}: <span class="tag ${TAGS[layer[2]?.trim().toLowerCase() ?? ""] ?? ""}">${inline(layer[2] ?? "")}</span></p>`);
			else if (item !== null) {
				const classes = [item[1] === "" ? "" : "sub", red.includes(section) ? "red" : ""].filter(Boolean).join(" ");
				out.push(`<li${classes === "" ? "" : ` class="${classes}"`}>${inline(line.slice(item[0].length))}</li>`);
			} else if (line.trim() !== "" && level === undefined) out.push(`<p>${inline(line)}</p>`);
		}
	}
	close();
	const body = out.join("\n").replace(/(?:^<li.*<\/li>$\n?)+/gm, (items) => `<ul>\n${items.trimEnd()}\n</ul>\n`);
	const at = body.includes("<h2>") ? body.indexOf("<h2>") : body.length;
	const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(/^# (.*)$/m.exec(text)?.[1] ?? "")}</title>`;
	return `<!doctype html>\n<html lang="en"><head>${head}<style>${STYLE}</style></head>\n<body>\n<header>\n${body.slice(0, at).trimEnd()}\n</header>\n<main>\n${body.slice(at).trimEnd()}\n</main>\n</body></html>\n`;
}

// The reports in `root` with extension `ext`, newest first by their date and number, each `<folder>/<name>`; none without the
// folder.
export function newest(root: string, reports: Reports, ext: "md" | "html"): string[] {
	const folder = join(root, reports.folder);
	if (!existsSync(folder)) return [];
	const order = (name: string) => {
		const [, date = "", n = "1"] = NAME.exec(name) ?? [];
		return `${date}-${n.padStart(6, "0")}`;
	};
	const names = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && NAME.exec(entry.name)?.[3] === ext).map((entry) => entry.name);
	return names.sort((a, b) => order(b).localeCompare(order(a))).map((name) => `${reports.folder}/${name}`);
}

// The newest report with its commit line: that commit and the report's path. A report without the line (written by hand) is
// passed over.
export function lastReport(root: string, reports: Reports): { readonly commit: string; readonly path: string } | undefined {
	const line = new RegExp(`^- ${reports.commit}: ([0-9a-f]{7,40})$`, "m");
	for (const path of newest(root, reports, "md")) {
		const commit = line.exec(readFileSync(join(root, path), "utf8"))?.[1];
		if (commit !== undefined) return { commit, path };
	}
	return undefined;
}
