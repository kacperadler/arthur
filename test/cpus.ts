import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";

// How many test files `npm test` runs at once (AR0718): the CPUs this process may really use. Node's default,
// availableParallelism() - 1, ignores a cgroup's cpu.max, so a job allowed 3 CPUs on a 12-core machine ran 10 files at once.
// The tightest cpu.max of the process's cgroup v2 and each one above it, whole CPUs, at least 1; without one, every core.
export function cpus(cgroupFile = "/proc/self/cgroup", mount = "/sys/fs/cgroup", cores = availableParallelism()): number {
	const path = /^0::(\/.*)$/m.exec(read(cgroupFile))?.[1];
	if (path === undefined) return cores;
	let limit = cores;
	for (let folder = path; ; folder = dirname(folder)) {
		const max = /^(\d+) (\d+)$/.exec(read(join(mount, folder, "cpu.max")).trim());
		if (max !== null) limit = Math.min(limit, Number(max[1]) / Number(max[2]));
		if (folder === "/") return Math.max(1, Math.floor(limit));
	}
}

function read(file: string): string {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return "";
	}
}

if (import.meta.main) console.log(cpus());
