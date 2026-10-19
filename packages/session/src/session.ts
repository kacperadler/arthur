import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe } from "@arthur/core";
import type { Host, OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { alive, put, REQUEST, type Request, readRequest } from "./request.ts";
import { registerRestart, restarts } from "./restart.ts";
import { noteLoaded, registerGuard } from "./restart-guard.ts";
import { table, time } from "./session-options.ts";
import { startNotice, turnFailures } from "./start-notice.ts";

// The session plugin (spec/roadmap.md, entries 35 to 38): the coordinator's conversation compacted at each `compactAt`, new at
// `freshAt` once no job runs, restarted on `/restart`, each after a handoff the coordinator writes and the next conversation
// reads first. `arthur run` asks for each in `<home>/session/request.json` and acts on its outcome (restart.ts for restarts);
// the handoff extension, which orchestration loads into the coordinator's agent, does the agent's part; the restart guard
// (restart-guard.ts) holds spawns once a commit changed the code `arthur run` loaded; at each start the model is probed and
// the start notice sent, and a turn that fails before any text is told (start-notice.ts): docs/session.md.

export type SessionOptions = {
	readonly enabled?: boolean;
	readonly compactAt?: readonly string[];
	readonly compactWaitSeconds?: number;
	readonly freshAt?: string;
	readonly freshRetryMinutes?: number;
	readonly freshUntil?: string;
	readonly restartGuard?: boolean;
	readonly probeLlm?: boolean;
};

const EXTENSIONS = ["handoff-extension.ts", "turn-extension.ts"].map((file) => fileURLToPath(new URL(file, import.meta.url)));
const TICK_MS = 500;

export function session(options: SessionOptions = {}): Plugin {
	let host: Host | undefined;
	let timer: NodeJS.Timeout | undefined;
	let stopProbe: (() => void) | undefined;
	return {
		name: "session",
		options,
		requires: ["orchestration"],
		check: checkOptions,
		setup(given) {
			host = given;
			for (const file of EXTENSIONS) given.provide("coordinator.extension", () => ({ file, env: { ARTHUR_SESSION_FOLDER: given.folder } }));
			registerRestart(given);
			if (options.restartGuard !== false) registerGuard(given);
		},
		start() {
			if (host === undefined) return;
			// One left by an `arthur run` before this one is not done late.
			rmSync(join(host.folder, REQUEST), { force: true });
			if (options.restartGuard !== false) noteLoaded(host);
			stopProbe = startNotice(host, options.probeLlm !== false);
			const [compact, restart, failures] = [compactions(host), restarts(host), turnFailures(host)];
			timer = setInterval(() => {
				compact();
				restart();
				failures();
			}, TICK_MS);
		},
		stop() {
			clearInterval(timer);
			stopProbe?.();
		},
	};
}

// Every 500 ms: the outcome of a compaction, printed once its agent wrote it; one no agent took within its wait, or whose agent
// is gone, dropped without a word (no session ran); and at a slot, a request, unless one is still there.
function compactions(host: Host): () => void {
	const { compactAt = ["08:00", "13:00", "18:00"], compactWaitSeconds = 1800 } = host.options as SessionOptions;
	const file = join(host.folder, REQUEST);
	const upcoming = () => compactAt.map((time) => ({ time, at: host.clock.next(time) })).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
	let next = upcoming();
	return () => {
		const request = readRequest(host.folder);
		if (request?.then === "compact") {
			if (request.line !== undefined) console.log(`session: ${request.line}`);
			if (request.line !== undefined || (request.pid === undefined ? Date.now() - request.asked >= request.waitSeconds * 1000 : !alive(request.pid))) rmSync(file, { force: true });
		}
		if (next === undefined || host.clock.now() < next.at) return;
		// Slots passed together, or one while a compaction or a restart is still asked for, ask for one, never queue a second.
		const slot = next.time;
		next = upcoming();
		if (existsSync(file)) return;
		const asked: Request = { then: "compact", slot, asked: Date.now(), waitSeconds: compactWaitSeconds };
		put(file, JSON.stringify(asked));
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
