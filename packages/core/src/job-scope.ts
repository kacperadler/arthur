import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Bus } from "./events.ts";
import type { Job } from "./jobs.ts";

// A job's scope (spec/roadmap.md, entry 13): `launch` starts the job's wrapper, and with it everything the job runs, in a
// systemd scope of its own, `arthur-job-<id>.scope`, inside one slice whose `CPUQuota` and `MemoryMax` are the core's
// `jobs.cpu` and `jobs.memory`: all jobs together stay within them, so they cannot starve the coordinator. At the job's end
// the wrapper kills whatever is left in its scope (`endScope`). Where `systemctl --user` cannot set the slice (no user
// manager: macOS, a container) the job runs bare, said in one line of its log. A wrapper that does not start ends its job
// `failed` here, so no record stays without a final `state`.

// The slice of Arthur's jobs, without `.slice`; a test names its own.
export const SLICE = "arthur-jobs";

// The joint slice: its name, the cores (`cpu`) and the systemd `MemoryMax` (`memory`) all jobs in it share.
export type Slice = { readonly slice: string; readonly cpu: number; readonly memory: string };

// How long `launch` waits for the wrapper's `pid`.
const START_MS = 10_000;

const scope = (id: string) => `arthur-job-${id}.scope`;

// Starts the wrapper of `job` in a process group of its own and waits until it wrote its `pid`; `agent` is
// `core.agent.command`. A wrapper that did not start (`systemd-run` refused the scope, or is missing), exited before its
// `pid`, or wrote none within START_MS (then it is killed) ends the job `failed`: returns that reason.
export async function launch(home: string, job: Pick<Job, "id" | "kind" | "project">, agent: string, jobs: Slice, bus: Bus): Promise<string | undefined> {
	const { id } = job;
	const wrapper = [process.execPath, join(import.meta.dirname, "wrapper.ts"), home, id, agent];
	const bare = setSlice(jobs);
	if (bare !== undefined) {
		const line = `no systemd scope: ${bare}; the job runs bare, without the joint limit of core.jobs.cpu and core.jobs.memory, and what it leaves behind is not killed at its end`;
		appendFileSync(join(home, "jobs", id, "log"), `[arthur ${new Date().toISOString()}] ${line}\n`);
	}
	const log = join(home, "wrapper.log");
	// `systemd-run` execs `sh`, which execs the wrapper with its stderr on the log: what reaches the pipe is systemd-run's own.
	const scoped = ["systemd-run", "--user", "--scope", "--quiet", "--collect", `--slice=${jobs.slice}.slice`, `--unit=${scope(id)}`, "--"];
	const [command = "", ...args] = bare === undefined ? [...scoped, "/bin/sh", "-c", 'exec "$@" 2>>"$0"', log, ...wrapper] : wrapper;
	const output = openSync(log, "a");
	let child: ChildProcess;
	try {
		child = spawn(command, args, { detached: true, stdio: ["ignore", output, bare === undefined ? "pipe" : output] });
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
function end(home: string, job: Pick<Job, "id" | "kind" | "project">, reason: string, bus: Bus): string {
	const folder = join(home, "jobs", job.id);
	appendFileSync(join(folder, "log"), `[arthur ${new Date().toISOString()}] failed: ${reason}\n`);
	const files = { result: "", cost: "0.0000", "tool-calls": "0", activity: "", commits: "", state: "failed" };
	for (const [name, text] of Object.entries(files)) {
		writeFileSync(join(folder, `.${name}`), text);
		renameSync(join(folder, `.${name}`), join(folder, name));
	}
	bus.emit("core", "job-ended", { id: job.id, kind: job.kind, project: job.project, state: "failed", reason });
	return reason;
}

// Gives the slice its limits, at least 1% of a core; returns why it could not, e.g. `systemctl` missing or no user manager.
function setSlice(jobs: Slice): string | undefined {
	const limits = [`CPUQuota=${Math.max(1, Math.round(jobs.cpu * 100))}%`, `MemoryMax=${jobs.memory}`];
	const set = spawnSync("systemctl", ["--user", "set-property", "--runtime", `${jobs.slice}.slice`, ...limits], { encoding: "utf8" });
	if (set.error !== undefined) return set.error.message;
	return set.status === 0 ? undefined : set.stderr.trim() || `systemctl exited ${set.status ?? set.signal}`;
}

// Called by job `id`'s wrapper at the job's end: SIGKILL to every other process in its scope, a daemon that left the job's
// process group included, until none is left. A process it may not kill (under `sudo`) or one stuck in the kernel stays; it
// stops trying after a second. A wrapper outside the job's scope (the job runs bare, or started by hand) kills nothing, nor
// does one on a host whose cgroup v2 tree is not at /sys/fs/cgroup (systemd's hybrid mode of older distributions).
export function endScope(id: string): void {
	const self = "/proc/self/cgroup";
	const cgroup = /^0::(.*)$/m.exec(existsSync(self) ? readFileSync(self, "utf8") : "")?.[1];
	const procs = join("/sys/fs/cgroup", cgroup ?? "", "cgroup.procs");
	if (cgroup === undefined || !cgroup.endsWith(`/${scope(id)}`) || !existsSync(procs)) return;
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
