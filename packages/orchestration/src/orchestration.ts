import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "@arthur/core/plugin";
import { blockedNotice } from "./blocked-notice.ts";
import { boardCommands } from "./board-commands.ts";
import { coordinatorContext } from "./context.ts";
import { pane, STOPPED, supervise, tmux } from "./coordinator.ts";
import { inbox } from "./inbox.ts";
import { checkOptions, type Coordinator, coordinatorOptions } from "./orchestration-options.ts";
import { spawnRules } from "./spawn-rules.ts";

// The orchestration plugin (spec/roadmap.md, entry 23), required by the host: the coordinator's process, kept running by
// `arthur run`; its inbox (entry 24, inbox.ts); its role and its context on every turn (entry 25, context.ts); `arthur attach`
// and `arthur coordinator stop|context`, docs/commands/coordinator.md and attach.md; the board's phone commands `/board`, `/task`
// and `/findings` (board-commands.ts); `maxAgents` and each role's model (entry 26, spawn-rules.ts); and the notice of a job
// blocked on the owner (entry 27, blocked-notice.ts).

export type OrchestrationOptions = {
	readonly enabled?: boolean;
	readonly maxAgents?: number;
	readonly coordinator?: {
		readonly model?: string;
		readonly thinking?: string;
		readonly tmux?: { readonly session?: string; readonly socket?: string };
		readonly exitWaitSeconds?: number;
		readonly restartDelaySeconds?: number;
	};
	// A role's `model` and `thinking`; `quick` takes only a `model`, omp's quick model (`--smol`) for every job and the coordinator.
	readonly roles?: Readonly<Record<string, { readonly model?: string | readonly string[]; readonly thinking?: string }>>;
	readonly plan?: { readonly budgetUsd?: number };
	readonly autopilot?: { readonly budgetUsd?: number; readonly budgetMaxUsd?: number };
	readonly morningReport?: { readonly at?: string };
};

export function orchestration(options: OrchestrationOptions = {}): Plugin {
	let place: { readonly coordinator: Coordinator; readonly folder: string; readonly agent: string } | undefined;
	let supervisor: { stop(): Promise<void> } | undefined;
	let messages: ReturnType<typeof inbox> | undefined;
	return {
		name: "orchestration",
		options,
		check: checkOptions,
		setup(host) {
			const coordinator = coordinatorOptions(host.options);
			const { folder, agent } = host;
			place = { coordinator, folder, agent };
			messages = inbox(host);
			blockedNotice(host);
			spawnRules(host, coordinator);
			// Read like every role, with the project's override and criteria; no kind spawns it, `arthur run` starts it.
			host.jobs.registerRole({ name: "coordinator", file: new URL("../roles/coordinator.md", import.meta.url), criteria: ["styleguide"] });
			const where = `tmux session ${coordinator.session} (socket ${coordinator.socket})`;
			host.commands.register({
				name: "attach",
				doc: new URL("../docs/commands/attach.md", import.meta.url),
				run({ args }) {
					if (args.length > 0) {
						console.error("usage: arthur attach");
						return 2;
					}
					if (pane(coordinator) === "none") {
						const why = existsSync(join(folder, STOPPED)) ? "arthur coordinator stop stopped it until arthur run starts again" : "arthur run starts it";
						console.error(`arthur attach: no coordinator: ${where} is not running; ${why}`);
						return 1;
					}
					return tmux(coordinator, ["attach-session", "-t", `=${coordinator.session}`], true).status ?? 1;
				},
			});
			host.commands.register({
				name: "coordinator",
				doc: new URL("../docs/commands/coordinator.md", import.meta.url),
				run({ args }) {
					if (args.length !== 1 || (args[0] !== "stop" && args[0] !== "context")) {
						console.error("usage: arthur coordinator stop|context");
						return 2;
					}
					if (args[0] === "context") {
						console.log(coordinatorContext(host));
						return 0;
					}
					const running = host.jobs.running();
					if (running.length > 0) {
						const jobs = `${running.length} job${running.length === 1 ? "" : "s"} running: ${running.join(", ")}`;
						console.error(`arthur coordinator stop: refused: ${jobs}; the coordinator is who hears their end; stop them first (arthur stop <id>, or arthur stopall)`);
						return 1;
					}
					// The mark first, so `arthur run` does not start it again once its session is gone.
					writeFileSync(join(folder, STOPPED), "");
					const ended = tmux(coordinator, ["kill-session", "-t", `=${coordinator.session}`]).status === 0;
					console.log(`arthur coordinator stop: ${ended ? `${where} ended` : `${where} was not running`}; it stays stopped until arthur run starts again`);
				},
			});
			for (const command of boardCommands(host)) host.commands.register(command);
		},
		start() {
			messages?.start();
			if (place !== undefined) supervisor = supervise(place.coordinator, place.folder, place.agent);
		},
		async stop() {
			await supervisor?.stop();
			messages?.stop();
		},
	};
}
