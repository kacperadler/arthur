import type { Plugin } from "@arthur/core/plugin";
import { checkOptions, type EvalOptions } from "./develop-options.ts";
import { evalCommand } from "./eval-command.ts";
import { pluginCommand, pluginNewContext, pluginNewSection } from "./plugin-new.ts";

// The develop plugin (spec/roadmap.md, entries 66 and 67): developing Arthur itself. `arthur plugin new` makes a new plugin
// package in Arthur's repository that passes the checks as created (plugin-new.ts); `arthur eval` replays coordinator turns
// against scenarios (eval-command.ts). The planner and the worker are told how a job runs the first, and the coordinator that
// such a ticket names the local machine (plugin-new.ts). docs/develop.md.

export function develop(options: { readonly enabled?: boolean; readonly evals?: EvalOptions } = {}): Plugin {
	return {
		name: "develop",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			host.commands.register(pluginCommand(host));
			host.commands.register(evalCommand(host));
			host.provide("prompt", pluginNewSection);
			host.provide("coordinator.context", () => pluginNewContext(host));
		},
	};
}
