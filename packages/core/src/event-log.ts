import { closeSync, fstatSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withLock } from "./lock.ts";

// The event log `<home>/events.jsonl` (spec/roadmap.md, entry 5): one JSON line per event, with its sequence number, time and
// the plugin that emitted it. Every process that emits (the daemon, a command) appends under one lock, so lines never
// interleave and numbers never repeat.

export type Event = { readonly seq: number; readonly time: string; readonly plugin: string; readonly name: string; readonly data: unknown };

// How far a reader got: the bytes read (whole lines only) and the next number it takes.
export type Position = { offset: number; next: number };

export const LOG = "events.jsonl";
const CHUNK = 64 * 1024;

// The log open under its lock, so no line is half written while `run` reads or writes it.
export function withLog<T>(home: string, run: (fd: number) => T): T {
	const path = join(home, LOG);
	return withLock(`${path}.lock`, () => {
		const fd = openSync(path, "a+");
		try {
			return run(fd);
		} finally {
			closeSync(fd);
		}
	});
}

export function append(fd: number, plugin: string, name: string, data: unknown): Event {
	const { size } = fstatSync(fd);
	const text = JSON.stringify({ seq: lastSeq(fd, size) + 1, time: new Date().toISOString(), plugin, name, data: data ?? null });
	// A torn last line (a crash while writing it) is ended here, so it stays one skipped line instead of spoiling this one.
	const last = Buffer.alloc(1);
	const torn = size > 0 && readSync(fd, last, 0, 1, size - 1) === 1 && last[0] !== 0x0a;
	writeFileSync(fd, `${torn ? "\n" : ""}${text}\n`);
	return JSON.parse(text) as Event;
}

export function logEnd(fd: number): Position {
	const { size } = fstatSync(fd);
	return { offset: size, next: lastSeq(fd, size) + 1 };
}

// The events numbered `at.next` or later in the whole lines past `at.offset`, oldest first; `at` moves past them. A line still
// being written waits until its line break is there.
export function readNew(fd: number, at: Position, size: number): Event[] {
	if (size <= at.offset) return [];
	const bytes = Buffer.alloc(size - at.offset);
	readSync(fd, bytes, 0, bytes.length, at.offset);
	const whole = bytes.lastIndexOf(0x0a) + 1;
	at.offset += whole;
	return bytes
		.subarray(0, whole)
		.toString("utf8")
		.split("\n")
		.flatMap((line) => {
			const event = parse(line);
			if (event === undefined || event.seq < at.next) return [];
			at.next = event.seq + 1;
			return [event];
		});
}

// Lines that are no event (torn, or broken by hand) are skipped; a log not written yet has no events.
export function readEvents(home: string, fromSeq: number): Event[] {
	let text: string;
	try {
		text = readFileSync(join(home, LOG), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	return text.split("\n").flatMap((line) => {
		const event = parse(line);
		return event !== undefined && event.seq >= fromSeq ? [event] : [];
	});
}

// The number of the last event in the log, read backwards from its end a chunk at a time; 0 when there is none.
function lastSeq(fd: number, size: number): number {
	let carry = Buffer.alloc(0);
	for (let end = size; end > 0; ) {
		const from = Math.max(0, end - CHUNK);
		const chunk = Buffer.alloc(end - from);
		readSync(fd, chunk, 0, chunk.length, from);
		const bytes = Buffer.concat([chunk, carry]);
		// The bytes before the first line break may belong to a line that starts in an earlier chunk.
		const first = bytes.indexOf(0x0a);
		const cut = from === 0 ? 0 : first === -1 ? bytes.length : first + 1;
		carry = bytes.subarray(0, cut);
		for (const line of bytes.subarray(cut).toString("utf8").split("\n").reverse()) {
			const event = parse(line);
			if (event !== undefined) return event.seq;
		}
		end = from;
	}
	return 0;
}

function parse(line: string): Event | undefined {
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch {
		return undefined;
	}
	if (typeof value !== "object" || value === null) return undefined;
	const { seq, time, plugin, name } = value as Readonly<Record<string, unknown>>;
	const valid = Number.isSafeInteger(seq) && (seq as number) > 0 && typeof time === "string" && typeof plugin === "string" && typeof name === "string";
	return valid ? (value as Event) : undefined;
}
