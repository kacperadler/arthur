import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe } from "@arthur/core";
import type { Host, OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { alive, put, REQUEST, type Request, readRequest } from "./request.ts";
import { registerRestart, restarts } from "./restart.ts";
import { noteLoaded, registerGuard } from "./restart-guard.ts";
import { noteService, SERVICE, serviceRequirements } from "./service.ts";
import { DEFAULTS, table, time } from "./session-options.ts";
import { startNotice, turnFailures } from "./start-notice.ts";

// The session plugin (spec/roadmap.md, entries 35 to 38): the coordinator's conversation compacted at each `compactAt`, or once
// a turn ends with it at `compactAtPercent` of its context window (`compactOn`), new at
// `freshAt` once no job and no merge runs, restarted on `/restart`, each after a handoff the coordinator writes and the next conversation
// reads first. `arthur run` asks for each in `<home>/session/request.json` and acts on its outcome (restart.ts for restarts);
// the handoff extension, which orchestration loads into the coordinator's agent, does the agent's part; the restart guard
// (restart-guard.ts) holds spawns once a commit changed the code `arthur run` loaded; at each start the model is probed and
// the start notice sent, opening with the lines `arthur doctor` found missing, and a turn that fails before any text is told
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
			// The coordinator's session only: a project agent's handoff would write the coordinator's files (roadmap 88 gives it its own).
			for (const file of EXTENSIONS) given.provide("coordinator.extension", (asked?: { readonly session?: unknown }) => (asked?.session === "coordinator" ? { file, env: { ARTHUR_SESSION_FOLDER: given.folder, ARTHUR_SESSION_TICK_MS: String(tickMs) } } : undefined));
			given.events.on("doctor", ({ data }) => {
				const lines = typeof data === "object" && data !== null && "lines" in data ? data.lines : undefined;
				missing = Array.isArray(lines) ? lines.filter((line) => typeof line === "string") : [];
			});
			registerRestart(given);
			if (options.restartGuard ?? DEFAULTS.restartGuard) registerGuard(given);
		},
		async start() {
			if (host === undefined) return;
			// One left by an `arthur run` before this one is not done late, nor a report it did not read.
			for (const file of [REQUEST, CONTEXT_USE]) rmSync(join(host.folder, file), { force: true });
			if (options.restartGuard ?? DEFAULTS.restartGuard) noteLoaded(host);
			await noteService(host.folder);
			stopProbe = startNotice(host, options.probeLlm ?? DEFAULTS.probeLlm, missing);
			const ticks = [["compaction", compactions(host)], ["restart", restarts(host)], ["turn notice", turnFailures(host)]] as const;
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

// Every 500 ms: the outcome of a compaction, printed once its agent wrote it; one no agent took within its wait, or whose agent
// is gone, dropped without a word (no session ran); and a request, unless one is still there: at a slot, and at a turn's report
// of `compactAtPercent` or more, read once, which then asks again only after a compaction done or a report below it. The trigger
// reads only its conversation's folder and the options, so another conversation can run its own on its own folder.
function compactions(host: Host): () => void {
	const { compactOn = DEFAULTS.compactOn, compactAtPercent = DEFAULTS.compactAtPercent, compactWaitSeconds = DEFAULTS.compactWaitSeconds } = host.options as SessionOptions;
	const compactAt = compactOn === "context" ? [] : ((host.options as SessionOptions).compactAt ?? DEFAULTS.compactAt);
	const [file, use] = [join(host.folder, REQUEST), join(host.folder, CONTEXT_USE)];
	const upcoming = () => compactAt.map((time) => ({ time, at: host.clock.next(time) })).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
	let next = upcoming();
	let armed = true;
	// Slots passed together, or a trigger while a compaction or a restart is still asked for, ask for one, never queue a second.
	const ask = (slot: string) => {
		if (existsSync(file)) return false;
		const asked: Request = { then: "compact", slot, asked: Date.now(), waitSeconds: compactWaitSeconds };
		put(file, JSON.stringify(asked));
		return true;
	};
	return () => {
		const request = readRequest(host.folder);
		if (request?.then === "compact" && (request.line !== undefined || (request.pid === undefined ? Date.now() - request.asked >= request.waitSeconds * 1000 : !alive(request.pid)))) {
			rmSync(file, { force: true });
			if (request.line !== undefined) console.log(`session: ${request.line}`);
			if (request.line?.startsWith("compact: done")) armed = true;
		}
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
