import type { Host } from "@arthur/core/plugin";
import { mcpServers } from "./mcp.ts";
import { type Coordinator, MAX_AGENTS, QUICK, roleOptions, THINKING } from "./orchestration-options.ts";

// What the orchestration plugin decides for every spawn and continue of every project (spec/roadmap.md, entry 26): each
// role's model (one name or an ordered list, as written: the core has the models plugin pick from it at spawn, entry 82, so
// `arthur roles` probes nothing), thinking level and the quick model from `roles`, answered to the core as `roles.model` (a
// spawn's own `--model` and `--thinking` win), and every role's model as a list, `models.lists`, which the models plugin's
// doctor lines read; and, through `beforeSpawn`, a thinking level omp does not know and a spawn while `maxAgents` jobs are in
// a run are refused, before any record exists. The coordinator's own model and thinking are its `coordinator` options,
// answered for the role `coordinator`, which `arthur roles` shows. A job's role's MCP servers (mcp.ts) go with its answer as
// `mcp`, none for the coordinator's, which `supervise` hands its agent itself.

export function spawnRules(host: Host, coordinator: Coordinator): void {
	const max = (host.options.maxAgents as number | undefined) ?? MAX_AGENTS;
	const quick = roleOptions(host.options, QUICK).model as string | undefined;
	host.provide("roles.model", (role: string) => {
		const { model, thinking } = role === QUICK ? {} : role === "coordinator" ? coordinator : roleOptions(host.options, role);
		const mcp = role === QUICK || role === "coordinator" ? undefined : mcpServers(host.options, host.env, role);
		return { model, thinking, quick, ...(mcp && { mcp }) };
	});
	host.provide("models.lists", () =>
		Object.keys(host.options.roles ?? {}).flatMap((role) => {
			const { model } = role === QUICK ? {} : roleOptions(host.options, role);
			return model === undefined ? [] : [[model].flat()];
		}),
	);
	host.jobs.beforeSpawn(({ thinking }) => {
		if (thinking !== undefined && !THINKING.includes(thinking)) return `thinking level ${JSON.stringify(thinking)} is not one of ${THINKING.join(", ")}`;
		const running = host.jobs.running();
		if (running.length < max) return undefined;
		return `maxAgents is ${max} and ${running.length} job${running.length === 1 ? " is" : "s are"} in a run: ${running.join(", ")}; spawn again once one ends`;
	});
}
