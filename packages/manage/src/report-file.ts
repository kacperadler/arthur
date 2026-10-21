import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Filing } from "@arthur/core/plugin";

// How `arthur ticket file <job>` files the report of one of manage's read-only kinds, the audit (spec/roadmap.md, entry 62) and
// the retro (entry 63), and the reports read back: docs/manage.md, "The audit" and "The retro".

// Where a kind's reports go, their title, the line naming the commit the next one starts from, and whether a phone page goes
// beside each.
export type Reports = { readonly folder: string; readonly title: string; readonly commit: string; readonly page?: boolean };

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
	const files = [...(reports.page === true ? [[`${name}.html`, page(text)]] : []), [`${name}.md`, text]];
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

// A report as one self-contained page for a phone: each `#` heading line a heading, the lines between as they are, wrapped.
function page(text: string): string {
	const body = text
		.split(/^(#{1,3} .*)$/m)
		.map((part, index) => {
			if (index % 2 === 0) return part.trim() === "" ? "" : `<p>${escape(part.trim())}</p>`;
			const level = part.indexOf(" ");
			return `<h${level}>${escape(part.slice(level + 1))}</h${level}>`;
		})
		.join("");
	const title = escape(/^# (.*)$/m.exec(text)?.[1] ?? "");
	const style = "body{margin:1em;font:16px/1.5 system-ui,sans-serif}p{white-space:pre-wrap;overflow-wrap:anywhere}";
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${style}</style></head>\n<body>${body}</body></html>\n`;
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
