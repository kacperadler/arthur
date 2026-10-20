import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Spawn, SpawnCheck } from "./jobs.ts";
import { queueLock } from "./lock.ts";
import { pluginStep } from "./plugin-host.ts";

// The `beforeSpawn` checks of one load (spec/roadmap.md, entries 9 and 26), in the order the plugins registered them.

export function spawnChecks(home: string) {
	const checks: { readonly owner: string; readonly check: SpawnCheck }[] = [];
	return {
		add: (owner: string, check: SpawnCheck) => void checks.push({ owner, check }),
		// The checks run under `<home>/spawn.lock`, taken in turn by every spawn and continue of every process; a refusal
		// releases it, a pass resolves to its release, which the caller calls once the job counts as running (its record, or
		// its `working` state again). So a check that counts running jobs (orchestration's `maxAgents`) counts every job that
		// passed before it, even one whose worktree is still being made.
		async pass(spawn: Spawn): Promise<() => void> {
			mkdirSync(home, { recursive: true });
			const release = await queueLock(join(home, "spawn.lock"));
			try {
				for (const { owner, check } of checks) {
					const reason = await pluginStep(owner, "beforeSpawn", () => check(spawn));
					if (reason !== undefined) throw new Error(`refused by ${owner}: ${reason}`);
				}
			} catch (error) {
				release();
				throw error;
			}
			return release;
		},
	};
}
