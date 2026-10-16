import type { Board } from "./board.ts";
import type { Bus } from "./events.ts";

// The ticket a task's `Ticket:` path lies in: `spec/features/<id>-<slug>/...`.
export const FEATURE = /(?:^|\/)spec\/features\/([A-Z]+\d{4,})-[^/]*\//;

// The board follows the jobs (spec/roadmap.md, entry 18): a worker's `job-started` moves each ticket its task names to
// in-progress; other kinds move none. The moves the board refuses fail the handler together, which the bus logs as the
// core's. Subscribed by the real load and by the test kit's fake host alike.
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
