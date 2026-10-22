import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, freemem, totalmem } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Disk, diskGB, diskPaths, measureDisk, readDisk, underFloor } from "./machine-disk.ts";

// Each machine's free CPU and memory (spec/roadmap.md, entry 34): Node's `os` on `local`, the same calls through `node -e` over
// the core's SSH on another machine, which the `machines` plugin's check carries at each of its rounds. Each check is kept in
// `<folder>/machines/<name>.json`, so every process (`arthur run`, `arthur spawn`, the coordinator's context) reads the same one:
// docs/resources.md, "How many jobs run".

// What one check found: the machine's cores, the cores its processes kept busy over one second (`load`), its free and total
// memory in bytes, and with a disk floor its filesystems (machine-disk.ts); or why it failed. `jobs` are the jobs in a run on it as the check began: what the numbers already hold; `everySeconds`, the cadence of the round that made it.
export type Measured = { readonly cores: number; readonly load: number; readonly free: number; readonly total: number; readonly disk?: readonly Disk[]; readonly skipped?: readonly string[] };
export type Sample = { readonly at: string; readonly jobs: readonly string[]; readonly everySeconds?: number } & (Measured | { readonly error: string });
// What a round of the `machines` plugin says of a listed machine (`machines.round`): the line its check's `node -e` printed,
// the same SCRIPT as here, and with paths df's exit code and output (machine-disk.ts's SCRIPT, its errors in it); or why the
// machine is offline.
export type Said = { readonly free: string; readonly disk?: { readonly code: number; readonly output: string } } | { readonly error: string };

// A check is cut after this, its ssh killed.
const LIMIT_SECONDS = 10;
// The busy cores are the CPU time all cores spent running (user, nice, sys, irq) over this long, per millisecond: idle time
// and, on Linux, a wait on disk are not in it, though the load average counts such a wait.
const SAMPLE_MS = 1000;
const SCRIPT = `const os = require("node:os"); const busy = () => os.cpus().reduce((sum, { times: t }) => sum + t.user + t.nice + t.sys + t.irq, 0); const [before, start] = [busy(), performance.now()]; setTimeout(() => console.log(JSON.stringify({ cores: os.availableParallelism(), load: Math.max(0, (busy() - before) / (performance.now() - start)), free: os.freemem(), total: os.totalmem() })), ${SAMPLE_MS})`;
const busy = () => cpus().reduce((sum, { times: t }) => sum + t.user + t.nice + t.sys + t.irq, 0);

const number = (value: unknown, least: number) => typeof value === "number" && Number.isFinite(value) && value >= least;
const measured = (value: Readonly<Record<string, unknown>>): value is Measured => number(value.cores, 1) && number(value.load, 0) && number(value.free, 0) && number(value.total, 1);

// `round`, the machine's check in a round of the `machines` plugin, stands for this side's own `node -e` over ssh.
async function measure(host: Host, name: string, round: Said | undefined): Promise<Measured | { readonly error: string }> {
	if (round !== undefined && "error" in round) return { error: round.error };
	if (round === undefined && name === "local") {
		const [before, start] = [busy(), performance.now()];
		await sleep(SAMPLE_MS);
		return { cores: availableParallelism(), load: Math.max(0, (busy() - before) / (performance.now() - start)), free: freemem(), total: totalmem() };
	}
	const ran = round === undefined ? await host.jobs.run(name, ["node", "-e", SCRIPT], LIMIT_SECONDS) : { code: 0, stdout: round.free, stderr: "" };
	const said = ran.stderr.trim().split("\n").at(-1) || `exit code ${ran.code}`;
	if (ran.code === null) return { error: `check timed out after ${LIMIT_SECONDS} s` };
	if (ran.code === 255) return { error: `ssh failed: ${said}` };
	if (ran.code === 127) return { error: `node is not on the PATH of a command over ssh there (${said})` };
	if (ran.code !== 0) return { error: `node -e failed there: ${said}` };
	let answer: unknown;
	try {
		answer = JSON.parse(ran.stdout);
	} catch {}
	if (typeof answer === "object" && answer !== null && measured(answer as Readonly<Record<string, unknown>>)) {
		const { cores, load, free, total } = answer as Measured;
		return { cores, load, free, total };
	}
	return { error: `node -e answered ${JSON.stringify(ran.stdout.trim().slice(0, 80))}, not cores, load and memory` };
}

// Machine `name`'s last check; undefined when there is none, or the file is not one.
export function readSample(folder: string, name: string): Sample | undefined {
	let sample: Readonly<Record<string, unknown>>;
	try {
		sample = JSON.parse(readFileSync(join(folder, "machines", `${name}.json`), "utf8"));
	} catch {
		return undefined;
	}
	const kept = typeof sample === "object" && sample !== null && typeof sample.at === "string" && Array.isArray(sample.jobs) && (sample.everySeconds === undefined || number(sample.everySeconds, 1));
	const disk = sample.disk === undefined || (Array.isArray(sample.disk) && sample.disk.every((each) => typeof each?.path === "string" && number(each.free, 0)));
	const skipped = sample.skipped === undefined || (Array.isArray(sample.skipped) && sample.skipped.every((path) => typeof path === "string"));
	return kept && (typeof sample.error === "string" || (measured(sample) && disk && skipped)) ? (sample as Sample) : undefined;
}

// Checks machine `name` now, or reads `said`, its check in a round of the `machines` plugin begun now, every `everySeconds`, and
// keeps the result; with a disk `floor` above 0 bytes, its filesystems too, from the df the round's check ran on `paths` when
// it carries one. A check that fails after one that answered (or none) is said once, as a `notice`; the next ones that fail
// too are not. A check whose least free filesystem is under the floor, after one that was not (or none), emits `disk-low` and
// a `notice`. Never throws for the machine's own failure.
export async function checkSample(host: Host, folder: string, name: string, floor: number, said?: Promise<Said>, everySeconds?: number, paths?: Promise<readonly string[] | { readonly error: string }>): Promise<Sample> {
	const running = new Set(host.jobs.running());
	const jobs = host.jobs.list().filter((job) => job.machine === name && running.has(job.id)).map((job) => job.id);
	const found = await Promise.resolve(said)
		.then(async (round) => {
			const free = await measure(host, name, round);
			if ("error" in free || floor === 0) return free;
			const named = await (paths ?? diskPaths(host, name));
			if ("error" in named) return named;
			const ran = round !== undefined && "disk" in round ? round.disk : undefined;
			const disk = ran === undefined ? await measureDisk(host, name, named) : readDisk(named, { code: ran.code, stdout: ran.output, stderr: ran.output });
			return "error" in disk ? disk : { ...free, ...disk };
		})
		.catch((error: Error) => ({ error: error.message }));
	const sample: Sample = { at: host.clock.now().toISOString(), jobs, everySeconds, ...found };
	const before = readSample(folder, name);
	const file = join(folder, "machines", `${name}.json`);
	mkdirSync(join(folder, "machines"), { recursive: true });
	writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(sample)}\n`);
	renameSync(`${file}.${process.pid}`, file);
	if ("error" in sample && !(before !== undefined && "error" in before))
		host.events.emit("notice", { text: `machine ${name}: its room is unknown (${sample.error}); no job starts there until a check answers` });
	const low = "error" in sample ? undefined : underFloor(sample.disk, floor);
	if (low === undefined || (before !== undefined && !("error" in before) && underFloor(before.disk, floor) !== undefined)) return sample;
	host.events.emit("disk-low", { machine: name, path: low.path, free: low.free, floor });
	host.events.emit("notice", { text: `machine ${name}: ${diskGB(low.free)} free on ${low.path}, floor ${diskGB(floor)}; no job starts there until it is back at the floor, the running ones go on` });
	return sample;
}
