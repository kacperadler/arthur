import type { Board } from "./board.ts";
import { NEXT, STATUSES } from "./board-file.ts";
import type { Bus } from "./events.ts";
import type { JobRunner } from "./jobs.ts";

// The paths a job's task names on `Ticket:`, each once, as written: maybe in backticks, punctuation that ends the sentence left out.
export const taskTickets = (task: string) => [...new Set(Array.from(task.matchAll(/\bTicket:\s*`?([^\s`]+)/g), (match) => (match[1] ?? "").replace(/[.,;:!?)]+$/, "")))];
// The ticket a task's `Ticket:` path lies in: `spec/features/<id>-<slug>/...`.
export const FEATURE = /(?:^|\/)spec\/features\/([A-Z]+\d{4,})-[^/]*\//;

// The statuses a worker may start from: in-progress itself (a continue) and each one the board lets move to it.
const STARTS = STATUSES.filter((status) => status === "in-progress" || NEXT[status].includes("in-progress"));

// The core's `beforeSpawn` (spec/roadmap.md, entry 18): refuses a worker whose task names a ticket that is not on the board or
// cannot move to in-progress, one reason per ticket; other kinds go on. Registered by the real load and by the test kit's fake
// host alike, after the plugins' own checks.
export function refuseUnstartableTickets(core: Board, jobs: JobRunner): void {
	jobs.beforeSpawn("core", ({ kind, tickets }) => {
		if (kind !== "worker") return undefined;
		const refused = tickets.flatMap((path) => {
			const id = FEATURE.exec(path)?.[1];
			const status = id === undefined ? undefined : core.get(id)?.status;
			if (id === undefined || (status !== undefined && STARTS.includes(status))) return [];
			return [status === undefined ? `${id} is not on the board` : `${id} is ${status}, which cannot move to in-progress`];
		});
		return refused.length > 0 ? `${refused.join("; ")}; a worker starts on a ticket that is ${STARTS.join(", ")}` : undefined;
	});
}

// The board follows the jobs (spec/roadmap.md, entry 18): a worker's `job-started`, at a spawn or a continue, moves each
// ticket its task names to in-progress; other kinds move none. The moves the board refuses fail the handler together, which
// the bus logs as the core's. Subscribed by the real load and by the test kit's fake host alike, after the plugins' own handlers.
export function moveStartedTickets(core: Board, bus: Bus): void {
	bus.on("core", "job-started", ({ data }) => {
		const { kind, tickets } = data as { readonly kind: string; readonly tickets: readonly string[] };
		if (kind !== "worker") return;
		const refused = tickets.flatMap((path) => {
			const id = FEATURE.exec(path)?.[1];
			try {
				if (id !== undefined) core.move(id, "in-progress");
				return [];
			} catch (error) {
				return [(error as Error).message];
			}
		});
		if (refused.length > 0) throw new Error(refused.join("; "));
	});
}
