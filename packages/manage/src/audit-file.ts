import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Filing } from "@arthur/core/plugin";

// How `arthur ticket file <audit job>` files an audit (spec/roadmap.md, entry 62), and the last audit read back from the
// reports: docs/manage.md, "The audit".

export const QUALITY = "spec/quality";
// A report's name: the day its audit started, then `-2`, `-3` for a second and third audit that day.
const REPORT = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/;
const AUDITED = /^- Commit audited: ([0-9a-f]{7,40})$/m;

// `spec/quality/<date>.md`, the date the job's id starts with (the day it started, in core.timeZone), or the next `-<n>.md`
// when that day has one; never over a file, and never a job filed before. Its `Commit audited` is where the next audit starts.
export function fileAudit({ root, job }: Filing): string {
	const folder = join(root, QUALITY);
	mkdirSync(folder, { recursive: true });
	const reports = readdirSync(folder).filter((name) => REPORT.test(name));
	const filed = reports.find((name) => readFileSync(join(folder, name), "utf8").includes(`\n- Job: ${job.id}\n`));
	if (filed !== undefined) throw new Error(`${job.id} is already filed as ${QUALITY}/${filed}`);
	const date = job.id.slice(0, 10);
	let name = `${date}.md`;
	for (let n = 2; reports.includes(name); n++) name = `${date}-${n}.md`;
	const draft = join(folder, `.audit.${process.pid}`);
	writeFileSync(draft, `# Audit ${date}\n\n- Job: ${job.id}\n- Commit audited: ${job.base}\n\n## Final message\n\n${job.result}`);
	try {
		// A link, unlike a rename, never replaces a file a second filer wrote meanwhile.
		linkSync(draft, join(folder, name));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`${QUALITY}/${name} was written meanwhile; file ${job.id} again`);
		throw error;
	} finally {
		rmSync(draft, { force: true });
	}
	return `${QUALITY}/${name}`;
}

// The newest report in `root` with a `Commit audited` line, by its date and number: that commit and the report's path. A
// report without the line (written by hand) is passed over.
export function lastAudit(root: string): { readonly commit: string; readonly path: string } | undefined {
	const folder = join(root, QUALITY);
	if (!existsSync(folder)) return undefined;
	const order = (name: string) => {
		const [, date = "", n = "1"] = REPORT.exec(name) ?? [];
		return `${date}-${n.padStart(6, "0")}`;
	};
	const reports = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && REPORT.test(entry.name)).map((entry) => entry.name);
	for (const name of reports.sort((a, b) => order(b).localeCompare(order(a)))) {
		const commit = AUDITED.exec(readFileSync(join(folder, name), "utf8"))?.[1];
		if (commit !== undefined) return { commit, path: `${QUALITY}/${name}` };
	}
	return undefined;
}
