import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { availableParallelism, freemem, loadavg, totalmem } from "node:os";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// Each machine's free CPU and memory (spec/roadmap.md, entry 34): Node's `os` on `local`, the same calls through `node -e` over
// the core's SSH on another machine. Each check is kept in `<folder>/machines/<name>.json`, so every process (`arthur run`,
// `arthur spawn`, the coordinator's context) reads the same one: docs/resources.md, "How many jobs run".

// What one check found: the machine's cores, its 1-minute load average, its free and total memory in bytes; or why it failed.
// `jobs` are the jobs in a run on it as the check began: what the numbers already hold.
export type Measured = { readonly cores: number; readonly load: number; readonly free: number; readonly total: number };
export type Sample = { readonly at: string; readonly jobs: readonly string[] } & (Measured | { readonly error: string });

// A check is cut after this, its ssh killed.
const LIMIT_SECONDS = 10;
const SCRIPT = 'const os = require("node:os"); console.log(JSON.stringify({ cores: os.availableParallelism(), load: os.loadavg()[0], free: os.freemem(), total: os.totalmem() }))';

const number = (value: unknown, least: number) => typeof value === "number" && Number.isFinite(value) && value >= least;
const measured = (value: Readonly<Record<string, unknown>>): value is Measured => number(value.cores, 1) && number(value.load, 0) && number(value.free, 0) && number(value.total, 1);

async function measure(host: Host, name: string): Promise<Measured | { readonly error: string }> {
	if (name === "local") return { cores: availableParallelism(), load: loadavg()[0] ?? 0, free: freemem(), total: totalmem() };
	const ran = await host.jobs.run(name, ["node", "-e", SCRIPT], LIMIT_SECONDS);
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
	const kept = typeof sample === "object" && sample !== null && typeof sample.at === "string" && Array.isArray(sample.jobs);
	return kept && (typeof sample.error === "string" || measured(sample)) ? (sample as Sample) : undefined;
}

// Checks machine `name` now and keeps the result. A check that fails after one that answered (or none) is said once, as a
// `notice`; the next ones that fail too are not. Never throws for the machine's own failure.
export async function checkSample(host: Host, folder: string, name: string): Promise<Sample> {
	const running = new Set(host.jobs.running());
	const jobs = host.jobs.list().filter((job) => job.machine === name && running.has(job.id)).map((job) => job.id);
	const found = await measure(host, name).catch((error: Error) => ({ error: error.message }));
	const sample: Sample = { at: host.clock.now().toISOString(), jobs, ...found };
	const before = readSample(folder, name);
	const file = join(folder, "machines", `${name}.json`);
	mkdirSync(join(folder, "machines"), { recursive: true });
	writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(sample)}\n`);
	renameSync(`${file}.${process.pid}`, file);
	if ("error" in sample && !(before !== undefined && "error" in before))
		host.events.emit("notice", { text: `machine ${name}: its free CPU and memory are unknown (${sample.error}); no job starts there until a check answers` });
	return sample;
}
