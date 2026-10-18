import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Message } from "./inbox.ts";

// The coordinator's inbox, the agent's side (spec/roadmap.md, entry 24): an OMP extension the coordinator's `omp` loads with
// `-e`, acting on the folder `ARTHUR_ORCHESTRATION_FOLDER` names. It moves each message from `inbox/queued/` to `inbox/turn/` as
// it hands it to the agent, writes the reply that ends the turn to `outbox/`, and only then moves the turn's messages to
// `inbox/answered/`: docs/commands/coordinator.md, "The coordinator's inbox".

type Context = {
	readonly hasUI: boolean;
	isIdle(): boolean;
	readonly ui: { setStatus(key: string, text: string | undefined): void };
	setInterval(fn: () => void, ms: number): unknown;
};
type Said = { readonly role?: string; readonly stopReason?: string; readonly errorMessage?: string; readonly content?: readonly { readonly type?: string; readonly text?: string }[] };
type Continuation = { continue: true; additionalContext: string } | undefined;
type ExtensionApi = {
	on(event: "session_start" | "agent_start" | "tool_result", handler: (event: unknown, ctx: Context) => void): void;
	on(event: "session_stop", handler: (event: unknown, ctx: Context) => Continuation): void;
	on(event: "agent_end", handler: (event: { readonly messages?: readonly Said[]; readonly willContinue?: boolean }, ctx: Context) => void): void;
	sendUserMessage(content: string, options?: { readonly deliverAs?: "aside"; readonly attribution?: "agent" }): void;
};

const [QUEUED, TURN, ANSWERED, OUTBOX, SENT] = ["inbox/queued", "inbox/turn", "inbox/answered", "outbox", "outbox/sent"];
const TICK_MS = 500;
// While idle, a turn starts once the queue has not grown for this long, so a burst of messages is one turn.
const SETTLE_MS = 1000;
const KEEP_MS = 7 * 24 * 3_600_000;
const RESTART = "sent before a restart; no reply to it was sent";
const UNANSWERED = "sent before; its turn ended without a reply";
const AGAIN = "Your reply above has not been sent; write one reply that answers this together with everything your reply above answered.";
const ARTHUR = "The lines marked [Arthur] come from Arthur (a job's end, a schedule), not from the owner.";

// The wait before the messages of the `failed`th turn in a row without a reply go again: none, then 5 s doubling to 5 min; a new owner message ends it.
export const pause = (failed: number) => (failed < 2 ? 0 : Math.min(5000 * 2 ** (failed - 2), 300_000));

export default function inbox(pi: ExtensionApi): void {
	const folder = process.env.ARTHUR_ORCHESTRATION_FOLDER ?? "";
	if (folder === "") return;
	const path = (...names: string[]) => join(folder, ...names);
	const numbers = (box: string) => (existsSync(path(box)) ? readdirSync(path(box)).filter((name) => /^\d+$/.test(name)).sort((a, b) => Number(a) - Number(b)) : []);
	const read = (box: string, name: string) => JSON.parse(readFileSync(path(box, name), "utf8")) as Message;
	const move = (name: string, from: string, to: string) => {
		mkdirSync(path(to), { recursive: true });
		renameSync(path(from, name), path(to, name));
	};
	// Handed to the agent in the running turn; those of them given to the last `session_stop`, taken only if the turn goes on.
	let handed: string[] = [];
	let resumed: string[] = [];
	// In `turn/` but not handed (a failed hand-over, a restart, a turn that ended without a reply), each with its mark.
	const waiting = new Map<string, string>();
	// A turn runs: from a hand-over or `agent_start` to the `agent_end` that does not continue.
	let [live, started] = [false, false];
	let [failures, written, since, unanswered, resume] = [0, 0, 0, 0, 0];
	let [queued, shown] = ["", ""];

	const write = (entry: object) => {
		const name = `${Date.now()}-${String(++written).padStart(6, "0")}`;
		mkdirSync(path(OUTBOX), { recursive: true });
		writeFileSync(path(OUTBOX, `.${name}`), JSON.stringify(entry));
		renameSync(path(OUTBOX, `.${name}`), path(OUTBOX, `${name}.json`));
	};
	// The queued messages a turn takes, oldest first, moved to `turn/`; mid-turn only a human's.
	const claim = (humans: boolean) =>
		numbers(QUEUED).filter((name) => {
			if (humans && read(QUEUED, name).channel === undefined) return false;
			move(name, QUEUED, TURN);
			return true;
		});
	// One paragraph per message, marked with where it came from and, unless it came while idle, when.
	const compose = (names: readonly string[], mark: string) => {
		const messages = names.map((name) => read(TURN, name));
		const lines = messages.map(({ channel, text }, index) => {
			const when = waiting.get(names[index] ?? "") || mark;
			return `[${channel === undefined ? "Arthur" : `via ${channel}`}${when === "" ? "" : `, ${when}`}] ${text}`;
		});
		const human = messages.some((message) => message.channel !== undefined);
		return { content: [...lines, ...(messages.every((message) => message.channel !== undefined) ? [] : [ARTHUR])].join("\n\n"), human };
	};
	// Hands `names`, in `turn/`, to the agent; a throw keeps them waiting for the next tick, and the third in a row is told once.
	const hand = (names: readonly string[], mark: string, aside: boolean): boolean => {
		if (names.length === 0) return false;
		const { content, human } = compose(names, mark);
		try {
			pi.sendUserMessage(content, aside ? { deliverAs: "aside" } : human ? undefined : { attribution: "agent" });
		} catch (error) {
			for (const name of names) waiting.set(name, waiting.get(name) ?? "");
			const why = error instanceof Error ? error.message : String(error);
			if (++failures === 3) write({ notice: `the coordinator's inbox could not hand ${names.length} message(s) to the agent 3 times in a row (${why}); it keeps trying every ${TICK_MS / 1000} s` });
			return false;
		}
		failures = 0;
		for (const name of names) waiting.delete(name);
		handed.push(...names);
		return true;
	};
	const tick = (ctx: Context) => {
		const footer = existsSync(path("footer")) ? readFileSync(path("footer"), "utf8") : "";
		if (footer !== shown) ctx.ui.setStatus("arthur", footer === "" ? undefined : footer);
		shown = footer;
		if (live || !ctx.isIdle()) return;
		const names = numbers(QUEUED);
		if (names.join() !== queued) [queued, since] = [names.join(), Date.now()];
		if (Date.now() < resume && names.some((name) => read(QUEUED, name).channel !== undefined)) resume = 0;
		if (Date.now() < resume || (waiting.size === 0 && (names.length === 0 || Date.now() - since < SETTLE_MS))) return;
		live = hand([...waiting.keys(), ...claim(false)].sort((a, b) => Number(a) - Number(b)), "", false);
	};
	// The numbers a reply in `box` answers; a reply moved on meanwhile is read in the next box.
	const replied = (box: string) =>
		(existsSync(path(box)) ? readdirSync(path(box)) : []).filter((name) => name.endsWith(".json")).flatMap((name) => {
			try {
				return (JSON.parse(readFileSync(path(box, name), "utf8")) as { answers?: number[] }).answers ?? [];
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
				throw error;
			}
		});

	pi.on("session_start", (_event, ctx) => {
		// Not in a session without a UI (a `task` subagent), and once per process.
		if (!ctx.hasUI || started) return;
		started = true;
		// A turn a restart cut: its messages a written reply answers are answered; the others go again, marked.
		const answered = new Set([...replied(OUTBOX), ...replied(SENT)]);
		for (const name of numbers(TURN)) {
			if (answered.has(Number(name))) move(name, TURN, ANSWERED);
			else waiting.set(name, RESTART);
		}
		for (const box of [ANSWERED, SENT])
			for (const name of existsSync(path(box)) ? readdirSync(path(box)) : [])
				if (Date.now() - statSync(path(box, name)).mtimeMs > KEEP_MS) rmSync(path(box, name), { force: true });
		ctx.setInterval(() => tick(ctx), TICK_MS);
	});
	pi.on("agent_start", (_event, ctx) => {
		if (ctx.hasUI) live = true;
	});
	// After a tool call: a human's messages join the running turn without cutting its tool batch.
	pi.on("tool_result", (_event, ctx) => {
		if (ctx.hasUI) hand(claim(true), "sent during this turn", true);
	});
	// At the turn's end: a human's messages that came after its last tool call resume it.
	pi.on("session_stop", (_event, ctx) => {
		if (!ctx.hasUI) return undefined;
		const names = claim(true);
		if (names.length === 0) return undefined;
		const { content } = compose(names, "sent during this turn, after your last tool call");
		resumed = names;
		handed.push(...names);
		return { continue: true, additionalContext: `${content}\n\n${AGAIN}` };
	});
	pi.on("agent_end", (event, ctx) => {
		if (!ctx.hasUI) return;
		if (event.willContinue === true) {
			resumed = [];
			return;
		}
		// A continuation omp did not take (past its cap of 8 in a turn, or the turn aborted): its messages are the next turn.
		for (const name of resumed) waiting.set(name, "");
		const turn = handed.filter((name) => !resumed.includes(name));
		[live, handed, resumed] = [false, [], []];
		if (turn.length === 0) return;
		const last = event.messages?.at(-1);
		if (last?.role !== "assistant" || ["error", "aborted", "toolUse"].includes(last.stopReason ?? "")) {
			for (const name of turn) waiting.set(name, UNANSWERED);
			resume = Date.now() + pause(++unanswered);
			if (unanswered === 3) write({ notice: `the coordinator's last 3 turns ended without a reply (${[last?.stopReason, last?.errorMessage].filter(Boolean).join(": ") || "no reply"}); their messages go again in 10 s, then after twice as long each time, at most 5 min` });
			return;
		}
		[unanswered, resume] = [0, 0];
		const text = (last.content ?? []).flatMap((block) => (block.type === "text" ? [block.text ?? ""] : [])).join("\n");
		const channels = [...new Set(turn.flatMap((name) => read(TURN, name).channel ?? []))];
		write({ text, answers: turn.map(Number), channels });
		for (const name of turn) move(name, TURN, ANSWERED);
	});
}
