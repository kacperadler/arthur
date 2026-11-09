import { closeSync, existsSync, fstatSync, openSync, readSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import { findJob } from "./job-records.ts";
import { current, inRun, told } from "./job-state.ts";

// `arthur jobs --follow <id>` (AR0670): a job's `log` from its first line, then each line as it is written, a line `state: <state>
// (<reason>)` at the start and on each change, until its run is over; read from its record alone, woken by `fs.watch`: docs/commands/jobs.md.

// The bytes of `file` from `from` on; none while it does not exist.
function tail(file: string, from: number): Buffer {
	if (!existsSync(file)) return Buffer.alloc(0);
	const fd = openSync(file, "r");
	try {
		const bytes = Buffer.alloc(Math.max(0, fstatSync(fd).size - from));
		return bytes.subarray(0, readSync(fd, bytes, 0, bytes.length, from));
	} finally {
		closeSync(fd);
	}
}

// Resolves once the run is over; rejects for an unknown id, or once the record is gone.
export async function followJob(home: string, query: string, write: (line: string) => void): Promise<void> {
	const id = findJob(home, query);
	const folder = join(home, "jobs", id);
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	let [read, rest, said, seen] = [0, Buffer.alloc(0), "", ""];
	// The state before the log: the wrapper writes its last log line before `state`, so an end read here has its lines read below.
	const step = () => {
		if (!existsSync(join(folder, "kind"))) throw new Error(`${id}: its record is gone`);
		// A move writes `reason` before `state`: a reason is told once `state` is written again, never beside the state before it.
		const moved = statSync(join(folder, "state"), { throwIfNoEntry: false });
		const now = current(home, id);
		const bytes = tail(join(folder, "log"), read);
		read += bytes.length;
		// A line break is one byte no UTF-8 character holds, so the text before the last one is whole.
		const all = Buffer.concat([rest, bytes]);
		const end = all.lastIndexOf(10) + 1;
		rest = all.subarray(end);
		for (const line of all.subarray(0, end).toString("utf8").split("\n").slice(0, -1)) write(line);
		if (`${moved?.ino} ${moved?.mtimeMs}` !== seen && told(now) !== said) write(`state: ${(said = told(now))}`);
		seen = `${moved?.ino} ${moved?.mtimeMs}`;
		return now.state !== "" && !inRun(now);
	};
	const wake = () => {
		try {
			if (step()) (watcher.close(), resolve());
		} catch (error) {
			watcher.close();
			reject(error);
		}
	};
	const watcher = watch(folder, wake);
	wake();
	return promise;
}
