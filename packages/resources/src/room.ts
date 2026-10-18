import { totalmem } from "node:os";
import { describe, memoryBytes } from "@arthur/core";
import type { Host, OptionProblem } from "@arthur/core/plugin";
import { checkSample, readSample, type Sample } from "./machine-free.ts";

// How many jobs run (spec/roadmap.md, entry 34): each machine's room for more jobs, from its last check of free CPU and memory,
// less `keepFree`, less the `perJob` reservation of each job started on it since that check; `resources.free`, the spawn check,
// the coordinator's context lines, and `arthur resources`: docs/resources.md, "How many jobs run".

export type KeepFree = { readonly cpu?: number; readonly memory?: string };
type Reserve = { readonly cpu?: number; readonly memory?: string };

// `arthur run` checks every machine this often; a check older than twice this is made again when a spawn or a command needs it.
export const CHECK_SECONDS = 60;
const GB = 2 ** 30;

// The problems of `keepFree`: an object of `cpu` (cores, 0 or more) and `memory` (MemoryMax syntax, not `infinity`).
export function keepFreeProblems(value: unknown): OptionProblem[] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return [{ path: "keepFree", problem: `expected an object with cpu, memory, got ${describe(value)}` }];
	const { cpu, memory, ...unknown } = value as Readonly<Record<string, unknown>>;
	const problems: OptionProblem[] = Object.keys(unknown).map((key) => ({ path: `keepFree.${key}`, problem: "unknown key; keys: cpu, memory" }));
	if (cpu !== undefined && !(typeof cpu === "number" && Number.isFinite(cpu) && cpu >= 0)) problems.push({ path: "keepFree.cpu", problem: `expected a number of cores, 0 or more, got ${describe(cpu)}` });
	if (memory !== undefined && (memory === "infinity" || typeof memory !== "string" || memoryBytes(memory, totalmem()) === undefined))
		problems.push({ path: "keepFree.memory", problem: `expected bytes with K, M, G or T ("2G") or a percentage of the machine's memory ("10%"), got ${describe(memory)}` });
	return problems;
}

// What machine `name` has room for, as `sample` and the `pending` jobs started on it since found it: the number of jobs, and
// the line that says it. Each job reserves its `perJob` caps (CPU at most the machine's cores, memory `infinity` none); it
// starts when what is free, less `keepFree` and the pending jobs' reservations, holds its own reservation, exactly too.
export function roomOf(name: string, sample: Sample | undefined, pending: number, perJob: Reserve, keepFree: KeepFree): { readonly jobs: number; readonly line: string } {
	if (sample === undefined) return { jobs: 0, line: `${name}: no room, not checked yet` };
	if ("error" in sample) return { jobs: 0, line: `${name}: no room, its check failed: ${sample.error}` };
	// CPU in thousandths of a core, memory in bytes, so a reservation equal to what is left fits.
	const bytes = (memory: string | undefined) => {
		const value = memory === undefined ? 0 : (memoryBytes(memory, sample.total) ?? 0);
		return Number.isFinite(value) ? Math.floor(value) : 0;
	};
	const need = { cpu: Math.round(Math.min(perJob.cpu ?? 0, sample.cores) * 1000), memory: bytes(perJob.memory) };
	const free = { cpu: Math.max(0, Math.round((sample.cores - sample.load) * 1000)) - pending * need.cpu, memory: sample.free - pending * need.memory };
	const left = { cpu: free.cpu - Math.round((keepFree.cpu ?? 0) * 1000), memory: free.memory - bytes(keepFree.memory) };
	const fits = (key: "cpu" | "memory") => (need[key] === 0 ? (left[key] >= 0 ? Infinity : 0) : Math.max(0, Math.floor(left[key] / need[key])));
	const jobs = Math.min(fits("cpu"), fits("memory"));
	const [gb, cores] = [(value: number) => (Math.max(0, value) / GB).toFixed(1), (value: number) => (Math.max(0, value) / 1000).toFixed(1)];
	const shown = `${gb(free.memory)} GB, ${cores(free.cpu)} cores free`;
	if (jobs === Infinity) return { jobs, line: `${name}: room for any number of jobs, perJob reserving nothing (${shown})` };
	if (jobs > 0) return { jobs, line: `${name}: room for ${jobs} more job${jobs === 1 ? "" : "s"} (${shown})` };
	const short = [
		need.memory - left.memory > 0 ? `${(Math.ceil(((need.memory - left.memory) / GB) * 10) / 10).toFixed(1)} GB memory` : "",
		need.cpu - left.cpu > 0 ? `${(Math.ceil((need.cpu - left.cpu) / 100) / 10).toFixed(1)} cores` : "",
	].filter(Boolean);
	const since = pending === 0 ? "" : `; reserved for ${pending} job${pending === 1 ? "" : "s"} started since the check`;
	const keep = `keepFree ${gb(bytes(keepFree.memory))} GB, ${cores(Math.round((keepFree.cpu ?? 0) * 1000))} cores`;
	return { jobs, line: `${name}: no room, short of ${short.join(" and ")} (${shown}; ${keep}; a job reserves ${gb(need.memory)} GB, ${cores(need.cpu)} cores${since})` };
}

// The room of every machine `host.jobs.machines()` names, read from the checks kept in `folder`.
export function roomGuard(host: Host, folder: string, perJob: Reserve, keepFree: KeepFree) {
	const checking = new Map<string, Promise<Sample>>();
	// One check of a machine at a time in this process; whoever asks while it runs gets that one.
	const check = (name: string) => {
		const going = checking.get(name) ?? checkSample(host, folder, name).finally(() => checking.delete(name));
		checking.set(name, going);
		return going;
	};
	// The last check, made again when there is none or it is older than twice CHECK_SECONDS.
	const fresh = async (name: string) => {
		const sample = readSample(folder, name);
		return sample !== undefined && host.clock.now().getTime() - Date.parse(sample.at) < 2 * CHECK_SECONDS * 1000 ? sample : check(name);
	};
	const room = (name: string, sample: Sample | undefined) => {
		const running = new Set(host.jobs.running());
		const pending = host.jobs.list().filter((job) => job.machine === name && running.has(job.id) && !sample?.jobs.includes(job.id)).length;
		return roomOf(name, sample, pending, perJob, keepFree);
	};
	const lines = async () => (await Promise.all(host.jobs.machines().map(async (name) => room(name, await fresh(name)).line))).join("\n");
	return {
		checkAll: () => Promise.all(host.jobs.machines().map(check)),
		// `resources.free`: the jobs machine `name` has room for, as placement reads it.
		free: async (name: string) => room(name, await fresh(name)).jobs,
		// `beforeSpawn`: a job starts only on a machine with room for it; the refusal names every machine and its room.
		async check({ machine }: { readonly machine: string }): Promise<string | undefined> {
			if (room(machine, await fresh(machine)).jobs > 0) return undefined;
			return `no room on ${machine} for another job: ${(await lines()).split("\n").join("; ")}; spawn again once a job ends`;
		},
		lines,
		// The coordinator's context: the same lines from the checks kept, without checking anew.
		context: () => host.jobs.machines().map((name) => room(name, readSample(folder, name)).line).join("\n"),
	};
}
