import type { Host } from "@arthur/core/plugin";
import { capsOf, type FeatureCaps, hours, KEYS, reachedCap, spentOn, ticketOf, usd } from "./feature-caps.ts";

// Caps per feature at work (spec/roadmap.md, entry 33): a spawn for a ticket at a money or time cap refused, the ticket's
// slice in each of its jobs' caps, the sweep that stops the jobs taking their ticket past a cap, and `arthur resources <ticket>`.

// How `host.jobs.block` writes the reason of a job the sweep stopped.
const STOPPED = "user: feature cap ";

export type FeatureSlice = { readonly feature?: { readonly name: string; readonly cpu?: number; readonly memory?: string } };

export function featureGuard(host: Host, perFeature: FeatureCaps) {
	const jobsOf = (id: string, jobs = host.jobs.list()) => jobs.filter((job) => ticketOf(job.tickets) === id);
	return {
		// `beforeSpawn`, also of `arthur continue`: refuses a spawn whose ticket is at its money or time cap.
		check({ tickets }: { readonly tickets: readonly string[] }): string | undefined {
			const id = ticketOf(tickets);
			const reached = id === undefined ? undefined : reachedCap(capsOf(host, perFeature, id).caps, spentOn(jobsOf(id)));
			return reached && `${id}: ${reached.text}; raise "caps" in its ticket's JSON block, or perFeature.${reached.cap}`;
		},
		// The part of `jobs.limits` that puts a job in its ticket's slice, when the ticket has a CPU or memory cap.
		slice({ tickets }: { readonly tickets: readonly string[] }): FeatureSlice {
			const id = ticketOf(tickets);
			const { cpu, memory } = id === undefined ? {} : capsOf(host, perFeature, id).caps;
			if (id === undefined || (cpu === undefined && memory === undefined)) return {};
			return { feature: { name: id, ...(cpu === undefined ? {} : { cpu }), ...(memory === undefined ? {} : { memory: String(memory) }) } };
		},
		// Each ticket with jobs in a run that reached a money or time cap: those jobs are stopped and held `blocked` on the user,
		// and `cap-reached` is emitted once; a job it stopped already is not stopped again. Resolves once the stops are over.
		async sweep(): Promise<void> {
			const [jobs, running] = [host.jobs.list(), new Set(host.jobs.running())];
			const going = new Map<string, typeof jobs>();
			for (const job of jobs) {
				const id = ticketOf(job.tickets);
				if (id !== undefined && running.has(job.id) && !job.reason.startsWith(STOPPED)) going.set(id, [...(going.get(id) ?? []), job]);
			}
			const stops: Promise<unknown>[] = [];
			for (const [id, mine] of going) {
				const reached = reachedCap(capsOf(host, perFeature, id).caps, spentOn(jobsOf(id, jobs)));
				if (reached === undefined) continue;
				stops.push(...mine.map((job) => Promise.try(() => host.jobs.block(job.id, reached.text, true))));
				const { cap, spent, limit, text } = reached;
				host.events.emit("cap-reached", { ticket: id, project: mine[0]?.project, cap, spent, limit, reason: `user: ${text}`, jobs: mine.map((job) => job.id) });
			}
			await Promise.all(stops);
		},
		// What `arthur resources <ticket>` prints: the ticket's jobs, then each cap with what they spent against it and where the
		// cap comes from. Refused for a ticket on no board that has no jobs.
		report(id: string): string {
			const mine = jobsOf(id);
			if (mine.length === 0 && (host.collect("projects").length === 0 || host.board.get(id) === undefined)) throw new Error(`${id}: no such ticket on the board, and no jobs`);
			const running = new Set(host.jobs.running());
			const { caps, from } = capsOf(host, perFeature, id);
			const spent = spentOn(mine);
			const cap = (key: (typeof KEYS)[number], shown: string | undefined) => (shown === undefined ? "no cap" : `${shown} (${from[key]})`);
			return [
				`${id}: ${mine.length} jobs, ${mine.filter((job) => running.has(job.id)).length} in a run`,
				`budgetUsd: ${usd(spent.usd)} of ${cap("budgetUsd", caps.budgetUsd === undefined ? undefined : `$${caps.budgetUsd}`)}`,
				`hours: ${hours(spent.seconds)} of ${cap("hours", caps.hours === undefined ? undefined : `${caps.hours} h`)}`,
				`cpu: ${cap("cpu", caps.cpu === undefined ? undefined : `${caps.cpu} cores for all its jobs`)}`,
				`memory: ${cap("memory", caps.memory === undefined ? undefined : `${caps.memory} for all its jobs`)}`,
			].join("\n");
		},
	};
}
