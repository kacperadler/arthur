import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ownScope } from "./job-scope.ts";
import { descendants, processTable } from "./process-table.ts";

const PERCENT = /^\d{1,3}(\.\d{1,2})?%$/;
const SIZE = /^(\d+)(?:\.(\d{1,2}))?([KMGT]?)$/;

// A job's memory cap (spec/roadmap.md, entry 32), and its ticket's (entry 33), watched by its wrapper: docs/commands/spawn.md,
// "Caps per job".

// Watches job `id`'s cap `cap` and the cap `ticketCap` of its ticket `ticket`'s slice (systemd `MemoryMax` syntax, empty for
// none), and calls `over` with what went over at the first sample over one. In the job's scope systemd holds the caps
// (job-scope.ts) and the kernel kills a process over one: the scope's `memory.events` counts its own cap as `oom` and a kill of
// one of its processes, at whatever cap, as `oom_kill`; the ticket's slice, which holds the scope, its own cap as `oom` in
// `memory.events.local`; a kill neither counts came at a cap above the job, so a job without caps is watched too; read every
// second. Without a scope (no user manager: macOS, a container), or without the memory controller in it, the resident memory
// of every process below the wrapper is summed every `sampleMs`, 10 seconds, against `cap`; the ticket's cap is not held.
// `check` samples the scope now, for the wrapper's SIGTERM: systemd stops a scope after an out-of-memory kill in it. `end` ends
// the watch, gives `note` the kernel's lines about each kill, and says what went over, a kill since the last sample included.
// `scope` is the scope's cgroup folder, a test's own in place of this process's.
export function watchMemory(id: string, cap: string, ticket: string, ticketCap: string, over: (what: string) => void, note: (line: string) => void, sampleMs = 10_000, scope = ownScope(id) ?? ""): { readonly check: () => string | undefined; readonly end: () => Promise<string | undefined> } {
	const limit = cap === "" ? Infinity : (memoryBytes(cap, totalmem()) ?? Infinity);
	const kernel = scope !== "" && existsSync(join(scope, "memory.events"));
	const slice = kernel && ticket !== "" && ticketCap !== "" && existsSync(join(dirname(scope), "memory.events.local")) ? dirname(scope) : undefined;
	if (!kernel && limit === Infinity) return { check: () => undefined, end: async () => undefined };
	const since = Date.now();
	const count = (file: string, key: string) => Number(new RegExp(`^${key} (\\d+)$`, "m").exec(readFileSync(file, "utf8"))?.[1] ?? 0);
	const events = join(scope, "memory.events");
	const counts = () => (kernel ? [count(events, "oom"), count(events, "oom_kill"), slice === undefined ? 0 : count(join(slice, "memory.events.local"), "oom")] : [0, 0, 0]);
	const [oom = 0, kills = 0, ticketOom = 0] = counts();
	const [own, theirs] = [`the job went over its memory cap of ${cap}`, `the jobs of ticket ${ticket} went over their memory cap of ${ticketCap}`];
	const above = "the kernel killed a process of the job, out of memory at a cap above the job: the one all jobs share, or the machine's";
	const sample = (): string | undefined => {
		if (!kernel) return descendants(processTable(), process.pid).reduce((sum, each) => sum + each.rss * 1024, 0) > limit ? own : undefined;
		const [oomNow = 0, killsNow = 0, ticketOomNow = 0] = counts();
		if (oomNow > oom) return own;
		if (killsNow === kills) return undefined;
		// A process of this job was killed: at the cap of its ticket's slice when that counts it, else at one above.
		return ticketOomNow > ticketOom ? theirs : above;
	};
	let went: string | undefined;
	// One sample, unless one went over before; `over` hears the first that does.
	const look = (): string | undefined => {
		if (went !== undefined) return went;
		try {
			went = sample();
		} catch {
			// `ps` could not start, short of memory itself: the next sample tries again.
		}
		if (went !== undefined) over(went);
		return went;
	};
	const timer = setInterval(look, kernel ? 1000 : sampleMs);
	return {
		check: () => (kernel ? look() : undefined),
		end: async () => {
			clearInterval(timer);
			if (kernel) went ??= sample();
			if (kernel && count(events, "oom_kill") > kills) for (const line of await oomKills(basename(scope), since)) note(line);
			return went;
		},
	};
}

// The kernel's lines (`journalctl -k`) about each process it killed out of memory in the scope `unit` since `since`, each after
// `the kernel: `: its `oom-kill:` line, which names the cgroup whose cap was reached (`oom_memcg`), and its `Killed process`
// line, which names the process and its size. journald may write them after the scope counts the kill: asked again every
// 100 ms, `tries` times at most; then what it has, or one line that says why it has none.
export async function oomKills(unit: string, since: number, tries = 20): Promise<string[]> {
	for (let left = tries; ; await sleep(100)) {
		const run = spawnSync("journalctl", ["-k", "-o", "cat", "--no-pager", `--since=@${Math.floor(since / 1000)}`, "--grep=oom-kill:|Killed process"], { encoding: "utf8" });
		const lines = (run.stdout ?? "").split("\n");
		const mine = lines.filter((line) => line.includes(`/${unit},task=`));
		const kills = lines.filter((line) => mine.some((kill) => line.includes(`Killed process ${/,pid=(\d+),uid=\d+$/.exec(kill)?.[1]} (`)));
		if ((mine.length === 0 || kills.length < mine.length) && --left > 0) continue;
		const told = [...mine, ...kills].map((line) => `the kernel: ${line}`);
		return told.length > 0 ? told : [`the kernel's log names no process killed in ${unit}; journalctl -k: ${(run.error?.message ?? run.stderr.trim().split("\n")[0]) || "no such line"}`];
	}
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
