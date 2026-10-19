import type { Plugin } from "@arthur/core/plugin";
import type { Entry } from "./entry.ts";
import { type Registered, register } from "./register.ts";
import { scheduleCommand } from "./schedule-command.ts";
import { checkOptions } from "./schedule-options.ts";
import { sweeper } from "./sweep.ts";

// The schedule plugin (spec/roadmap.md, entries 39 and 40): actions and jobs at set times, from the config's `entries`, from the
// other plugins through `schedule.register`, and from the `file` option, which `arthur schedule add|remove` changes; swept by
// `arthur run` and each due slot run once, its run state in `<home>/schedule/`: docs/commands/schedule.md.

export type ScheduleOptions = { readonly enabled?: boolean; readonly file?: string; readonly entries?: readonly Entry[] };

const SWEEP_SECONDS = 10;

export function schedule(options: ScheduleOptions = {}): Plugin {
	let sweep = async () => {};
	let timer: NodeJS.Timeout | undefined;
	return {
		name: "schedule",
		options,
		check: checkOptions,
		setup(host) {
			const { file, entries = [] } = host.options as ScheduleOptions;
			const root = process.cwd();
			const registered: Registered[] = [];
			host.provide("schedule.register", (plugin: unknown, list: unknown) => register(registered, entries, host.code, plugin, list));
			const run = sweeper(host, entries, registered, file, root);
			sweep = () => run().catch((error: Error) => console.error(`schedule: the sweep failed: ${error.message}`));
			host.commands.register({
				name: "schedule",
				doc: new URL("../docs/commands/schedule.md", import.meta.url),
				run: ({ args, project }) => scheduleCommand({ host, configured: entries, registered, file, root }, args, project),
			});
		},
		start() {
			void sweep();
			timer = setInterval(() => void sweep(), SWEEP_SECONDS * 1000);
		},
		stop() {
			clearInterval(timer);
		},
	};
}
