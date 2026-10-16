import { closeSync, fstatSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withLock } from "./lock.ts";

// The event stream (spec/roadmap.md, entry 5): every event is appended to `<home>/events.jsonl`, one JSON line with its
// sequence number, time and the plugin that emitted it, then delivered to the subscribers of its name in this process.
// Every process that emits (the daemon, a command) appends under one lock, so lines never interleave and numbers never repeat.

export type Event = { readonly seq: number; readonly time: string; readonly plugin: string; readonly name: string; readonly data: unknown };

export type Handler = (event: Event) => void | Promise<void>;

// `host.events`, as one plugin sees it.
export type Events = {
	on(name: string, fn: Handler): void;
	// Appends the event to the log, then delivers it; returns it as logged, which is what subscribers and readers get.
	emit(name: string, data: unknown): Event;
	// The logged events whose sequence number is `fromSeq` or later, oldest first.
	read(fromSeq: number): Event[];
};

// The events of one load, shared by its plugins; `plugin` is who subscribes or emits.
export type Bus = {
	on(plugin: string, name: string, fn: Handler): void;
	emit(plugin: string, name: string, data: unknown): Event;
	read(fromSeq: number): Event[];
};

const LOG = "events.jsonl";
const CHUNK = 64 * 1024;

export function eventBus(home: string): Bus {
	const handlers = new Map<string, readonly { readonly plugin: string; readonly fn: Handler }[]>();
	const queue: Event[] = [];
	let delivering = false;
	return {
		on(plugin, name, fn) {
			handlers.set(name, [...(handlers.get(name) ?? []), { plugin, fn }]);
		},
		emit(plugin, name, data) {
			const event = appendEvent(home, plugin, name, data);
			queue.push(event);
			// An event emitted by a handler waits in the queue until the current one has reached every subscriber.
			if (delivering) return event;
			delivering = true;
			for (let next = queue.shift(); next !== undefined; next = queue.shift())
				for (const { plugin, fn } of handlers.get(next.name) ?? []) deliver(plugin, next, fn);
			delivering = false;
			return event;
		},
		read: (fromSeq) => readEvents(home, fromSeq),
	};
}

// A handler that throws, or whose promise rejects, is logged with its plugin's name; the other handlers still get the event.
function deliver(plugin: string, event: Event, fn: Handler): void {
	const failed = (error: unknown) =>
		console.error(`plugin ${plugin}: handler of ${event.name} (event ${event.seq}) failed: ${error instanceof Error ? error.message : String(error)}`);
	try {
		const result = fn(event);
		if (result instanceof Promise) result.catch(failed);
	} catch (error) {
		failed(error);
	}
}

export function appendEvent(home: string, plugin: string, name: string, data: unknown): Event {
	const path = join(home, LOG);
	return withLock(`${path}.lock`, () => {
		const fd = openSync(path, "a+");
		try {
			const { size } = fstatSync(fd);
			const text = JSON.stringify({ seq: lastSeq(fd, size) + 1, time: new Date().toISOString(), plugin, name, data: data ?? null });
			// A torn last line (a crash while writing it) is ended here, so it stays one skipped line instead of spoiling this one.
			const end = Buffer.alloc(1);
			const torn = size > 0 && readSync(fd, end, 0, 1, size - 1) === 1 && end[0] !== 0x0a;
			writeFileSync(fd, `${torn ? "\n" : ""}${text}\n`);
			return JSON.parse(text) as Event;
		} finally {
			closeSync(fd);
		}
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
