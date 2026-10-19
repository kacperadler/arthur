import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { join } from "node:path";
import { memoryBytes } from "./config.ts";
import { ownScope } from "./job-scope.ts";
import { descendants, processTable } from "./process-table.ts";

// A job's memory cap (spec/roadmap.md, entry 32), watched by its wrapper: docs/commands/spawn.md, "Caps per job".

// Watches job `id`'s cap `cap` (systemd `MemoryMax` syntax, empty for none) and calls `over` at the first sample over it. In
// the job's scope systemd holds the cap (job-scope.ts) and the kernel kills a process over it, which the scope's
// `memory.events` counts as `oom`: read every second. Without a scope (no user manager: macOS, a container), or without the
// memory controller in it, the resident memory of every process below the wrapper is summed every 10 seconds. The returned stop
// ends the watch and says whether the job went over, a kill since the last sample included.
export function watchMemory(id: string, cap: string, over: () => void): () => boolean {
	const limit = cap === "" ? Infinity : (memoryBytes(cap, totalmem()) ?? Infinity);
	if (limit === Infinity) return () => false;
	const scope = ownScope(id);
	const events = scope === undefined ? "" : join(scope, "memory.events");
	const kernel = events !== "" && existsSync(events);
	const kills = () => Number(/^oom (\d+)$/m.exec(readFileSync(events, "utf8"))?.[1] ?? 0);
	const before = kernel ? kills() : 0;
	const sample = () => (kernel ? kills() > before : descendants(processTable(), process.pid).reduce((sum, each) => sum + each.rss * 1024, 0) > limit);
	let went = false;
	const timer = setInterval(() => {
		try {
			if (went || !sample()) return;
		} catch {
			// `ps` could not start, short of memory itself: the next sample tries again.
			return;
		}
		went = true;
		over();
	}, kernel ? 1000 : 10_000);
	return () => {
		clearInterval(timer);
		return went || (kernel && sample());
	};
}

// `start`, which forks the agent, runs with this process's `oom_score_adj` at 1000: the agent and all it starts inherit it, so over
// the cap the kernel kills them before the wrapper, which must live to end the job. Without the file (macOS) `start` just runs.
export function oomFirst<T>(start: () => T): T {
	const file = "/proc/self/oom_score_adj";
	const own = existsSync(file) ? readFileSync(file, "utf8") : undefined;
	if (own !== undefined) writeFileSync(file, "1000");
	const started = start();
	if (own !== undefined) writeFileSync(file, own);
	return started;
}
