import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe } from "@arthur/core";
import type { Host, OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import type { Request } from "./compact-extension.ts";

// The session plugin (spec/roadmap.md, entry 35): the coordinator's conversation compacted at each `compactAt`, after a handoff
// the coordinator writes and the compacted conversation reads first. `arthur run` asks for each compaction in
// `<home>/session/compact.json` and prints its outcome; the compact extension, which orchestration loads into the coordinator's
// agent, does it: docs/session.md.

export type SessionOptions = { readonly enabled?: boolean; readonly compactAt?: readonly string[]; readonly compactWaitSeconds?: number };

const EXTENSION = fileURLToPath(new URL("compact-extension.ts", import.meta.url));
const OPTIONS = ["compactAt", "compactWaitSeconds"];
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TICK_MS = 500;

export function session(options: SessionOptions = {}): Plugin {
	let host: Host | undefined;
	let timer: NodeJS.Timeout | undefined;
	return {
		name: "session",
		options,
		requires: ["orchestration"],
		check: checkOptions,
		setup(given) {
			host = given;
			given.provide("coordinator.extension", () => ({ file: EXTENSION, env: { ARTHUR_SESSION_FOLDER: given.folder } }));
		},
		start() {
			if (host !== undefined) timer = compactions(host);
		},
		stop() {
			clearInterval(timer);
		},
	};
}

// Every 500 ms: the outcome of the request, printed once its agent wrote it; a request no agent took within its wait, or whose
// agent is gone, dropped without a word (no session ran); and at a slot, a request, unless one is still there.
function compactions(host: Host): NodeJS.Timeout {
	const { compactAt = ["08:00", "13:00", "18:00"], compactWaitSeconds = 1800 } = host.options as SessionOptions;
	const file = join(host.folder, "compact.json");
	// One left by an `arthur run` before this one is not done late.
	rmSync(file, { force: true });
	const upcoming = () => compactAt.map((time) => ({ time, at: host.clock.next(time) })).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
	let next = upcoming();
	return setInterval(() => {
		const request = read(file);
		if (request?.line !== undefined) console.log(`session: ${request.line}`);
		if (request !== undefined && (request.line !== undefined || (request.pid === undefined ? Date.now() - request.asked >= request.waitSeconds * 1000 : !alive(request.pid)))) rmSync(file, { force: true });
		if (next === undefined || host.clock.now() < next.at) return;
		// Slots passed together, or one while a compaction still runs, ask for one compaction, never queue a second.
		const slot = next.time;
		next = upcoming();
		if (existsSync(file)) return;
		const asked: Request = { slot, asked: Date.now(), waitSeconds: compactWaitSeconds };
		writeFileSync(`${file}.${process.pid}`, JSON.stringify(asked));
		renameSync(`${file}.${process.pid}`, file);
	}, TICK_MS);
}

// The request, or undefined when there is none; one that is not a request is dropped, named.
function read(file: string): Request | undefined {
	if (!existsSync(file)) return undefined;
	const text = readFileSync(file, "utf8");
	try {
		const request = JSON.parse(text) as Request;
		if (typeof request.slot === "string" && Number.isFinite(request.asked) && Number.isFinite(request.waitSeconds)) return request;
	} catch {}
	console.error(`session: ${file} is not a compaction request, so it is dropped: ${text.slice(0, 200)}`);
	rmSync(file, { force: true });
	return undefined;
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !OPTIONS.includes(key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${OPTIONS.join(", ")}` }));
	const { compactAt, compactWaitSeconds } = options;
	if (compactAt !== undefined && !Array.isArray(compactAt)) problems.push({ path: "compactAt", problem: `expected a list of times "HH:MM", got ${describe(compactAt)}` });
	for (const [index, time] of (Array.isArray(compactAt) ? compactAt : []).entries())
		if (typeof time !== "string" || !HH_MM.test(time)) problems.push({ path: `compactAt[${index}]`, problem: `expected a time "HH:MM" from 00:00 to 23:59, got ${describe(time)}` });
	if (compactWaitSeconds !== undefined && !(Number.isInteger(compactWaitSeconds) && (compactWaitSeconds as number) >= 1))
		problems.push({ path: "compactWaitSeconds", problem: `expected a whole number of seconds of at least 1, got ${describe(compactWaitSeconds)}` });
	return problems;
}
