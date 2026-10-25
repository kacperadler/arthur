import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe } from "@arthur/core";
import { type Received, received, turnText } from "@arthur/core/parts";
import type { Host } from "@arthur/core/plugin";
import { byState } from "./context.ts";
import { redact, redactValues } from "./credential.ts";
import { handOver } from "./hand-over.ts";
import { held } from "./silent.ts";

// The coordinator's inbox, the plugin's side (spec/roadmap.md, entries 24 and 49): every message for the coordinator becomes one
// file `<folder>/inbox/queued/<event's number>-<its time in ms>`, which the inbox extension (inbox-extension.ts) hands to the
// coordinator's agent; an owner's message waits in `inbox/received/` until its parts are resolved (`turnText`), one message at a
// time in the order of their numbers, so none overtakes one before it and a restart resolves what it cut. The replies the
// extension writes to `<folder>/outbox/` are emitted here: docs/commands/coordinator.md, "The coordinator's inbox".

// A queued message: a human's from a channel, or Arthur's own without one: a job's end, or a plugin's, which names it.
export type Message = { readonly channel?: string; readonly plugin?: string; readonly text: string };

const SWEEP_MS = 500;
const RESULT_LINES = 15;

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

export function inbox(host: Host): { start(): void; stop(): void } {
	const { folder } = host;
	const waiting = join(folder, "inbox", "received");
	const next = () => (existsSync(waiting) ? readdirSync(waiting).filter((name) => /^\d+-\d+$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b))[0] : undefined);
	// `resolving` is the last pass over `received/`, `scheduled` whether one more waits behind it; passes run only once started.
	let [resolving, scheduled, started] = [Promise.resolve(), false, false];
	const resolve = () => {
		if (scheduled || !started) return;
		scheduled = true;
		resolving = resolving
			.then(async () => {
				scheduled = false;
				for (let name = next(); name !== undefined && started; name = next()) {
					const file = join(waiting, name);
					const message = parse(file);
					if (typeof message === "string") {
						renameSync(file, `${file}.broken`);
						console.error(`orchestration: ${file} ${message}; set aside as ${file}.broken`);
						continue;
					}
					const [seq, ms] = [parseInt(name), Number(name.split("-")[1])];
					// The claims' replies the log holds after this message, from a pass a restart cut before the queue, are not emitted
					// again; a log cut by hand, whose numbers start again, holds none.
					const [own, ...after] = host.events.read(seq);
					const logged = own?.seq === seq && Date.parse(own.time) === ms ? after.filter((event) => event.name === "coordinator-replied" && JSON.stringify(((event.data ?? {}) as Readonly<Record<string, unknown>>).answers) === `[${seq}]`) : [];
					const events = { ...host.events, emit: (event: string, data: unknown) => (event === "coordinator-replied" ? logged.shift() : undefined) ?? host.events.emit(event, data) };
					const said = await turnText({ collectEach: host.collectEach, events }, seq, message);
					queue(folder, { seq, time: new Date(ms).toISOString() }, { channel: message.channel, text: said });
					rmSync(file);
				}
			})
			.catch((error: Error) => console.error(`orchestration: resolving the messages in ${waiting}: ${error.message}`));
	};
	host.events.on("message-received", (event) => {
		const message = received(event.data);
		if (typeof message === "string") return console.error(`orchestration: message-received (event ${event.seq}) ignored: ${message}`);
		const name = `${event.seq}-${Date.parse(event.time)}`;
		if (["inbox/received", "inbox/queued", "inbox/turn", "inbox/answered"].some((box) => existsSync(join(folder, box, name)))) return;
		mkdirSync(waiting, { recursive: true });
		writeFileSync(join(waiting, `.${name}`), JSON.stringify(message));
		renameSync(join(waiting, `.${name}`), join(waiting, name));
		resolve();
	});
	host.events.on("coordinator-message", (event) => {
		const said = ((event.data ?? {}) as Readonly<Record<string, unknown>>).text;
		if (text(said)) queue(folder, event, { plugin: event.plugin, text: said });
		else console.error(`orchestration: coordinator-message (event ${event.seq}) ignored: expected { text }, non-empty text`);
	});
	host.events.on("job-ended", (event) => queue(folder, event, { text: wake(host, event.data) }));
	host.provide("coordinator.turn", (name: unknown, data: unknown, more: unknown) => turn(host, name, data, more));
	for (const name of ["job-started", "job-state", "job-ended"]) host.events.on(name, () => footer(host));
	let timer: NodeJS.Timeout | undefined;
	return {
		start() {
			footer(host);
			timer = setInterval(() => sweep(host), SWEEP_MS);
			started = true;
			resolve();
		},
		stop() {
			started = false;
			clearInterval(timer);
			sweep(host);
		},
	};
}

// A message `received/` holds, else why it is not one: a file that does not parse, or was edited into another shape.
function parse(file: string): Received | string {
	try {
		return received(JSON.parse(readFileSync(file, "utf8")));
	} catch {
		return "does not parse";
	}
}

// One file per event, written whole and linked in; skipped when that event is queued, handed over or answered already, looked
// for in the order the extension moves files, so a file moving meanwhile is still found. Its name holds the event's time too,
// so a log cut by hand, whose numbers start again, never matches an old event's file.
export function queue(folder: string, event: { readonly seq: number; readonly time: string }, message: Message): void {
	const box = join(folder, "inbox");
	const name = `${event.seq}-${Date.parse(event.time)}`;
	if (["queued", "turn", "answered"].some((step) => existsSync(join(box, step, name)))) return;
	mkdirSync(join(box, "queued"), { recursive: true });
	const draft = join(box, `.draft-${process.pid}-${name}`);
	writeFileSync(draft, JSON.stringify(message));
	try {
		linkSync(draft, join(box, "queued", name));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
	} finally {
		rmSync(draft, { force: true });
	}
}

// The wake: the state its run ended in (the question, when blocked on the owner), the first lines of its final message (the
// job's own unless `final` stands for it), its project when not the main one, and what the plugins add for it (the procedure
// of its kind), asked with the job-ended data and that final message whole; the question redacted, those lines of the env
// file's values only, so their job ids, ticket folders and hashes stay readable, but for the line that holds the question.
function wake(host: Host, data: unknown, final?: string): string {
	const job = (data ?? {}) as Readonly<Record<string, unknown>>;
	const id = String(job.id);
	const asks = job.state === "blocked" && typeof job.reason === "string" && job.reason.startsWith("user: ") ? redact(job.reason.slice("user: ".length), host.secrets) : undefined;
	const state = `${String(job.state)}${text(job.reason) ? ` (${job.reason})` : ""}`;
	const lines = [asks === undefined ? `Job ${id} ended its run: ${state}.` : `Job ${id} ended its run blocked on the owner; its question, also sent as a notice: ${asks}`];
	const main = host.collect("projects").length > 0 ? host.board.projects()[0]?.name : undefined;
	if (main !== undefined && job.project !== main) lines.push(`Project: ${String(job.project)}.`);
	const message = final ?? host.jobs.result(id);
	const result = redactValues(message, host.secrets).trimEnd().split("\n");
	// Its first line, `Blocked: user <question>`, holds the question: redacted as the question is.
	if (asks !== undefined) result[0] = redact(result[0] ?? "", host.secrets);
	if (result.join("") === "") lines.push("Its final message: none.");
	else {
		const cut = result.length > RESULT_LINES ? ` (the first ${RESULT_LINES} of ${result.length} lines)` : "";
		lines.push(`Its final message${cut}:`, ...result.slice(0, RESULT_LINES));
	}
	for (const line of host.collect("coordinator.wake", job, message)) if (text(line)) lines.push(line);
	return lines.join("\n");
}

// What `coordinator.turn` answers (`arthur eval` asks it): the text the coordinator's agent gets for one event the inbox
// queues, handed over alone while idle; `more` stands for the final message of the job a `job-ended` names, and names the
// plugin that emitted a `coordinator-message`. A message's parts are text only, which no plugin is asked to resolve, so the
// answer acts on nothing.
async function turn(host: Host, name: unknown, data: unknown, more: unknown): Promise<string> {
	if (name === "job-ended") return handOver([{ text: wake(host, data, typeof more === "string" ? more : "") }]);
	if (name === "coordinator-message") {
		const said = ((data ?? {}) as Readonly<Record<string, unknown>>).text;
		if (!text(said)) throw new Error("coordinator.turn: coordinator-message: expected { text }, non-empty text");
		if (!text(more)) throw new Error("coordinator.turn: coordinator-message: expected the plugin that emitted it, as text");
		return handOver([{ plugin: more, text: said }]);
	}
	if (name !== "message-received") throw new Error(`coordinator.turn: expected message-received, coordinator-message or job-ended, got ${describe(name)}`);
	const message = received(data);
	if (typeof message === "string") throw new Error(`coordinator.turn: message-received: ${message}`);
	const part = message.parts.find((each) => each.kind !== "text");
	if (part !== undefined) throw new Error(`coordinator.turn: message-received: text parts only; a ${part.kind} part is resolved by the plugins that claim it`);
	return handOver([{ channel: message.channel, text: await turnText(host, 0, message) }]);
}

// `arthur · <n> <state>, …: <short ids>` for the jobs in a run, by state, empty when none runs; the extension shows it in the
// coordinator's footer.
function footer(host: Host): void {
	const running = new Set(host.jobs.running());
	const jobs = byState(host.jobs.list().filter((job) => running.has(job.id)));
	const counts = [...jobs].map(([state, each]) => `${each.length} ${state || "no state"}`).join(", ");
	const ids = [...jobs.values()].flat().map((job) => job.id.split("-").at(-1));
	const shown = ids.length === 0 ? "" : `arthur · ${counts}: ${ids.join(", ")}`;
	writeFileSync(join(host.folder, "footer.new"), shown);
	renameSync(join(host.folder, "footer.new"), join(host.folder, "footer"));
}

// Each reply or notice the extension wrote, oldest first, emitted and then moved to `outbox/sent/`; while silent is on, a reply
// of a turn holding no owner message is not emitted but moved to `outbox/held/` (silent.ts).
function sweep(host: Host): void {
	const outbox = join(host.folder, "outbox");
	if (!existsSync(outbox)) return;
	for (const name of readdirSync(outbox).filter((each) => each.endsWith(".json")).sort()) {
		const file = JSON.parse(readFileSync(join(outbox, name), "utf8")) as { text: string; answers: (string | number)[]; channels: string[] } | { notice: string };
		const box = "notice" in file || file.channels.length > 0 || !held(host.folder, name) ? "sent" : "held";
		if ("notice" in file) host.events.emit("notice", { text: redact(file.notice, host.secrets) });
		// The event names the event numbers its files hold.
		else if (box === "sent") host.events.emit("coordinator-replied", { text: file.text, answers: file.answers.map((answer) => parseInt(String(answer))), channels: file.channels });
		mkdirSync(join(outbox, box), { recursive: true });
		renameSync(join(outbox, name), join(outbox, box, name));
	}
}
