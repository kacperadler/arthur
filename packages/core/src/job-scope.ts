import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A job's scope (spec/roadmap.md, entry 13): `launch` starts the job's wrapper, and with it everything the job runs, in a
// systemd scope of its own, `arthur-job-<id>.scope`, inside one slice whose `CPUQuota` and `MemoryMax` are the core's
// `jobs.cpu` and `jobs.memory`: all jobs together stay within them, so they cannot starve the coordinator. At the job's end
// the wrapper kills whatever is left in its scope (`endScope`). Where `systemctl --user` cannot set the slice (no user
// manager: macOS, a container) the job runs bare, said in one line of its log.

// The slice of Arthur's jobs, without `.slice`; a test names its own.
export const SLICE = "arthur-jobs";

// The joint slice: its name, the cores (`cpu`) and the systemd `MemoryMax` (`memory`) all jobs in it share.
export type Slice = { readonly slice: string; readonly cpu: number; readonly memory: string };

const scope = (id: string) => `arthur-job-${id}.scope`;

// Starts the wrapper of job `id` in a process group of its own and returns at once; `agent` is `core.agent.command`.
export function launch(home: string, id: string, agent: string, jobs: Slice): void {
	const wrapper = [process.execPath, join(import.meta.dirname, "wrapper.ts"), home, id, agent];
	const bare = setSlice(jobs);
	if (bare !== undefined) {
		const line = `no systemd scope: ${bare}; the job runs bare, without the joint limit of core.jobs.cpu and core.jobs.memory, and what it leaves behind is not killed at its end`;
		appendFileSync(join(home, "jobs", id, "log"), `[arthur ${new Date().toISOString()}] ${line}\n`);
	}
	const scoped = ["systemd-run", "--user", "--scope", "--quiet", "--collect", `--slice=${jobs.slice}.slice`, `--unit=${scope(id)}`, "--"];
	const [command = "", ...args] = bare === undefined ? [...scoped, ...wrapper] : wrapper;
	const log = join(home, "wrapper.log");
	const output = openSync(log, "a");
	try {
		spawn(command, args, { detached: true, stdio: ["ignore", output, output] })
			.on("error", (error) => appendFileSync(log, `[arthur ${new Date().toISOString()}] job ${id}: the wrapper did not start: ${error.message}\n`))
			.unref();
	} finally {
		closeSync(output);
	}
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
