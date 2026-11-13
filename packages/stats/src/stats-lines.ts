import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { dirname } from "node:path";

// The stats plugin's lines (spec/roadmap.md, entry 109): `runs.jsonl` and each `sessions/<session>.jsonl` of its folder hold one JSON
// object a line, each appended whole; and the numbers a line holds, per `<provider>/<model>`: docs/stats.md.

export type Line = Readonly<Record<string, unknown>>;
export type Usage = Readonly<Record<string, Readonly<Record<(typeof FIELDS)[number], number>>>>;
const FIELDS = ["messages", "input", "output", "cacheRead", "cacheWrite", "cost"] as const;

// Without the float sums' noise (0.1 + 0.2): six decimals, finer than any cost omp reports.
export const round = (value: number): number => Math.round(value * 1e6) / 1e6;
const number = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

// `a` plus `b` times `sign`, per model and field; a field that is no number counts 0, as in a line edited by hand.
export function addUsage(a: unknown, b: unknown, sign = 1): Usage {
	const [left, right] = [a, b].map((each) => (typeof each === "object" && each !== null ? (each as Record<string, Record<string, unknown> | null>) : {}));
	const models = [...new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})])];
	return Object.fromEntries(models.map((model) => [model, Object.fromEntries(FIELDS.map((key) => [key, round(number(left?.[model]?.[key]) + sign * number(right?.[model]?.[key]))]))])) as Usage;
}

// Each JSON object of the file, in order; a line that is none (cut by a crash, edited by hand) is skipped, and counted in
// `unread`. None for a missing file.
export function readLines(path: string, unread = { lines: 0 }): Line[] {
	let text = "";
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	return text.split("\n").flatMap((line) => {
		let value: unknown;
		try {
			value = JSON.parse(line);
		} catch {}
		if (typeof value === "object" && value !== null && !Array.isArray(value)) return [value as Line];
		if (line !== "") unread.lines++;
		return [];
	});
}

// One line at the file's end; a last line a crash cut gets its line break first, so it stays one skipped line, as the event log does.
export function appendLine(path: string, line: Line): void {
	mkdirSync(dirname(path), { recursive: true });
	const size = statSync(path, { throwIfNoEntry: false })?.size ?? 0;
	const last = Buffer.alloc(1);
	if (size > 0) {
		const fd = openSync(path, "r");
		readSync(fd, last, 0, 1, size - 1);
		closeSync(fd);
	}
	appendFileSync(path, `${size > 0 && last[0] !== 0x0a ? "\n" : ""}${JSON.stringify(line)}\n`);
}
