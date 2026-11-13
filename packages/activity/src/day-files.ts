import { appendFileSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Line } from "./activity-line.ts";

// The day files `<folder>/days/YYYY-MM-DD.jsonl` (spec/roadmap.md, entry 100): one line per event, appended whole; a day
// older than `keepDays` removed by its name. docs/activity.md, "Files".

const DAY = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

// Every day file's date, oldest first.
function days(dir: string): string[] {
	return existsSync(dir) ? readdirSync(dir).flatMap((name) => DAY.exec(name)?.[1] ?? []).sort() : [];
}

// Each JSON object of the file of `date`, in file order; a line a crash cut, or no object, is skipped.
function objects(dir: string, date: string): Readonly<Record<string, unknown>>[] {
	return readFileSync(join(dir, `${date}.jsonl`), "utf8").split("\n").flatMap((text) => {
		try {
			const value: unknown = JSON.parse(text);
			return typeof value === "object" && value !== null && !Array.isArray(value) ? [value as Record<string, unknown>] : [];
		} catch {
			return [];
		}
	});
}

// The highest number written in the newest day file that holds a line that reads, undefined when none does; a line a crash cut is skipped.
export function lastSeq(folder: string): number | undefined {
	const dir = join(folder, "days");
	for (const date of days(dir).reverse()) {
		const seqs = objects(dir, date).flatMap(({ seq }) => (Number.isInteger(seq) ? [seq as number] : []));
		if (seqs.length > 0) return Math.max(...seqs);
	}
	return undefined;
}

// The lines of the day files from `from` (the oldest when undefined) to `to`, in order; a line edited into one a reader cannot show
// (no whole `seq`, a `time` that is no instant, an `actor`, `what` or `text` that is no string) is skipped.
export function readLines(folder: string, from: string | undefined, to: string): Line[] {
	const dir = join(folder, "days");
	return days(dir).filter((date) => (from === undefined || date >= from) && date <= to).flatMap((date) =>
		objects(dir, date).filter((line): line is Line => Number.isInteger(line.seq) && ["time", "actor", "what", "text"].every((key) => typeof line[key] === "string") && !Number.isNaN(Date.parse(line.time as string))),
	);
}

// Appends `line` to the file of `date`, after a line break when its last line was cut by a crash, so that line stays one skipped line.
export function append(folder: string, date: string, line: Line): void {
	const dir = join(folder, "days");
	mkdirSync(dir, { recursive: true });
	const fd = openSync(join(dir, `${date}.jsonl`), "a+");
	try {
		const { size } = fstatSync(fd);
		const last = Buffer.alloc(1);
		const torn = size > 0 && readSync(fd, last, 0, 1, size - 1) === 1 && last[0] !== 0x0a;
		appendFileSync(fd, `${torn ? "\n" : ""}${JSON.stringify(line)}\n`);
	} finally {
		closeSync(fd);
	}
}

// Removes each day file more than `keepDays` days before `today`.
export function prune(folder: string, today: string, keepDays: number): void {
	const oldest = new Date(Date.parse(today) - keepDays * 86_400_000).toISOString().slice(0, 10);
	const dir = join(folder, "days");
	for (const date of days(dir)) if (date < oldest) rmSync(join(dir, `${date}.jsonl`), { force: true });
}
