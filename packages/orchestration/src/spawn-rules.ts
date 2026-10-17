import type { Host } from "@arthur/core/plugin";
import { MAX_AGENTS, QUICK, roleOptions, THINKING } from "./orchestration-options.ts";

// What the orchestration plugin decides for every spawn and continue of every project (spec/roadmap.md, entry 26): each
// role's model, thinking level and the quick model from `roles`, answered to the core as `roles.model` (a spawn's own
// `--model` and `--thinking` win); and, through `beforeSpawn`, a thinking level omp does not know and a spawn while
// `maxAgents` jobs are in a run are refused, before any record exists.

export function spawnRules(host: Host): void {
	const max = (host.options.maxAgents as number | undefined) ?? MAX_AGENTS;
	const quick = roleOptions(host.options, QUICK).model as string | undefined;
	host.provide("roles.model", (role: string) => {
		const { model, thinking } = role === QUICK ? {} : roleOptions(host.options, role);
		// A list is the models plugin's (entry 82), which picks the first available one.
		if (Array.isArray(model)) throw new Error(`roles.${role}.model: a model list needs the models plugin`);
		return { model, thinking, quick };
	});
	host.jobs.beforeSpawn(({ thinking }) => {
		if (thinking !== undefined && !THINKING.includes(thinking)) return `thinking level ${JSON.stringify(thinking)} is not one of ${THINKING.join(", ")}`;
		const running = host.jobs.running();
		if (running.length < max) return undefined;
		return `maxAgents is ${max} and ${running.length} job${running.length === 1 ? " is" : "s are"} in a run: ${running.join(", ")}; spawn again once one ends`;
	});
}
