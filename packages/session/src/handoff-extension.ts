import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Request } from "./request.ts";

// The handoff, the agent's side (spec/roadmap.md, entries 35 and 36): an OMP extension that orchestration loads into the
// coordinator's agent for the session plugin (`coordinator.extension`), acting on the folder `ARTHUR_SESSION_FOLDER` names. It
// takes the request `arthur run` writes to `request.json`, asks the coordinator for its handoff once omp is idle with nothing
// queued, and once that turn wrote a new handoff either compacts with omp's own compaction and gives the compacted conversation
// the handoff, or, for a restart, says so; it writes the outcome's line into the request. At its start it notes its pid in
// `agent` and gives the new conversation a handoff newer than the last one read: docs/session.md.

type Context = { readonly hasUI: boolean; isIdle(): boolean; hasPendingMessages(): boolean; compact(): Promise<void>; setInterval(fn: () => unknown, ms: number): unknown };
type Said = { readonly role?: string; readonly stopReason?: string; readonly errorMessage?: string };
type ExtensionApi = {
	on(event: "session_start" | "agent_start", handler: (event: unknown, ctx: Context) => void): void;
	on(event: "agent_end", handler: (event: { readonly messages?: readonly Said[]; readonly willContinue?: boolean }, ctx: Context) => void): void;
	sendUserMessage(content: string, options: { readonly attribution: "agent" }): void;
};

const TICK_MS = 500;
// Idle with nothing pending this long is idle with nothing queued: longer than the inbox takes to hand over what it queued
// (1 s without a new message, and its 500 ms tick).
const SETTLE_MS = 2000;
// A request handed over with no turn started while omp idles this long failed, as the inbox counts one.
const QUIET_MS = 30_000;
const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0];

export default function handoffs(pi: ExtensionApi): void {
	const folder = process.env.ARTHUR_SESSION_FOLDER ?? "";
	if (folder === "") return;
	const [file, handoff, read] = [join(folder, "request.json"), join(folder, "handoff.md"), join(folder, "handoff-read")];
	const put = (path: string, text: string) => {
		writeFileSync(`${path}.${process.pid}`, text);
		renameSync(`${path}.${process.pid}`, path);
	};
	const found = (): Request | undefined => {
		try {
			return JSON.parse(readFileSync(file, "utf8")) as Request;
		} catch {
			return undefined;
		}
	};
	const same = (a: Request | undefined, b: Request) => a !== undefined && a.then === b.then && a.asked === b.asked;
	const changed = () => statSync(handoff, { throwIfNoEntry: false })?.mtimeMs;
	// The request taken, and where it is: waiting for an idle session; `handoff`, asked for it at `sent` when the handoff's mtime
	// was `before`, `started` once that turn did, `ended` with its last message once it ended; `compacting` while omp compacts.
	let held: Request | undefined;
	let phase: "waiting" | "handoff" = "waiting";
	let [begun, started, compacting, idleSince, sent] = [false, false, false, 0, 0];
	let before: number | undefined;
	let ended: { readonly last?: Said } | undefined;
	// Written only while the file still holds that request: `arthur run` may have dropped or replaced it meanwhile.
	const finish = (request: Request, line: string) => {
		if (same(found(), request)) put(file, JSON.stringify({ ...request, line }));
		if (held !== undefined && same(held, request)) held = undefined;
	};
	// The handoff given to the conversation with `intro`, and its mtime noted as read; false when it holds only blanks.
	const readBack = (intro: string): boolean => {
		const [mtime, text] = [changed(), existsSync(handoff) ? readFileSync(handoff, "utf8").trim() : ""];
		if (text === "") return false;
		pi.sendUserMessage(`[Arthur] ${intro} (${handoff}); go on from it:\n\n${text}\n\n${ARTHUR}`, { attribution: "agent" });
		put(read, String(mtime));
		return true;
	};

	const tick = async (ctx: Context) => {
		if (compacting) return;
		const idle = ctx.isIdle() && !ctx.hasPendingMessages();
		idleSince = idle ? idleSince || Date.now() : 0;
		const now = found();
		if (held !== undefined && !same(now, held)) held = undefined;
		if (held === undefined) {
			// Only one no agent took, while it may still go; an older one is `arthur run`'s to drop, so it never runs late.
			if (now === undefined || now.pid !== undefined || now.line !== undefined || Date.now() - now.asked >= now.waitSeconds * 1000) return;
			held = { ...now, pid: process.pid };
			put(file, JSON.stringify(held));
			[phase, started, ended] = ["waiting", false, undefined];
		}
		const request = held;
		const compact = request.then === "compact";
		const failed = (why: string) => finish(request, `${compact ? "compact: skipped, " : ""}handoff not written: ${why}`);
		const settled = idle && Date.now() - idleSince >= SETTLE_MS;
		if (phase === "waiting") {
			const busy = Date.now() - request.asked;
			if (busy >= request.waitSeconds * 1000) return finish(request, `${compact ? "compact: skipped, " : "handoff not written: "}session busy for ${Math.floor(busy / 1000)} s`);
			if (!settled) return;
			[phase, before, sent] = ["handoff", changed(), Date.now()];
			const next = compact
				? "Your conversation is compacted after this turn"
				: `This conversation ends after this turn: the coordinator restarts${request.then === "fresh" ? " in a fresh conversation" : " and goes on with this one"}`;
			try {
				pi.sendUserMessage(`[Arthur] ${next}. First write your handoff to ${handoff}, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when you asked it. The ${compact ? "compacted" : "next"} conversation starts by reading it. ${ARTHUR}`, { attribution: "agent" });
			} catch (error) {
				failed(`the request did not reach the agent: ${reason(error)}`);
			}
			return;
		}
		if (!idle) return;
		if (!started) {
			if (Date.now() - sent >= QUIET_MS) failed(`no turn started within ${QUIET_MS / 1000} s`);
			return;
		}
		// The turn ended; one that said it goes on and started none counts once omp has settled.
		if (ended === undefined && !settled) return;
		const mtime = changed();
		if (mtime === undefined || mtime === before) {
			const error = ended?.last?.errorMessage;
			return failed(`no new handoff when the coordinator's turn ended${error ? ` (${error})` : ""}`);
		}
		if (!compact) return finish(request, "handoff written");
		compacting = true;
		try {
			await ctx.compact();
		} catch (error) {
			return finish(request, `compact: failed: ${reason(error)}`);
		} finally {
			compacting = false;
		}
		try {
			if (!readBack("Your conversation was just compacted. Before that you wrote this handoff")) return finish(request, "compact: done; the handoff is empty, so nothing is read back");
		} catch (error) {
			return finish(request, `compact: done; the handoff was not read back: ${reason(error)}`);
		}
		finish(request, "compact: done; the compacted conversation starts by reading the handoff");
	};

	pi.on("session_start", (_event, ctx) => {
		// Only in the coordinator's own session, one with a UI, and once per process.
		if (!ctx.hasUI || begun) return;
		begun = true;
		put(join(folder, "agent"), String(process.pid));
		// A handoff no conversation has read yet, the one a restart asked for: the first turn reads it. One that fails to reach
		// the agent stays unread, for the next start.
		const last = Number(existsSync(read) ? readFileSync(read, "utf8") : "") || Number.NEGATIVE_INFINITY;
		try {
			if ((changed() ?? Number.NEGATIVE_INFINITY) > last) readBack("The coordinator just started again. Before that you wrote this handoff");
		} catch {}
		ctx.setInterval(() => tick(ctx), TICK_MS);
	});
	pi.on("agent_start", (_event, ctx) => {
		if (ctx.hasUI && held !== undefined && phase === "handoff") started = true;
	});
	pi.on("agent_end", (event, ctx) => {
		if (ctx.hasUI && held !== undefined && phase === "handoff" && started && event.willContinue !== true) ended = { last: event.messages?.at(-1) };
	});
}
