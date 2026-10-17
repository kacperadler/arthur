import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// The coordinator's inbox, the plugin's side (spec/roadmap.md, entry 24): every message for the coordinator becomes one file
// `<folder>/inbox/queued/<event's number>`, which the inbox extension (inbox-extension.ts) hands to the coordinator's agent;
// the replies it writes to `<folder>/outbox/` are emitted here: docs/commands/coordinator.md, "The coordinator's inbox".

// A queued message: a human's from a channel, or Arthur's own (a job's end, a schedule action) without one.
export type Message = { readonly channel?: string; readonly text: string };

const SWEEP_MS = 500;
const RESULT_LINES = 15;

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

export function inbox(host: Host): { start(): void; stop(): void } {
	const { folder } = host;
	host.events.on("message-received", (event) => {
		const { channel, text: said } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		if (text(channel) && text(said)) queue(folder, event.seq, { channel, text: said });
		else console.error(`orchestration: message-received (event ${event.seq}) ignored: expected { channel, text }, both non-empty text`);
	});
	host.events.on("coordinator-message", (event) => {
		const said = ((event.data ?? {}) as Readonly<Record<string, unknown>>).text;
		if (text(said)) queue(folder, event.seq, { text: said });
		else console.error(`orchestration: coordinator-message (event ${event.seq}) ignored: expected { text }, non-empty text`);
	});
	host.events.on("job-ended", (event) => queue(folder, event.seq, { text: wake(host, event.data) }));
	for (const name of ["job-started", "job-state", "job-ended"]) host.events.on(name, () => footer(host));
	let timer: NodeJS.Timeout | undefined;
	return {
		start() {
			footer(host);
			timer = setInterval(() => sweep(host), SWEEP_MS);
		},
		stop() {
			clearInterval(timer);
			sweep(host);
		},
	};
}

// One file per event, written whole and linked in; skipped when that event is queued, handed over or answered already, looked
// for in the order the extension moves files, so a file moving meanwhile is still found.
export function queue(folder: string, seq: number, message: Message): void {
	const box = join(folder, "inbox");
	if (["queued", "turn", "answered"].some((step) => existsSync(join(box, step, String(seq))))) return;
	mkdirSync(join(box, "queued"), { recursive: true });
	const draft = join(box, `.draft-${process.pid}-${seq}`);
	writeFileSync(draft, JSON.stringify(message));
	try {
		linkSync(draft, join(box, "queued", String(seq)));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
	} finally {
		rmSync(draft, { force: true });
	}
}

// The wake: how the run ended, the first lines of its final message, its project when not the main one, and what the plugins
// add for it (the procedure of its kind).
function wake(host: Host, data: unknown): string {
	const job = (data ?? {}) as Readonly<Record<string, unknown>>;
	const id = String(job.id);
	const lines = [`Job ${id} ended its run: ${String(job.state)}${text(job.reason) ? ` (${job.reason})` : ""}.`];
	const main = host.collect("projects").length > 0 ? host.board.projects()[0]?.name : undefined;
	if (main !== undefined && job.project !== main) lines.push(`Project: ${String(job.project)}.`);
	const result = host.jobs.result(id).trimEnd().split("\n");
	if (result.join("") === "") lines.push("Its final message: none.");
	else {
		const cut = result.length > RESULT_LINES ? ` (the first ${RESULT_LINES} of ${result.length} lines)` : "";
		lines.push(`Its final message${cut}:`, ...result.slice(0, RESULT_LINES));
	}
	for (const line of host.collect("coordinator.wake", job)) if (text(line)) lines.push(line);
	return lines.join("\n");
}

// `arthur · N running: <short ids>`, empty when none runs; the extension shows it in the coordinator's footer.
function footer(host: Host): void {
	const running = host.jobs.running();
	const shown = running.length === 0 ? "" : `arthur · ${running.length} running: ${running.map((id) => id.split("-").at(-1)).join(", ")}`;
	writeFileSync(join(host.folder, "footer.new"), shown);
	renameSync(join(host.folder, "footer.new"), join(host.folder, "footer"));
}

// Each reply or notice the extension wrote, oldest first, emitted and then moved to `outbox/sent/`.
function sweep(host: Host): void {
	const outbox = join(host.folder, "outbox");
	if (!existsSync(outbox)) return;
	for (const name of readdirSync(outbox).filter((each) => each.endsWith(".json")).sort()) {
		const file = JSON.parse(readFileSync(join(outbox, name), "utf8")) as { text: string; answers: number[]; channels: string[] } | { notice: string };
		if ("notice" in file) host.events.emit("notice", { text: file.notice });
		else host.events.emit("coordinator-replied", { text: file.text, answers: file.answers, channels: file.channels });
		mkdirSync(join(outbox, "sent"), { recursive: true });
		renameSync(join(outbox, name), join(outbox, "sent", name));
	}
}
