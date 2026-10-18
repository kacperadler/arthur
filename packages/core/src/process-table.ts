import { execFileSync } from "node:child_process";

// The process table as `ps` prints it, the same on Linux and macOS: each process's id, parent, process group, resident memory
// in KiB and command line. Used by a job's stop (job-stop.ts) to find the processes that left the agent's group, by `arthur
// stop` and `arthur continue` (job-control.ts) to tell a job's live wrapper from a process that took its pid after it ended,
// and by a job's memory cap without a scope (job-memory.ts).

export type Process = { readonly pid: number; readonly ppid: number; readonly pgid: number; readonly rss: number; readonly args: string };

export function processTable(): Process[] {
	const out = execFileSync("ps", ["-A", "-o", "pid=,ppid=,pgid=,rss=,args="], { encoding: "utf8", maxBuffer: 1 << 26 });
	return out.split("\n").flatMap((line) => {
		const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s?(.*)$/.exec(line);
		return match === null ? [] : [{ pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), rss: Number(match[4]), args: match[5] ?? "" }];
	});
}

// Every process below `pid`, its children and theirs, as the table has them now.
export function descendants(table: readonly Process[], pid: number): Process[] {
	const found: Process[] = [];
	for (let parents = new Set([pid]); parents.size > 0; ) {
		const children = table.filter((entry) => parents.has(entry.ppid));
		found.push(...children);
		parents = new Set(children.map((entry) => entry.pid));
	}
	return found;
}
