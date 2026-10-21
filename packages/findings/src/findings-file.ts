import { renameSync, writeFileSync } from "node:fs";

// The reader of `findings.md` (templates/findings.md): an entry is its heading `## F<n>. <title>` up to the next `#` or `##`
// heading, and of its lines the merge reads only `- Kind:`, `- Budget:` and `- Status:`, the first of each.

export type Finding = {
	readonly n: number;
	readonly title: string;
	// The entry's lines below its heading, but its Status line, trimmed.
	readonly body: string;
	readonly kind?: string;
	readonly budget?: string;
	readonly status?: string;
	// The index of its Status line in the file's lines, which `settle` rewrites.
	readonly at?: number;
};

const HEADING = /^## F(\d+)\.[ \t]+(.*\S)[ \t]*$/;
const FIELD = /^- (Kind|Budget|Status):[ \t]*(.*?)[ \t]*$/;

export function readFindings(text: string): Finding[] {
	const lines = text.split("\n");
	const starts = lines.flatMap((line, index) => (HEADING.test(line) ? [index] : []));
	return starts.map((start) => {
		const [, n = "", title = ""] = HEADING.exec(lines[start] ?? "") ?? [];
		const next = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line));
		const fields: { Kind?: string; Budget?: string; Status?: string } = {};
		let at: number | undefined;
		for (let index = start + 1; index < (next === -1 ? lines.length : next); index++) {
			const [, key, value = ""] = FIELD.exec(lines[index] ?? "") ?? [];
			if (key !== "Kind" && key !== "Budget" && key !== "Status") continue;
			if (fields[key] !== undefined) continue;
			fields[key] = value;
			if (key === "Status") at = index;
		}
		const body = lines.slice(start + 1, next === -1 ? lines.length : next).filter((_, index) => start + 1 + index !== at);
		return { n: Number(n), title, body: body.join("\n").trim(), kind: fields.Kind, budget: fields.Budget, status: fields.Status, at };
	});
}

// `text` with the Status line of each finding given set to its new status, written whole to `path` under a temporary name.
export function settle(path: string, text: string, statuses: readonly (readonly [Finding, string])[]): void {
	const lines = text.split("\n");
	for (const [finding, status] of statuses) if (finding.at !== undefined) lines[finding.at] = `- Status: ${status}`;
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, lines.join("\n"));
	renameSync(temporary, path);
}
