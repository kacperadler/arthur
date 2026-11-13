import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Host, Plugin } from "@arthur/core/plugin";
import { actor } from "./actor.ts";
import { autopilot } from "./autopilot.ts";
import { blockedNotice } from "./blocked-notice.ts";
import { boardCommands } from "./board-commands.ts";
import { coordinatorContext } from "./context.ts";
import { extensions, FRESH, supervise, tmux } from "./coordinator.ts";
import { coordinatorCommands } from "./coordinator-commands.ts";
import { decisionCommands } from "./decision-commands.ts";
import { decisionHooks } from "./decision-hooks.ts";
import { decisionUse } from "./decision-use.ts";
import { inbox } from "./inbox.ts";
import { type McpOptions, mcpServers } from "./mcp.ts";
import { checkOptions, coordinatorOptions } from "./orchestration-options.ts";
import { paperCheck } from "./paper-check.ts";
import { plans } from "./plans.ts";
import { type Chat, chatProblem, oneAtATime, type Session, sessionList } from "./sessions.ts";
import { silentMode } from "./silent.ts";
import { spawnRules } from "./spawn-rules.ts";

// The orchestration plugin (spec/roadmap.md, entry 23), required by the host: the coordinator's process, kept running by
// `arthur run`; its inbox (entry 24, inbox.ts); its role and its context on every turn (entry 25, context.ts); `arthur attach`
// and `arthur coordinator stop|context` (coordinator-commands.ts); the board's phone commands `/board`, `/task`
// and `/plan` (board-commands.ts); `maxAgents` and each role's model (entry 26, spawn-rules.ts); the notice of a job
// blocked on the owner (entry 27, blocked-notice.ts); the planning of large tickets (entry 28, plans.ts); autopilot (entry 29,
// autopilot.ts); the silent mode (entry 47, silent.ts); tmux as its `arthur doctor` requirement (entry 80); the morning
// report (entry 65): with `morningReport.at`, an action schedule sends the coordinator with roles/coordinator/morning-report.md;
// and the decision log (entry 96, decision-log.ts), `arthur decision` and `arthur decisions`, with what only the owner's decision lets through (decision-use.ts); the merge's check of a worker's branch (paper-check.ts); `actor`, who acts in a session (entry 99, actor.ts);
// and a project agent per project whose file holds `orchestration.project({ chat })`, its `arthur doctor` line that its chat's plugin sends (entry 85, sessions.ts).

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
	let place: { readonly sessions: readonly Session[]; readonly agent: string; readonly host: Host } | undefined;
	let supervisors: { stop(): Promise<void> }[] = [];
	let messages: ReturnType<typeof inbox> | undefined;
	let unsent: (() => void) | undefined;
	return {
		name: "orchestration",
		module: import.meta.url,
		options,
		// Set up after schedule when it is loaded, so the morning report (entry 65) can register with it, and after projects, whose
		// list holds the pieces; both stay optional.
		after: ["schedule", "projects"],
		check: checkOptions,
		piece: chatProblem,
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
			const sessions = sessionList(host, coordinator);
			place = { sessions, agent, host };
			messages = inbox(host);
			unsent = blockedNotice(host);
			spawnRules(host, coordinator, sessions);
			plans(host);
			autopilot(host);
			silentMode(host);
			decisionHooks(host);
			decisionUse(host);
			paperCheck(host);
			host.provide("actor", actor(sessions));
			const at = (host.options as OrchestrationOptions).morningReport?.at;
			const report = { id: "report", at, option: "morningReport.at", action: { message: "Write the morning report.", procedure: fileURLToPath(new URL("../roles/coordinator/morning-report.md", import.meta.url)) } };
			if (at !== undefined && host.collect("schedule.register", host.name, [report], host.package).length === 0)
				throw new Error("morningReport.at needs the schedule plugin, which sends the morning report; add schedule() to the config's plugins, or leave morningReport out");
			// Read like every role, its tone file too since it talks with the owner; no kind spawns it, `arthur run` starts it.
			host.jobs.registerRole({ name: "coordinator", file: new URL("../roles/coordinator.md", import.meta.url), criteria: ["styleguide", "autopilot", "report"], personality: true });
			host.jobs.registerRole({ name: "project", file: new URL("../roles/project.md", import.meta.url), criteria: ["styleguide", "autopilot", "report"], personality: true });
			const chats = sessions.flatMap(({ project, chat }) => (project === undefined || chat === undefined ? [] : [{ project, ...chat }]));
			// For a channel's `arthur doctor` lines (telegram's topics): every project's chat, `{ project, plugin, instance?, place }`.
			host.provide("orchestration.chats", () => chats);
			// A chat its plugin cannot send to would leave its agent mute; `channel.send` with no file is refused before anything is sent.
			const senders = () => host.collectEach("channel.send", { files: [] }).map((answer) => answer.plugin);
			if (chats.length > 0)
				host.provide("doctor", () =>
					chats.map(({ project, plugin }) => ({
						name: `chat of ${project}`,
						check: () => (senders().includes(plugin) ? "ok" : `missing: ${plugin} provides no channel.send; plugins that do: ${senders().join(", ") || "none"}`),
						costs: `no agent of project ${project}, nor arthur run`,
						fix: `enable the ${plugin} plugin in arthur.config.ts, or name a channel plugin in the chat of ${project}'s orchestration.project(...)`,
						critical: true,
					})),
				);
			for (const command of coordinatorCommands(host, sessions)) host.commands.register(command);
			// For another plugin (session's /restart and fresh start): ends the coordinator's session, which `arthur run` starts
			// again; a fresh one, without `--continue`, after the mark. Running jobs are the caller's to check.
			host.provide("coordinator.restart", (asked: { readonly fresh?: unknown } = {}) => {
				if (typeof asked.fresh !== "boolean") throw new Error(`coordinator.restart: expected { fresh: true | false }, got ${JSON.stringify(asked)}`);
				if (asked.fresh) writeFileSync(join(folder, FRESH), "");
				tmux(coordinator, ["kill-session", "-t", `=${coordinator.session}`]);
			});
			// For develop's `arthur eval`: the context in a copy of the main project's repository, at an instant, with a scenario's plugin lines (context.ts).
			host.provide("coordinator.checkoutContext", (asked: { readonly root?: unknown; readonly at?: unknown; readonly context?: unknown } = {}) => {
				const { root, at, context } = asked, lines = typeof context === "object" && context !== null && !Array.isArray(context) && Object.values(context).every((text) => typeof text === "string");
				if (typeof root !== "string" || !(at instanceof Date) || !lines) throw new Error(`coordinator.checkoutContext: expected { root: a folder, at: a Date, context: { <plugin>: <text> } }, got ${JSON.stringify(asked)}`);
				return coordinatorContext(host, { root, at, context: context as Record<string, string> });
			});
			for (const command of [...boardCommands(host), ...decisionCommands(host)]) host.commands.register(command);
		},
		start() {
			unsent?.();
			messages?.start();
			if (place === undefined) return;
			const { sessions, agent, host } = place;
			const turns = oneAtATime();
			supervisors = sessions.map(({ name, project, folder, coordinator }) => {
				const added = extensions(host.collectEach("coordinator.extension", { session: name }));
				return supervise(coordinator, folder, agent, added, mcpServers(host.options, host.env, project === undefined ? "coordinator" : "project"), { project, turns });
			});
		},
		async stop() {
			await Promise.all(supervisors.map((each) => each.stop()));
			messages?.stop();
		},
	};
}

// A project file's piece: `orchestration.project({ chat: { plugin: "telegram", place: "42" } })`, its own agent in that chat.
orchestration.project = (piece: { readonly chat: Chat }) => ({ orchestration: piece });
