import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe } from "@arthur/core";
import type { Host, OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { alive, put, REQUEST, type Request, readRequest } from "./request.ts";
import { restarts } from "./restart.ts";
import { registerRestart } from "./restart-command.ts";
import { noteLoaded, registerGuard } from "./restart-guard.ts";
import { noteService, SERVICE, serviceRequirements } from "./service.ts";
import { DEFAULTS, table, time } from "./session-options.ts";
import { type Session, sessionList } from "./sessions.ts";
import { startNotice, turnFailures } from "./start-notice.ts";

// The session plugin (spec/roadmap.md, entries 35 to 38, and 88 for each session: the coordinator's and each project agent's,
// sessions.ts): a conversation compacted at each `compactAt`, or once a turn ends with it at `compactAtPercent` of its context
// window (`compactOn`), one session at a time, new at `freshAt` once no job and no merge runs (of its project, for a project
// agent), restarted on `/restart`, each after a handoff its agent writes and the next conversation reads first. `arthur run`
// asks for each in the session's `request.json` and acts on its outcome (restart.ts for restarts); the handoff extension, which
// orchestration loads into each session's agent, does the agent's part; the restart guard (restart-guard.ts) holds spawns once
// a commit changed the code `arthur run` loaded; at each start each session's model is probed and its start notice sent, the
// coordinator's opening with the lines `arthur doctor` found missing, and a turn that fails before any text is told
// (start-notice.ts); the user service and linger as its `arthur doctor` requirements, and whether this `arthur run` is the
// service's (service.ts): docs/session.md.

export type SessionOptions = {
	readonly enabled?: boolean;
	readonly compactAt?: readonly string[];
	readonly compactOn?: "schedule" | "context" | "both";
	readonly compactAtPercent?: number;
	readonly compactWaitSeconds?: number;
	readonly freshAt?: string;
	readonly freshRetryMinutes?: number;
	readonly freshUntil?: string;
	readonly restartGuard?: boolean;
	readonly probeLlm?: boolean;
};

const EXTENSIONS = ["handoff-extension.ts", "turn-extension.ts"].map((file) => fileURLToPath(new URL(file, import.meta.url)));
// The share of its context window the conversation used at its last turn's end, as the turn extension leaves it.
const CONTEXT_USE = "context-use";

// `tickMs`: how often the plugin and the coordinator's handoff extension look, 500 ms; shorter in a test only.
export function session(options: SessionOptions = {}, tickMs = 500): Plugin {
	let host: Host | undefined;
	let sessions: readonly Session[] = [];
	let timer: NodeJS.Timeout | undefined;
	let stopProbe: (() => void) | undefined;
	// The missing lines of `arthur doctor` this start sends, from the core's `doctor` event before any plugin's start.
	let missing: readonly string[] = [];
	return {
		name: "session",
		module: import.meta.url,
		options,
		requires: ["orchestration"],
		check: checkOptions,
		doctor: serviceRequirements,
		setup(given) {
			host = given;
			sessions = sessionList(given);
			// Each session's agent its own folder, so no project agent writes the coordinator's handoff, request or reports.
			for (const file of EXTENSIONS)
				given.provide("coordinator.extension", (asked?: { readonly session?: unknown }) => {
					const found = sessions.find((each) => each.name === asked?.session);
					return found === undefined ? undefined : { file, env: { ARTHUR_SESSION_FOLDER: found.folder, ARTHUR_SESSION_TICK_MS: String(tickMs) } };
				});
			given.events.on("doctor", ({ data }) => {
				const lines = typeof data === "object" && data !== null && "lines" in data ? data.lines : undefined;
				missing = Array.isArray(lines) ? lines.filter((line) => typeof line === "string") : [];
			});
			registerRestart(given, sessions);
			if (options.restartGuard ?? DEFAULTS.restartGuard) registerGuard(given);
		},
		async start() {
			if (host === undefined) return;
			// One left by an `arthur run` before this one is not done late, nor a report it did not read.
			for (const { folder } of sessions) for (const file of [REQUEST, CONTEXT_USE]) rmSync(join(folder, file), { force: true });
			if (options.restartGuard ?? DEFAULTS.restartGuard) noteLoaded(host);
			await noteService(host.folder);
			stopProbe = startNotice(host, sessions, options.probeLlm ?? DEFAULTS.probeLlm, missing);
			const at = host;
			const ticks = sessions.flatMap((one) => [["compaction", compactions(at, one, sessions)], ["restart", restarts(at, one)], ["turn notice", turnFailures(at, one)]] as const);
			// A tick that throws (a folder made read-only, a disk full) is told once per distinct error and runs again at the next.
			const told = new Set<string>();
			timer = setInterval(() => {
				for (const [what, tick] of ticks)
					try {
						tick();
					} catch (error) {
						const line = `session: ${what} failed: ${String((error as Error)?.message ?? error).split("\n")[0]}`;
						if (!told.has(line)) console.error(line);
						told.add(line);
					}
			}, tickMs);
		},
		stop() {
			clearInterval(timer);
			stopProbe?.();
			if (host !== undefined) rmSync(join(host.folder, SERVICE), { force: true });
		},
	};
}

// Every 500 ms, for one session: the outcome of a compaction, printed once its agent wrote it; one no agent took within its
// wait, or whose agent is gone, dropped without a word (no session ran); and a request, unless one is still there: at a slot,
// and at a turn's report of `compactAtPercent` or more, read once, which then asks again only after a compaction done or a
// report below it. One session compacts at a time (roadmap 88): a request while another session's compaction is asked for
// waits, and is made once none is.
function compactions(host: Host, session: Session, sessions: readonly Session[]): () => void {
	const { compactOn = DEFAULTS.compactOn, compactAtPercent = DEFAULTS.compactAtPercent, compactWaitSeconds = DEFAULTS.compactWaitSeconds } = host.options as SessionOptions;
	const compactAt = compactOn === "context" ? [] : ((host.options as SessionOptions).compactAt ?? DEFAULTS.compactAt);
	const [file, use, tag] = [join(session.folder, REQUEST), join(session.folder, CONTEXT_USE), session.project === undefined ? "session" : `session: ${session.name}`];
	const upcoming = () => compactAt.map((time) => ({ time, at: host.clock.next(time) })).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
	let next = upcoming();
	let armed = true;
	// The slot of a request waiting for another session's compaction to end.
	let waiting: string | undefined;
	// Slots passed together, or a trigger while a compaction or a restart is still asked for, ask for one, never queue a second.
	const ask = (slot: string) => {
		if (existsSync(file)) {
			waiting = undefined;
			return false;
		}
		if (sessions.some((other) => other !== session && readRequest(other.folder)?.then === "compact")) {
			waiting ??= slot;
			return true;
		}
		const asked: Request = { then: "compact", slot: waiting ?? slot, asked: Date.now(), waitSeconds: compactWaitSeconds };
		put(file, JSON.stringify(asked));
		waiting = undefined;
		return true;
	};
	return () => {
		const request = readRequest(session.folder);
		if (request?.then === "compact" && (request.line !== undefined || (request.pid === undefined ? Date.now() - request.asked >= request.waitSeconds * 1000 : !alive(request.pid)))) {
			rmSync(file, { force: true });
			if (request.line !== undefined) console.log(`${tag}: ${request.line}`);
			if (request.line?.startsWith("compact: done")) armed = true;
		}
		if (waiting !== undefined) ask(waiting);
		const percent = existsSync(use) ? Number(readFileSync(use, "utf8")) : Number.NaN;
		rmSync(use, { force: true });
		if (compactOn !== "schedule" && Number.isFinite(percent)) {
			if (percent < compactAtPercent) armed = true;
			else if (armed && ask(`context ${percent}%`)) armed = false;
		}
		if (next === undefined || host.clock.now() < next.at) return;
		const slot = next.time;
		next = upcoming();
		ask(slot);
	};
}

// Each unknown option, then each one given, in the order given, by `table` (session-options.ts); each item of `compactAt` at
// its own path.
export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const wrong = (path: string, expected: string | undefined, value: unknown) => {
		if (expected !== undefined) problems.push({ path, problem: `expected ${expected}, got ${describe(value)}` });
	};
	for (const [key, value] of Object.entries(options)) {
		const entry = Object.hasOwn(table, key) ? table[key] : undefined;
		if (entry === undefined || "fields" in entry || value === undefined) continue;
		if (key === "compactAt" && Array.isArray(value)) value.forEach((each, index) => wrong(`compactAt[${index}]`, time(each), each));
		else wrong(key, entry.check(value), value);
	}
	return problems;
}
