import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The compaction, the agent's side (spec/roadmap.md, entry 35): an OMP extension that orchestration loads into the coordinator's
// agent for the session plugin (`coordinator.extension`), acting on the folder `ARTHUR_SESSION_FOLDER` names. It takes the
// request `arthur run` writes to `compact.json`, asks the coordinator for its handoff once omp is idle with nothing queued,
// compacts with omp's own compaction once that turn wrote a new handoff, gives the compacted conversation the handoff, and
// writes the outcome's line into the request: docs/session.md.

type Context = { readonly hasUI: boolean; isIdle(): boolean; hasPendingMessages(): boolean; compact(): Promise<void>; setInterval(fn: () => unknown, ms: number): unknown };
type Said = { readonly role?: string; readonly stopReason?: string; readonly errorMessage?: string };
type ExtensionApi = {
	on(event: "session_start" | "agent_start", handler: (event: unknown, ctx: Context) => void): void;
	on(event: "agent_end", handler: (event: { readonly messages?: readonly Said[]; readonly willContinue?: boolean }, ctx: Context) => void): void;
	sendUserMessage(content: string, options: { readonly attribution: "agent" }): void;
};
// A compaction asked for at the slot `slot`, at `asked` (ms), withdrawn once the session has been busy for `waitSeconds`; `pid`
// is the agent that took it, `line` its outcome, which `arthur run` prints.
export type Request = { readonly slot: string; readonly asked: number; readonly waitSeconds: number; readonly pid?: number; readonly line?: string };

const TICK_MS = 500;
// Idle with nothing pending this long is idle with nothing queued: longer than the inbox takes to hand over what it queued
// (1 s without a new message, and its 500 ms tick).
const SETTLE_MS = 2000;
// A request handed over with no turn started while omp idles this long failed, as the inbox counts one.
const QUIET_MS = 30_000;
const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0];

export default function compaction(pi: ExtensionApi): void {
	const folder = process.env.ARTHUR_SESSION_FOLDER ?? "";
	if (folder === "") return;
	const [file, handoff] = [join(folder, "compact.json"), join(folder, "handoff.md")];
	const write = (request: Request) => {
		writeFileSync(`${file}.${process.pid}`, JSON.stringify(request));
		renameSync(`${file}.${process.pid}`, file);
	};
	// The request taken, and where it is: waiting for an idle session; `handoff`, asked for it at `sent` when the handoff's mtime
	// was `before`, `started` once that turn did, `ended` with its last message once it ended; `compacting`.
	let held: Request | undefined;
	let phase: "waiting" | "handoff" | "compacting" = "waiting";
	let [begun, started, idleSince, sent] = [false, false, 0, 0];
	let before: number | undefined;
	let ended: { readonly last?: Said } | undefined;
	const finish = (line: string) => {
		if (held !== undefined) write({ ...held, line });
		held = undefined;
	};

	const tick = async (ctx: Context) => {
		const idle = ctx.isIdle() && !ctx.hasPendingMessages();
		idleSince = idle ? idleSince || Date.now() : 0;
		if (held === undefined) {
			const found = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Request) : undefined;
			// Only one no agent took, while it may still go; an older one is `arthur run`'s to drop, so it never runs late.
			if (found === undefined || found.pid !== undefined || found.line !== undefined || Date.now() - found.asked >= found.waitSeconds * 1000) return;
			held = { ...found, pid: process.pid };
			write(held);
			[phase, started, ended] = ["waiting", false, undefined];
		}
		const settled = idle && Date.now() - idleSince >= SETTLE_MS;
		if (phase === "waiting") {
			const busy = Date.now() - held.asked;
			if (busy >= held.waitSeconds * 1000) return finish(`compact: skipped, session busy for ${Math.floor(busy / 1000)} s`);
			if (!settled) return;
			[phase, before, sent] = ["handoff", statSync(handoff, { throwIfNoEntry: false })?.mtimeMs, Date.now()];
			try {
				pi.sendUserMessage(`[Arthur] Your conversation is compacted after this turn. First write your handoff to ${handoff}, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when you asked it. The compacted conversation starts by reading it. ${ARTHUR}`, { attribution: "agent" });
			} catch (error) {
				finish(`compact: skipped, handoff not written: the request did not reach the agent: ${reason(error)}`);
			}
			return;
		}
		if (phase !== "handoff" || !idle) return;
		if (!started) {
			if (Date.now() - sent >= QUIET_MS) finish(`compact: skipped, handoff not written: no turn started within ${QUIET_MS / 1000} s`);
			return;
		}
		// The turn ended; one that said it goes on and started none counts once omp has settled.
		if (ended === undefined && !settled) return;
		const now = statSync(handoff, { throwIfNoEntry: false })?.mtimeMs;
		if (now === undefined || now === before) {
			const error = ended?.last?.errorMessage;
			return finish(`compact: skipped, handoff not written: no new handoff when the coordinator's turn ended${error ? ` (${error})` : ""}`);
		}
		phase = "compacting";
		try {
			await ctx.compact();
		} catch (error) {
			return finish(`compact: failed: ${reason(error)}`);
		}
		const text = readFileSync(handoff, "utf8").trim();
		if (text === "") return finish("compact: done; the handoff is empty, so nothing is read back");
		try {
			pi.sendUserMessage(`[Arthur] Your conversation was just compacted. Before that you wrote this handoff (${handoff}); go on from it:\n\n${text}\n\n${ARTHUR}`, { attribution: "agent" });
		} catch (error) {
			return finish(`compact: done; the handoff was not read back: ${reason(error)}`);
		}
		finish("compact: done; the compacted conversation starts by reading the handoff");
	};

	pi.on("session_start", (_event, ctx) => {
		// Only in the coordinator's own session, one with a UI, and once per process.
		if (!ctx.hasUI || begun) return;
		begun = true;
		ctx.setInterval(() => tick(ctx), TICK_MS);
	});
	pi.on("agent_start", (_event, ctx) => {
		if (ctx.hasUI && phase === "handoff") started = true;
	});
	pi.on("agent_end", (event, ctx) => {
		if (ctx.hasUI && phase === "handoff" && started && event.willContinue !== true) ended = { last: event.messages?.at(-1) };
	});
}
