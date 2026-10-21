import type { Plugin } from "@arthur/core/plugin";
import { checkOptions } from "./develop-options.ts";
import { pluginCommand } from "./plugin-new.ts";

// The develop plugin (spec/roadmap.md, entry 66): developing Arthur itself. `arthur plugin new` makes a new plugin package in
// Arthur's repository that passes the checks as created (plugin-new.ts). docs/develop.md.

export function develop(options: { readonly enabled?: boolean } = {}): Plugin {
	return {
		name: "develop",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			host.commands.register(pluginCommand(host));
		},
	};
}
