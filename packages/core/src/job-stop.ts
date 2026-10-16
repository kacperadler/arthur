import { setTimeout as sleep } from "node:timers/promises";
import { endScope } from "./job-scope.ts";
import { descendants, processTable } from "./process-table.ts";

// The one stop of a job (docs/commands/stop.md); strays are seen before each signal, as one whose parent died is lost.

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
