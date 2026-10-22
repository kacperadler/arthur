import { memoryBytes } from "@arthur/core";
import type { Host } from "@arthur/core/plugin";
import { diskGB, diskPaths, leastFree, underFloor } from "./machine-disk.ts";
import { checkSample, readSample, type Said, type Sample } from "./machine-free.ts";

// How many jobs run (spec/roadmap.md, entries 34 and 69): each machine's room for more jobs, from its last check of free CPU and
// memory, less `keepFree`, less the `perJob` reservation of each job started on it since that check, and none while its least
// free filesystem is under `keepFree.disk`; `resources.free`, the spawn check, the coordinator's context lines, and
// `arthur resources`: docs/resources.md, "How many jobs run" and "Free disk".

export type KeepFree = { readonly cpu?: number; readonly memory?: string; readonly disk?: string | 0 };
type Reserve = { readonly cpu?: number; readonly memory?: string };
// `keepFree.disk` in bytes, 0 for no floor.
const diskFloor = (keepFree: KeepFree) => (typeof keepFree.disk === "string" ? (memoryBytes(keepFree.disk, 0) ?? 0) : 0);

// `arthur run` checks `local` this often, and each other machine at each round of the `machines` plugin; a check older than
// twice this, or than twice the `check.everySeconds` of the round that made it, is made again when a spawn or a command needs it.
export const CHECK_SECONDS = 60;
const GB = 2 ** 30;

// What machine `name` has room for, as `sample` and the `pending` jobs started on it since found it: the number of jobs, and
// the line that says it, with a line for each path its check skipped. Each job reserves its `perJob` caps (CPU at most the
// machine's cores, memory `infinity` none); it starts when what is free, less `keepFree` and the pending jobs' reservations,
// holds its own reservation, exactly too, and its least free filesystem holds `keepFree.disk`, exactly too.
export function roomOf(name: string, sample: Sample | undefined, pending: number, perJob: Reserve, keepFree: KeepFree): { readonly jobs: number; readonly line: string } {
	if (sample === undefined) return { jobs: 0, line: `${name}: no room, not checked yet` };
	if ("error" in sample) return { jobs: 0, line: `${name}: no room, its check failed: ${sample.error}` };
	const floor = diskFloor(keepFree);
	if (floor > 0 && sample.disk === undefined) return { jobs: 0, line: `${name}: no room, its free disk not checked yet` };
	const skipped = (sample.skipped ?? []).map((path) => `\n${name}: skipped ${path}, not there`).join("");
	const low = underFloor(sample.disk, floor);
	if (low !== undefined) return { jobs: 0, line: `${name}: no room, ${diskGB(low.free)} free on ${low.path}, floor ${diskGB(floor)}${skipped}` };
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
	const least = leastFree(sample.disk);
	const shown = `${gb(free.memory)} GB, ${cores(free.cpu)} cores${least === undefined ? "" : `, ${diskGB(least.free)} disk`} free`;
	if (jobs === Infinity) return { jobs, line: `${name}: room for any number of jobs, perJob reserving nothing (${shown})${skipped}` };
	if (jobs > 0) return { jobs, line: `${name}: room for ${jobs} more job${jobs === 1 ? "" : "s"} (${shown})${skipped}` };
	const short = [
		need.memory - left.memory > 0 ? `${(Math.ceil(((need.memory - left.memory) / GB) * 10) / 10).toFixed(1)} GB memory` : "",
		need.cpu - left.cpu > 0 ? `${(Math.ceil((need.cpu - left.cpu) / 100) / 10).toFixed(1)} cores` : "",
	].filter(Boolean);
	const since = pending === 0 ? "" : `; reserved for ${pending} job${pending === 1 ? "" : "s"} started since the check`;
	const keep = `keepFree ${gb(bytes(keepFree.memory))} GB, ${cores(Math.round((keepFree.cpu ?? 0) * 1000))} cores${floor > 0 ? `, ${diskGB(floor)} disk` : ""}`;
	return { jobs, line: `${name}: no room, short of ${short.join(" and ")} (${shown}; ${keep}; a job reserves ${gb(need.memory)} GB, ${cores(need.cpu)} cores${since})${skipped}` };
}

// The room of every machine `host.jobs.machines()` names, read from the checks kept in `folder`.
export function roomGuard(host: Host, folder: string, perJob: Reserve, keepFree: KeepFree) {
	const checking = new Map<string, Promise<Sample>>();
	// One check of a machine at a time in this process, a round's taking over; whoever asks while it runs gets that one.
	const keep = (name: string, sample: Promise<Sample>) => {
		const going: Promise<Sample> = sample.finally(() => checking.get(name) === going && checking.delete(name));
		checking.set(name, going);
		return going;
	};
	const floor = diskFloor(keepFree);
	const check = (name: string) => checking.get(name) ?? keep(name, checkSample(host, folder, name, floor));
	// A check in flight, a round's included, so nothing reads the one before it; else the last check, made again when there is
	// none or it is older than twice its round's `everySeconds`, or CHECK_SECONDS for a check of this plugin's own.
	const fresh = async (name: string) => {
		const sample = readSample(folder, name);
		return checking.get(name) ?? (sample !== undefined && host.clock.now().getTime() - Date.parse(sample.at) < 2 * (sample.everySeconds ?? CHECK_SECONDS) * 1000 ? sample : check(name));
	};
	const room = (name: string, sample: Sample | undefined) => {
		const running = new Set(host.jobs.running());
		const pending = host.jobs.list().filter((job) => job.machine === name && running.has(job.id) && !sample?.jobs.includes(job.id)).length;
		return roomOf(name, sample, pending, perJob, keepFree);
	};
	const lines = async () => (await Promise.all(host.jobs.machines().map(async (name) => room(name, await fresh(name)).line))).join("\n");
	return {
		checkLocal: () => check("local"),
		// `machines.round`: each listed machine's check of a round begun now, every `everySeconds`, kept as its check (`samples`);
		// with a floor, `paths` names the ones each check's df reads, so the round's one ssh call carries the disk too.
		round: (checks: ReadonlyMap<string, Promise<Said>>, everySeconds?: number) => {
			const asked = new Map([...checks.keys()].map((name) => [name, floor > 0 ? diskPaths(host, name) : undefined]));
			const samples = Promise.all([...checks].map(([name, said]) => keep(name, checkSample(host, folder, name, floor, said, everySeconds, asked.get(name)))));
			// A provider's refusal reaches the machine's sample; its check reads no path.
			const answered = Promise.all([...asked].map(async ([name, paths]) => [name, (await paths?.catch(() => undefined)) ?? []] as const));
			return { samples, paths: answered.then((entries) => new Map(entries.map(([name, paths]) => [name, "error" in paths ? [] : paths]))) };
		},
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
