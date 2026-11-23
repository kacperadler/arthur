import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Received, received, turnText } from "@arthur/core/parts";
import type { Event, Host } from "@arthur/core/plugin";
import { byState } from "./context.ts";
import { redact } from "./credential.ts";
import { type Box, noticeAt, sessionFor } from "./sessions.ts";
import { ASK, held } from "./silent.ts";
import { voiceReplies } from "./voice-reply.ts";
import { turn, wake } from "./wake.ts";

// Each session's inbox, the plugin's side (spec/roadmap.md, entries 24, 49 and 86): every message for a session becomes one
// file `<its folder>/inbox/queued/<event's number>-<its time in ms>`, which the inbox extension (inbox-extension.ts) hands to
// its agent; the coordinator's, unless it came from a project agent's chat, names that agent's project, or is told to it
// (`agent-told`, agent-command.ts). An owner's message waits in the coordinator's `inbox/received/` until its parts are
// resolved (`turnText`), one message at a time in the order of their numbers, so none overtakes one before it and a restart
// resolves what it cut. The replies the extension writes to `<folder>/outbox/` are emitted here: docs/commands/coordinator.md,
// "The coordinator's inbox".

// A queued message: a human's from a channel, another session's (`from`), or Arthur's own: a job's end, or a plugin's, which names it.
export type Message = { readonly channel?: string; readonly plugin?: string; readonly from?: string; readonly text: string };

const SWEEP_MS = 500;

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);
// Every session's folder: the coordinator's, then each agent's under `agents/`, a removed agent's too.
const folders = (home: string) => [home, ...list(join(home, "agents")).map((name) => join(home, "agents", name))];
// Whether event file `name` is in one of `boxes` of any session's inbox, so a replayed event is never queued twice.
const seen = (home: string, name: string, boxes: readonly string[]) => folders(home).some((each) => boxes.some((box) => existsSync(join(each, "inbox", box, name))));

export function inbox(host: Host, sessions: readonly Box[]): { start(): void; stop(): void } {
	const { folder } = host;
	const to = (data: Readonly<Record<string, unknown>>, main?: Readonly<Record<string, unknown>>) => sessionFor(sessions, data, main).folder;
	// Each channel's main bot by its name (`channel.main`), asked as a message is routed: a channel may set up after this plugin.
	const main = () => Object.fromEntries(host.collectEach("channel.main").flatMap((each) => ("error" in each ? [] : [[each.plugin, each.value]])));
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
					queue(folder, to(message, main()), { seq, time: new Date(ms).toISOString() }, { channel: message.channel, text: said });
					rmSync(file);
				}
			})
			.catch((error: Error) => console.error(`orchestration: resolving the messages in ${waiting}: ${error.message}`));
	};
	host.events.on("message-received", (event) => {
		const message = received(event.data);
		if (typeof message === "string") return console.error(`orchestration: message-received (event ${event.seq}) ignored: ${message}`);
		const name = `${event.seq}-${Date.parse(event.time)}`;
		if (seen(folder, name, ["received", "queued", "turn", "answered"])) return;
		mkdirSync(waiting, { recursive: true });
		writeFileSync(join(waiting, `.${name}`), JSON.stringify(message));
		renameSync(join(waiting, `.${name}`), join(waiting, name));
		resolve();
	});
	host.events.on("coordinator-message", (event) => {
		const data = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		if (text(data.text)) queue(folder, to({ project: data.project }), event, { plugin: event.plugin, text: data.text });
		else console.error(`orchestration: coordinator-message (event ${event.seq}) ignored: expected { text }, non-empty text`);
	});
	host.events.on("job-ended", (event) => queue(folder, to({ project: (event.data as { project?: unknown } | null)?.project }), event, { text: wake(host, event.data) }));
	// `arthur agent tell`'s message, to the session it names; one removed since goes to the coordinator.
	host.events.on("agent-told", (event) => {
		const { to: name, from, text: said } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		const target = sessions.find((each) => each.name === name) ?? sessions[0];
		if (target !== undefined && text(from) && text(said)) queue(folder, target.folder, event, { from, text: said });
		else console.error(`orchestration: agent-told (event ${event.seq}) ignored: expected { to, from, text }, non-empty text`);
	});
	host.provide("coordinator.turn", (name: unknown, data: unknown, more: unknown) => turn(host, name, data, more));
	for (const name of ["job-started", "job-state", "job-ended"]) host.events.on(name, () => footer(host, sessions));
	let timer: NodeJS.Timeout | undefined;
	const voice = voiceReplies(host);
	return {
		start() {
			// A removed agent's messages not yet answered go to the coordinator's queue, and its replies and notices not yet sent
			// (`.json` files, not its drafts nor `sent/` and `held/`) to the coordinator's outbox, its ask with them, so none is lost.
			// A message of its turn that a reply it wrote answers stays, as its own restart would take it as answered (inbox-extension.ts).
			for (const each of folders(folder).slice(1).filter((one) => !sessions.some((session) => session.folder === one))) {
				const replies = ["outbox", "outbox/sent", "outbox/held"].flatMap((box) => list(join(each, box)).filter((one) => one.endsWith(".json")).map((one) => join(each, box, one)));
				const answered = new Set(replies.flatMap((file) => ((JSON.parse(readFileSync(file, "utf8")) as { answers?: unknown[] }).answers ?? []).map(String)));
				for (const [from, into] of [["inbox/queued", "inbox/queued"], ["inbox/turn", "inbox/queued"], ["outbox", "outbox"]] as const)
					for (const name of list(join(each, from)).filter((one) => (from !== "outbox" || one.endsWith(".json")) && !(from === "inbox/turn" && answered.has(one)))) {
						mkdirSync(join(folder, into), { recursive: true });
						renameSync(join(each, from, name), join(folder, into, name));
					}
				if (existsSync(join(each, ASK)) && !existsSync(join(folder, ASK))) renameSync(join(each, ASK), join(folder, ASK));
			}
			footer(host, sessions);
			timer = setInterval(() => sweep(host, sessions, voice), SWEEP_MS);
			started = true;
			resolve();
		},
		stop() {
			started = false;
			clearInterval(timer);
			sweep(host, sessions, voice);
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

// One file per event in the inbox of the session folder `to`, written whole and linked in; skipped when that event is queued,
// handed over or answered already in any session under `home`, looked for in the order the extension moves files, so a file
// moving meanwhile is still found. Its name holds the event's time too, so a log cut by hand, whose numbers start again, never
// matches an old event's file.
export function queue(home: string, to: string, event: { readonly seq: number; readonly time: string }, message: Message): void {
	const box = join(to, "inbox");
	const name = `${event.seq}-${Date.parse(event.time)}`;
	if (seen(home, name, ["queued", "turn", "answered"])) return;
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

// `arthur · <n> <state>, …: <short ids>` for the jobs in a run, by state, empty when none runs; the extension shows it in each
// session's footer, an agent's of its project's jobs only.
function footer(host: Host, sessions: readonly Box[]): void {
	const running = new Set(host.jobs.running());
	const all = host.jobs.list().filter((job) => running.has(job.id));
	for (const { project, folder } of sessions) {
		const jobs = byState(all.filter((job) => project === undefined || job.project === project));
		const counts = [...jobs].map(([state, each]) => `${each.length} ${state || "no state"}`).join(", ");
		const ids = [...jobs.values()].flat().map((job) => job.id.split("-").at(-1));
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, "footer.new"), ids.length === 0 ? "" : `arthur · ${counts}: ${ids.join(", ")}`);
		renameSync(join(folder, "footer.new"), join(folder, "footer"));
	}
}

// Each reply or notice the extensions wrote, oldest first per session, emitted and then moved to `outbox/sent/`, a sent reply
// then to `voice` (voice-reply.ts); while silent is on, a reply of a turn holding no owner message is not emitted but moved to
// `outbox/held/`, unless its own session ran `arthur silent ask` (silent.ts). An agent's reply and notice go to its chat alone.
function sweep(host: Host, sessions: readonly Box[], voice: (reply: Event) => void): void {
	for (const { folder, chat } of sessions) {
		const outbox = join(folder, "outbox");
		const { channel, ...spot } = noticeAt(chat);
		for (const name of list(outbox).filter((each) => each.endsWith(".json")).sort()) {
			const file = JSON.parse(readFileSync(join(outbox, name), "utf8")) as { text: string; answers: (string | number)[]; channels: string[] } | { notice: string };
			const box = "notice" in file || file.channels.length > 0 || !held(host.folder, folder, name) ? "sent" : "held";
			if ("notice" in file) host.events.emit("notice", { text: redact(file.notice, host.secrets), ...noticeAt(chat) });
			// The event names the event numbers its files hold.
			else if (box === "sent") voice(host.events.emit("coordinator-replied", { text: file.text, answers: file.answers.map((answer) => parseInt(String(answer))), channels: channel === undefined ? file.channels : [channel], ...spot }));
			mkdirSync(join(outbox, box), { recursive: true });
			renameSync(join(outbox, name), join(outbox, box, name));
		}
	}
}
