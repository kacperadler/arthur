import { setTimeout as sleep } from "node:timers/promises";
import { endScope } from "./job-scope.ts";
import { descendants, processTable } from "./process-table.ts";

// The one stop of a job (spec/roadmap.md, entry 14), which the wrapper runs for `arthur stop` and at a limit (entry 12):
// SIGTERM to the agent's process group, the agent and every process it started in it; SIGKILL to the group when any of
// them is still alive after the grace; then SIGKILL to each process below the agent that had left its group (a daemon
// that called `setsid`), as seen before each signal, since one whose parent dies is no longer found below it; then every
// other process left in the job's scope (entry 13), which also takes one that left before it could be seen.

export const GRACE_SECONDS = 5;

// `group` is the agent's pid, which leads its group; `note` writes a line of the job's log.
export async function stopGroup(group: number, id: string, note: (line: string) => void): Promise<void> {
	const strays = new Map<number, string>();
	const look = () => {
		for (const entry of descendants(processTable(), group)) if (entry.pgid !== group) strays.set(entry.pid, entry.args);
	};
	look();
	if (signal(-group, "SIGTERM") && !(await gone(group))) {
		look();
		note(`the agent's process group is still alive ${GRACE_SECONDS} seconds after SIGTERM: SIGKILL`);
		signal(-group, "SIGKILL");
	}
	for (const [pid, args] of strays) if (signal(pid, "SIGKILL")) note(`SIGKILL to ${pid}, which had left the agent's process group: ${args.slice(0, 100)}`);
	endScope(id);
}

// False when nothing was left to signal, or it is not ours to; signal 0 only asks whether any is left.
export function signal(target: number, name: NodeJS.Signals | 0): boolean {
	try {
		process.kill(target, name);
		return true;
	} catch {
		return false;
	}
}

// Whether every process of the group ended within the grace.
async function gone(group: number): Promise<boolean> {
	for (const end = Date.now() + GRACE_SECONDS * 1000; Date.now() < end; await sleep(20)) if (!signal(-group, 0)) return true;
	return !signal(-group, 0);
}
