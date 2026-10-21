import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, Plugin } from "@arthur/core/plugin";
import { autopilot } from "./autopilot.ts";
import { blockedNotice } from "./blocked-notice.ts";
import { boardCommands } from "./board-commands.ts";
import { coordinatorContext } from "./context.ts";
import { extensions, FRESH, pane, STOPPED, supervise, tmux } from "./coordinator.ts";
import { inbox } from "./inbox.ts";
import { type McpOptions, mcpServers } from "./mcp.ts";
import { checkOptions, type Coordinator, coordinatorOptions } from "./orchestration-options.ts";
import { plans } from "./plans.ts";
import { silentMode } from "./silent.ts";
import { spawnRules } from "./spawn-rules.ts";

// The orchestration plugin (spec/roadmap.md, entry 23), required by the host: the coordinator's process, kept running by
// `arthur run`; its inbox (entry 24, inbox.ts); its role and its context on every turn (entry 25, context.ts); `arthur attach`
// and `arthur coordinator stop|context`, docs/commands/coordinator.md and attach.md; the board's phone commands `/board`, `/task`
// and `/plan` (board-commands.ts); `maxAgents` and each role's model (entry 26, spawn-rules.ts); the notice of a job
// blocked on the owner (entry 27, blocked-notice.ts); the planning of large tickets (entry 28, plans.ts); autopilot (entry 29,
// autopilot.ts); the silent mode (entry 47, silent.ts); and tmux as its `arthur doctor` requirement (entry 80).

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
	// MCP servers by name, and which go to every role and which to a given role (mcp.ts).
	readonly mcp?: McpOptions;
	readonly plan?: { readonly budgetUsd?: number };
	readonly autopilot?: { readonly budgetUsd?: number; readonly budgetMaxUsd?: number };
	readonly morningReport?: { readonly at?: string };
};

export function orchestration(options: OrchestrationOptions = {}): Plugin {
	let place: { readonly coordinator: Coordinator; readonly folder: string; readonly agent: string; readonly host: Host } | undefined;
	let supervisor: { stop(): Promise<void> } | undefined;
	let messages: ReturnType<typeof inbox> | undefined;
	return {
		name: "orchestration",
		module: import.meta.url,
		options,
		// Set up after schedule when it is loaded, so the morning report (entry 65) can register with it; schedule stays optional.
		after: ["schedule"],
		check: checkOptions,
		// One requirement of `arthur doctor` (entry 80), checked also while the load refuses: there is no coordinator without tmux.
		doctor: () => [
			{
				name: "tmux",
				check: () => {
					const shown = spawnSync("tmux", ["-V"], { encoding: "utf8", timeout: 10_000 });
					if (shown.status === 0) return "ok";
					const code = (shown.error as NodeJS.ErrnoException | undefined)?.code;
					return `missing: ${code === "ENOENT" ? "tmux not found on PATH" : `tmux -V: ${shown.error?.message ?? (shown.stderr.trim() || `exit code ${shown.status}`)}`}`;
				},
				costs: "no coordinator",
				fix: "sudo apt-get install -y tmux (docs/setup.md, step 2)",
				critical: true,
			},
		],
		setup(host) {
			const coordinator = coordinatorOptions(host.options);
			const { folder, agent } = host;
			place = { coordinator, folder, agent, host };
			messages = inbox(host);
			blockedNotice(host);
			spawnRules(host, coordinator);
			plans(host);
			autopilot(host);
			silentMode(host);
			// Read like every role, with the project's override and criteria; no kind spawns it, `arthur run` starts it.
			host.jobs.registerRole({ name: "coordinator", file: new URL("../roles/coordinator.md", import.meta.url), criteria: ["styleguide", "autopilot"] });
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
			// For another plugin (session's /restart and fresh start): ends the coordinator's session, which `arthur run` starts
			// again; a fresh one, without `--continue`, after the mark. Running jobs are the caller's to check.
			host.provide("coordinator.restart", (asked: { readonly fresh?: unknown } = {}) => {
				if (typeof asked.fresh !== "boolean") throw new Error(`coordinator.restart: expected { fresh: true | false }, got ${JSON.stringify(asked)}`);
				if (asked.fresh) writeFileSync(join(folder, FRESH), "");
				tmux(coordinator, ["kill-session", "-t", `=${coordinator.session}`]);
			});
			for (const command of boardCommands(host)) host.commands.register(command);
		},
		start() {
			messages?.start();
			if (place !== undefined) supervisor = supervise(place.coordinator, place.folder, place.agent, extensions(place.host.collectEach("coordinator.extension")), mcpServers(place.host.options, place.host.env, "coordinator"));
		},
		async stop() {
			await supervisor?.stop();
			messages?.stop();
		},
	};
}
