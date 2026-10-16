import { closeSync, fstatSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { append, type Event, LOG, logEnd, type Position, readEvents, readNew, withLog } from "./event-log.ts";

// The event stream (spec/roadmap.md, entry 5): every event is appended to the log (`event-log.ts`), then delivered to the
// subscribers of its name in this process. The daemon also follows the log (entry 8), so an event a command emits reaches
// the daemon's subscribers too, and keeps in `<home>/events.delivered` the number of the last event it delivered, so the
// events appended while it was down reach them when it starts again, each once.

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
	// Every `everyMs` delivers the events another process appended; this bus's own were delivered at emit. Starts after the
	// number kept in `<home>/events.delivered`, or from the log's end when there is none or it is no use. Returns the stop of
	// the checks; an emit after it still delivers first what another process appended, so the events keep the log's order.
	follow(everyMs: number): () => void;
};

const DELIVERED = "events.delivered";

export function eventBus(home: string): Bus {
	const kept = join(home, DELIVERED);
	const handlers = new Map<string, readonly { readonly plugin: string; readonly fn: Handler }[]>();
	const queue: Event[] = [];
	let delivering = false;
	// From the first follow on, how far the log was read: every event before `read.next` was delivered, in the log's order.
	// `early`: this bus's own events emitted before the follow, delivered at emit, so never delivered again from the log.
	let read: Position | undefined;
	const early = new Set<number>();
	const drain = () => {
		// An event emitted by a handler waits in the queue until the current one has reached every subscriber.
		if (delivering) return;
		delivering = true;
		for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
			for (const { plugin, fn } of handlers.get(next.name) ?? []) deliver(plugin, next, fn);
			// After the handlers ran: a crash before this line delivers the event again at the next start.
			if (read !== undefined) keep(kept, next.seq);
		}
		delivering = false;
	};
	const catchUp = (fd: number, at: Position, size: number) => {
		for (const event of readNew(fd, at, size)) if (!early.delete(event.seq)) queue.push(event);
	};
	const tick = () => {
		if (read === undefined) return;
		const fd = openSync(join(home, LOG), "a+");
		try {
			const { size } = fstatSync(fd);
			// A log cut or deleted by hand is followed again from its new end.
			if (size < read.offset) read = withLog(home, logEnd);
			else catchUp(fd, read, size);
		} finally {
			closeSync(fd);
		}
		drain();
	};
	return {
		on(plugin, name, fn) {
			handlers.set(name, [...(handlers.get(name) ?? []), { plugin, fn }]);
		},
		emit(plugin, name, data) {
			const event = withLog(home, (fd) => {
				const at = read;
				const { size } = fstatSync(fd);
				if (at !== undefined && size >= at.offset) catchUp(fd, at, size);
				const event = append(fd, plugin, name, data);
				if (at === undefined) early.add(event.seq);
				else read = { offset: fstatSync(fd).size, next: event.seq + 1 };
				return event;
			});
			queue.push(event);
			drain();
			return event;
		},
		read: (fromSeq) => readEvents(home, fromSeq),
		follow(everyMs) {
			read = withLog(home, (fd) => resume(kept, logEnd(fd)));
			const timer = setInterval(tick, everyMs);
			timer.unref();
			return () => clearInterval(timer);
		},
	};
}

// Where the daemon goes on: after the number it kept, or from the log's end at a first start or when the number is no use.
function resume(kept: string, end: Position): Position {
	let text: string;
	try {
		text = readFileSync(kept, "utf8").trim();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return end;
		throw error;
	}
	const last = Number(text);
	if (!/^\d+$/.test(text) || !Number.isSafeInteger(last)) {
		console.error(`arthur run: ${kept} holds no whole number; following the event log from its end`);
		return end;
	}
	if (last < end.next - 1) return { offset: 0, next: last + 1 };
	if (last > end.next - 1) console.error(`arthur run: ${kept} holds ${last}, past the log's last event ${end.next - 1}; following the event log from its end`);
	return end;
}

// Whole, through a temporary file, so a crash leaves the number before or the one after.
function keep(path: string, seq: number): void {
	writeFileSync(`${path}.tmp`, `${seq}\n`);
	renameSync(`${path}.tmp`, path);
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
