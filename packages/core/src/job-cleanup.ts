import type { Bus } from "./events.ts";
import type { FinishedJob } from "./job-records.ts";

// A job as a plugin's `jobs.cleanup` gets it: `machine` the one it ran on, `local` for a record that names none.
export type CleanupJob = FinishedJob & { readonly machine: string };
export type Cleanup = (job: CleanupJob) => void | string | Promise<void | string>;

// `host.jobs.cleanup` (docs/commands/prune.md): each plugin's hooks, run one at a time in setup order right before a job's
// worktree goes. A throw, a rejection or `limitMs` gives up on that hook with one notice; the prune goes on all the same.
export function jobCleanup(bus: Bus) {
	const hooks: { readonly owner: string; readonly fn: Cleanup; readonly limitMs: number }[] = [];
	return {
		add: (owner: string, fn: Cleanup, limitMs = 120_000) => void hooks.push({ owner, fn, limitMs }),
		// Each hook's text, as `<plugin>: <text>`.
		async run(job: CleanupJob): Promise<string[]> {
			const said: string[] = [];
			for (const { owner, fn, limitMs } of hooks) {
				let timer: NodeJS.Timeout | undefined;
				const late = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`no answer within ${limitMs / 1000} s`)), limitMs)));
				try {
					const text = await Promise.race([Promise.resolve().then(() => fn(job)), late]);
					if (typeof text === "string" && text.trim() !== "") said.push(`${owner}: ${text.trim()}`);
				} catch (error) {
					bus.emit("core", "notice", { text: `prune of job ${job.id} on machine ${job.machine}: ${owner}'s cleanup gave up: ${error instanceof Error ? error.message : String(error)}; the prune went on without it` });
				} finally {
					clearTimeout(timer);
				}
			}
			return said;
		},
	};
}
