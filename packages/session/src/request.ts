import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// What `arthur run` asks of the coordinator's agent, one request at a time in `<home>/session/request.json` (spec/roadmap.md,
// entries 35 and 36): a compaction, or a restart (`fresh` without `--continue`), each after the handoff; the handoff extension
// (handoff-extension.ts) takes it and writes its outcome into it: docs/session.md.

// Asked at `asked` (ms) by `slot` (a compactAt or freshAt time, or `/restart`), withdrawn once the session has been busy for
// `waitSeconds`; `pid` is the agent that took it, `line` its outcome: a compaction's line, or for a restart `handoff written`
// or `handoff not written: <reason>`.
export type Request = {
	readonly then: "compact" | "restart" | "fresh";
	readonly slot: string;
	readonly asked: number;
	readonly waitSeconds: number;
	readonly pid?: number;
	readonly line?: string;
};

const THEN = ["compact", "restart", "fresh"];

export const REQUEST = "request.json";

// Written whole under a temporary name, then renamed, so a reader never sees half of it.
export function put(path: string, text: string): void {
	writeFileSync(`${path}.${process.pid}`, text);
	renameSync(`${path}.${process.pid}`, path);
}

// The request, or undefined when there is none; one that is not a request is dropped, named.
export function readRequest(folder: string): Request | undefined {
	const file = join(folder, REQUEST);
	if (!existsSync(file)) return undefined;
	const text = readFileSync(file, "utf8");
	try {
		const request = JSON.parse(text) as Request;
		if (THEN.includes(request.then) && typeof request.slot === "string" && Number.isFinite(request.asked) && Number.isFinite(request.waitSeconds)) return request;
	} catch {}
	console.error(`session: ${file} is not a request, so it is dropped: ${text.slice(0, 200)}`);
	rmSync(file, { force: true });
	return undefined;
}

export function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

// The pid of the coordinator's agent that the handoff extension noted at its start, when that agent still runs.
export function agentUp(folder: string): number | undefined {
	const file = join(folder, "agent");
	const pid = existsSync(file) ? Number(readFileSync(file, "utf8")) : Number.NaN;
	return Number.isInteger(pid) && pid > 0 && alive(pid) ? pid : undefined;
}
