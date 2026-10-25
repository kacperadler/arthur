import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, rmSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Bus } from "./events.ts";
import { field, moveJob, write } from "./job-state.ts";
import type { Job } from "./jobs.ts";

// A job's systemd scope and the slice all jobs share: docs/commands/spawn.md.

// The slice of Arthur's jobs, without `.slice`; a test names its own.
export const SLICE = "arthur-jobs";

// The joint slice: its name, the cores (`cpu`) and the systemd `MemoryMax` (`memory`) all jobs in it share.
export type Slice = { readonly slice: string; readonly cpu: number; readonly memory: string };
// The joint limit when the config sets none: here, and on another machine, where the config is not, from its own cores.
export const machineLimit = () => ({ cpu: Math.max(1, availableParallelism() - 1), memory: "70%" });

// One job's own caps, which a plugin's `jobs.limits` answers (spec/roadmap.md, entries 32 and 33): cores, and systemd
// `MemoryMax`; `feature`, the slice of its ticket inside the jobs' slice, `name` in letters and digits, and what all its jobs share.
export type Caps = { readonly cpu?: number; readonly memory?: string; readonly feature?: { readonly name: string; readonly cpu?: number; readonly memory?: string } };

// How long `launch` waits for the wrapper's `pid`.
const START_MS = 10_000;

const scope = (id: string) => `arthur-job-${id}.scope`;

// The caps of a spawn: what the one plugin that provides `jobs.limits` answers, none without one.
export async function jobCaps(answers: readonly unknown[]): Promise<Caps> {
	if (answers.length > 1) throw new Error(`call("jobs.limits"): provided by ${answers.length} plugins; call needs exactly one`);
	const { cpu, memory, feature } = ((await answers[0]) ?? {}) as Caps;
	if (feature !== undefined && !/^[A-Za-z0-9]+$/.test(String(feature?.name))) throw new Error(`jobs.limits: feature.name must be letters and digits, got ${JSON.stringify(feature?.name)}`);
	return { cpu, memory, ...(feature === undefined ? {} : { feature: { name: feature.name, cpu: feature.cpu, memory: feature.memory } }) };
}

// What a prepare of plugin `owner` returned: nothing, or the variables it adds to the job's environment, each a name and a text;
// a value is never named in a refusal. `ARTHUR_AGENT_MODEL` is the model the agent is given in place of the record's (wrapper.ts).
export function jobEnv(owner: string, value: unknown): Readonly<Record<string, string>> {
	if (value === undefined) return {};
	const entries: [string, unknown][] = typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [["", value]];
	if (entries.some(([name, text]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof text !== "string"))
		throw new Error(`plugin ${owner}: prepare must return nothing or the job's variables, each a name of letters, digits and _ with a text`);
	return value as Readonly<Record<string, string>>;
}

// Starts the wrapper of `job` (`agent`: `core.agent.command`) with `env`, the variables the prepares returned, over Arthur's
// own environment; returns why it did not start, which ended the job `failed`. A job with caps that runs bare tells `uncapped` why.
export async function launch(home: string, job: Pick<Job, "id" | "kind" | "project">, agent: string, jobs: Slice, bus: Bus, uncapped: (why: string) => void, env: Readonly<Record<string, string>> = {}): Promise<string | undefined> {
	const { id } = job;
	const wrapper = [process.execPath, join(import.meta.dirname, "wrapper.ts"), home, id, agent];
	const [cpu = "", memory = "", feature = "", featureCpu = "", featureMemory = ""] = ["cpu", "memory", "feature", "feature-cpu", "feature-memory"].map(field(home, id));
	// The slice of the job's ticket, a `-` nesting it in the jobs' slice.
	const slice = feature === "" ? jobs.slice : `${jobs.slice}-${feature}`;
	const bare = setSlice(jobs.slice, String(jobs.cpu), jobs.memory) ?? (feature === "" ? undefined : setSlice(slice, featureCpu && String(Math.min(Number(featureCpu), availableParallelism())), featureMemory, `MemorySwapMax=${featureMemory === "" ? "infinity" : "0"}`));
	if (bare !== undefined) {
		const line = `no systemd scope: ${bare}; the job runs bare, without the joint limit of core.jobs.cpu and core.jobs.memory, and what it leaves behind is not killed at its end`;
		appendFileSync(join(home, "jobs", id, "log"), `[arthur ${new Date().toISOString()}] ${line}\n`);
		if (cpu !== "" || memory !== "" || feature !== "") uncapped(bare);
	}
	const log = join(home, "wrapper.log");
	// `systemd-run` execs `sh`, which execs the wrapper with its stderr on the log: what reaches the pipe is systemd-run's own.
	const scoped = ["systemd-run", "--user", "--scope", "--quiet", "--collect", `--slice=${slice}.slice`, `--unit=${scope(id)}`, ...ownLimits(cpu, memory, featureMemory), "--"];
	const [command = "", ...args] = bare === undefined ? [...scoped, "/bin/sh", "-c", 'exec "$@" 2>>"$0"', log, ...wrapper] : wrapper;
	const output = openSync(log, "a");
	let child: ChildProcess;
	try {
		child = spawn(command, args, { detached: true, env: { ...process.env, ARTHUR_AGENT_MODEL: undefined, ...env }, stdio: ["ignore", output, bare === undefined ? "pipe" : output] });
	} finally {
		closeSync(output);
	}
	let stderr = "";
	child.stderr?.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
	// Why the wrapper did not start, once the process failed to spawn or exited.
	let exited: string | undefined;
	const closed = Promise.withResolvers<void>();
	child.once("error", (error) => {
		exited ??= `${basename(command)}: ${error.message}`;
		closed.resolve();
	});
	child.once("close", (code, signal) => {
		const line = stderr.split("\n").find((text) => text.trim() !== "")?.trim();
		exited ??= line === undefined ? `the wrapper exited ${code ?? signal} before it wrote its pid; see ${log}` : `systemd-run: ${line}`;
		closed.resolve();
	});
	const pid = join(home, "jobs", id, "pid");
	for (const deadline = Date.now() + START_MS; !existsSync(pid); await sleep(20)) {
		if (exited !== undefined) return end(home, job, exited, bus);
		if (Date.now() < deadline || child.pid === undefined) continue;
		try {
			process.kill(-child.pid, "SIGKILL");
		} catch {
			// Gone already.
		}
		await closed.promise;
		return end(home, job, `the wrapper wrote no pid within ${START_MS / 1000} s and was killed`, bus);
	}
	child.stderr?.destroy();
	child.unref();
	return undefined;
}

// Ends the job as its wrapper would have, every file of the end written whole and `state` last, then `job-ended`; the
// worktree and branch stay for inspection.
function end(home: string, job: Pick<Job, "id" | "kind" | "project">, why: string, bus: Bus): string {
	const folder = join(home, "jobs", job.id);
	const reason = `failed: ${why}`;
	appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] ended: ${reason}\n`);
	const files = { result: "", cost: "0.0000", "tool-calls": "0", activity: "", commits: "" };
	for (const [name, text] of Object.entries(files)) write(folder, name, text);
	rmSync(join(folder, "mcp"), { recursive: true, force: true });
	moveJob(home, job.id, bus, () => ["ended", reason]);
	bus.emit("core", "job-ended", { id: job.id, kind: job.kind, project: job.project, state: "ended", reason });
	return why;
}

// Gives a slice its limits, `cpu` cores (at least 1% of one), `memory`, empty for none, and `more` properties (a ticket's slice:
// no swap beyond its memory cap, so the cap holds); returns why it could not, e.g. `systemctl` missing or no user manager.
function setSlice(slice: string, cpu: string, memory: string, ...more: string[]): string | undefined {
	const limits = [`CPUQuota=${cpu === "" ? "" : `${Math.max(1, Math.round(Number(cpu) * 100))}%`}`, `MemoryMax=${memory || "infinity"}`, ...more];
	const set = spawnSync("systemctl", ["--user", "set-property", "--runtime", `${slice}.slice`, ...limits], { encoding: "utf8" });
	if (set.error !== undefined) return set.error.message;
	return set.status === 0 ? undefined : set.stderr.trim() || `systemctl exited ${set.status ?? set.signal}`;
}

// The scope's own `-p` properties from the job's caps, read from its record (empty for none): its cores, at most this machine's;
// its memory, with no swap beyond it, so the cap holds; and from systemd 253 on, which takes `OOMPolicy` on a scope and else
// stops the whole scope at a kill, a process the kernel kills over the cap, or over its ticket's `ticketMemory`, ends only
// itself, so the wrapper lives to end the job.
function ownLimits(cpu: string, memory: string, ticketMemory: string): string[] {
	const limits = cpu === "" ? [] : [`CPUQuota=${Math.max(1, Math.round(Math.min(Number(cpu), availableParallelism()) * 100))}%`];
	if (memory !== "") limits.push(`MemoryMax=${memory}`, "MemorySwapMax=0");
	if (memory !== "" || ticketMemory !== "") {
		const systemd = Number(/^systemd (\d+)/.exec(spawnSync("systemctl", ["--version"], { encoding: "utf8" }).stdout ?? "")?.[1] ?? 0);
		if (systemd >= 253) limits.push("OOMPolicy=continue");
	}
	return limits.flatMap((limit) => ["-p", limit]);
}

// Tells once per machine, in a `notice`, that a job with caps, its own or its ticket's, runs bare there (`<home>/uncapped` lists
// the machines told).
export function sayUncapped(home: string, machine: string, why: string, bus: Bus): void {
	const told = join(home, "uncapped");
	if (existsSync(told) && readFileSync(told, "utf8").split("\n").includes(machine)) return;
	appendFileSync(told, `${machine}\n`);
	bus.emit("core", "notice", { text: `machine ${machine} runs jobs without a systemd scope (${why}): a job's memory cap there is held by sampling its processes every 10 s, its CPU is not capped, and a ticket's CPU and memory caps, shared by all its jobs, are not held` });
}

// How `arthur remote-job launch` and `continue` print, for this side to tell, why a job with caps runs bare there.
export const UNCAPPED = "uncapped: ";

// The cgroup v2 folder of job `id`'s scope when this process runs in it; undefined outside it (the job runs bare, or started
// by hand) and on a host whose cgroup v2 tree is not at /sys/fs/cgroup (systemd's hybrid mode of older distributions).
export function ownScope(id: string): string | undefined {
	const self = "/proc/self/cgroup";
	const cgroup = /^0::(.*)$/m.exec(existsSync(self) ? readFileSync(self, "utf8") : "")?.[1];
	const folder = join("/sys/fs/cgroup", cgroup ?? "");
	return cgroup?.endsWith(`/${scope(id)}`) && existsSync(join(folder, "cgroup.procs")) ? folder : undefined;
}

// Called by job `id`'s wrapper at the job's end: SIGKILL to every other process in its scope, a daemon that left the job's
// process group included, until none is left. A process it may not kill (under `sudo`) or one stuck in the kernel stays; it
// stops trying after a second. A wrapper outside its scope (`ownScope`) kills nothing.
export function endScope(id: string): void {
	const folder = ownScope(id);
	if (folder === undefined) return;
	const procs = join(folder, "cgroup.procs");
	const pause = new Int32Array(new SharedArrayBuffer(4));
	for (let round = 0; round < 100; round++) {
		const left = readFileSync(procs, "utf8").split("\n").filter((pid) => pid !== "" && Number(pid) !== process.pid);
		if (left.length === 0) return;
		for (const pid of left) {
			try {
				process.kill(Number(pid), "SIGKILL");
			} catch {
				// Gone already, or not ours to kill.
			}
		}
		Atomics.wait(pause, 0, 0, 10);
	}
}
