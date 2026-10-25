import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { dirname, join } from "node:path";
import { ownScope } from "./job-scope.ts";
import { descendants, processTable } from "./process-table.ts";

const PERCENT = /^\d{1,3}(\.\d{1,2})?%$/;
const SIZE = /^(\d+)(?:\.(\d{1,2}))?([KMGT]?)$/;

// A job's memory cap (spec/roadmap.md, entry 32), and its ticket's (entry 33), watched by its wrapper: docs/commands/spawn.md,
// "Caps per job".

// Watches job `id`'s cap `cap` and the cap `ticketCap` of its ticket `ticket`'s slice (systemd `MemoryMax` syntax, empty for
// none), and calls `over` with what went over at the first sample over one. In the job's scope systemd holds the caps
// (job-scope.ts) and the kernel kills a process over one: the scope's `memory.events` counts its own cap as `oom` and a kill of
// one of its processes as `oom_kill`, the ticket's slice, which holds the scope, its own cap as `oom` in `memory.events.local`;
// read every second. Without a scope (no user manager: macOS, a container), or without the memory controller in it, the
// resident memory of every process below the wrapper is summed every 10 seconds against `cap`; the ticket's cap is not held. The
// returned stop ends the watch and says what went over, a kill since the last sample included.
export function watchMemory(id: string, cap: string, ticket: string, ticketCap: string, over: (what: string) => void): () => string | undefined {
	const limit = cap === "" ? Infinity : (memoryBytes(cap, totalmem()) ?? Infinity);
	const scope = ownScope(id) ?? "";
	const kernel = scope !== "" && existsSync(join(scope, "memory.events"));
	const slice = kernel && ticket !== "" && ticketCap !== "" && existsSync(join(dirname(scope), "memory.events.local")) ? dirname(scope) : undefined;
	if (limit === Infinity && slice === undefined) return () => undefined;
	const count = (file: string, key: string) => Number(new RegExp(`^${key} (\\d+)$`, "m").exec(readFileSync(file, "utf8"))?.[1] ?? 0);
	const events = join(scope, "memory.events");
	const counts = () => (kernel ? [count(events, "oom"), count(events, "oom_kill"), slice === undefined ? 0 : count(join(slice, "memory.events.local"), "oom")] : [0, 0, 0]);
	const [oom = 0, kills = 0, ticketOom = 0] = counts();
	const [own, theirs] = [`the job went over its memory cap of ${cap}`, `the jobs of ticket ${ticket} went over their memory cap of ${ticketCap}`];
	const sample = (): string | undefined => {
		if (!kernel) return descendants(processTable(), process.pid).reduce((sum, each) => sum + each.rss * 1024, 0) > limit ? own : undefined;
		const [oomNow = 0, killsNow = 0, ticketOomNow = 0] = counts();
		if (oomNow > oom) return own;
		// The slice's cap reached kills a process of one of its jobs: this job's, when its scope counts the kill.
		return ticketOomNow > ticketOom && killsNow > kills ? theirs : undefined;
	};
	let went: string | undefined;
	const timer = setInterval(() => {
		try {
			if (went !== undefined) return;
			went = sample();
		} catch {
			// `ps` could not start, short of memory itself: the next sample tries again.
			return;
		}
		if (went !== undefined) over(went);
	}, kernel ? 1000 : 10_000);
	return () => {
		clearInterval(timer);
		return went ?? (kernel ? sample() : undefined);
	};
}

// `start`, which forks the agent, runs with this process's `oom_score_adj` at 1000: the agent and all it starts inherit it, so over
// the cap the kernel kills them before the wrapper. Without the file (macOS) or where its write is refused (EACCES, EPERM: inside a job's sandbox) `start` just runs.
export function oomFirst<T>(start: () => T, file = "/proc/self/oom_score_adj"): T {
	let own = existsSync(file) ? readFileSync(file, "utf8") : undefined;
	try { if (own !== undefined) writeFileSync(file, "1000"); } catch (error) { if (!["EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error; own = undefined; }
	const started = start();
	if (own !== undefined) writeFileSync(file, own);
	return started;
}

// systemd's MemoryMax in bytes, a percentage of `total` (the machine's memory), Infinity for `infinity`; undefined for what
// systemd refuses, as far as it does: a percentage above 0 and up to 100 with at most 2 decimals; or bytes with at most 2
// decimals and an optional K, M, G or T (powers of 1024), at least 1 byte once the fraction is cut and below 2^63 (systemd
// refuses some values below 2^64). The rest is refused, a few values systemd takes (P, E, more decimals) included.
export function memoryBytes(text: string, total: number): number | undefined {
	if (text === "infinity") return Infinity;
	const percent = PERCENT.test(text) ? Number(text.slice(0, -1)) : undefined;
	if (percent !== undefined) return percent > 0 && percent <= 100 ? (total * percent) / 100 : undefined;
	const [, whole, fraction = "", unit = ""] = SIZE.exec(text) ?? [];
	if (whole === undefined) return undefined;
	const bytes = (BigInt(whole + fraction) * 1024n ** BigInt(["", "K", "M", "G", "T"].indexOf(unit))) / 10n ** BigInt(fraction.length);
	return bytes >= 1n && bytes < 2n ** 63n ? Number(bytes) : undefined;
}
