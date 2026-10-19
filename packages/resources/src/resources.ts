import type { Plugin } from "@arthur/core/plugin";
import type { FeatureCaps } from "./feature-caps.ts";
import { featureGuard } from "./feature-guard.ts";
import type { Said } from "./machine-free.ts";
import { checkOptions } from "./resource-options.ts";
import { CHECK_SECONDS, type KeepFree, roomGuard } from "./room.ts";

// The resources plugin (spec/roadmap.md, entries 32 to 34): each job's own CPU and memory, `perJob`, answered as `jobs.limits`,
// which the core sets on the job's scope inside the joint slice of `core.jobs.cpu` and `core.jobs.memory`; the caps of all
// jobs of one ticket together, `perFeature` and a ticket's own `caps`; and how many jobs each machine has room for, from its
// free CPU and memory less `keepFree` and the jobs' `perJob` reservations (room.ts), each listed machine's read at each round
// of the `machines` plugin (`machines.round`): docs/resources.md.

export type Caps = { readonly cpu?: number; readonly memory?: string };
export type ResourcesOptions = { readonly enabled?: boolean; readonly perJob?: Caps; readonly perFeature?: FeatureCaps; readonly keepFree?: KeepFree };

// How often `arthur run` looks for jobs that took their ticket past a money or time cap.
const SWEEP_SECONDS = 10;

export function resources(options: ResourcesOptions): Plugin {
	let sweep = async () => {};
	let check = async () => {};
	let timers: NodeJS.Timeout[] = [];
	return {
		name: "resources",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			const { perJob = {}, perFeature = {}, keepFree = {} } = host.options as ResourcesOptions;
			const { cpu, memory } = perJob;
			const caps: Caps = { ...(cpu === undefined ? {} : { cpu }), ...(memory === undefined ? {} : { memory }) };
			const guard = featureGuard(host, perFeature);
			const room = roomGuard(host, host.folder, perJob, keepFree);
			host.provide("jobs.limits", (spawn: { readonly tickets: readonly string[] }) => ({ ...caps, ...guard.slice(spawn) }));
			host.provide("resources.free", room.free);
			host.provide("machines.round", (checks: ReadonlyMap<string, Promise<Said>>, everySeconds?: number) => void Promise.try(() => room.round(checks, everySeconds)).catch((error: Error) => console.error(`resources: the check of free CPU and memory failed: ${error.message}`)));
			host.provide("coordinator.context", room.context);
			host.jobs.beforeSpawn(guard.check);
			host.jobs.beforeSpawn(room.check);
			sweep = () => guard.sweep().catch((error: Error) => console.error(`resources: the sweep of the feature caps failed: ${error.message}`));
			check = () => room.checkLocal().then(() => {}, (error: Error) => console.error(`resources: the check of free CPU and memory failed: ${error.message}`));
			host.commands.register({
				name: "resources",
				doc: new URL("../docs/commands/resources.md", import.meta.url),
				phone: { about: "each machine's room for more jobs, from its free CPU and memory", reply: (text) => (text.trim() === "" ? room.lines() : "usage: /resources") },
				run({ args }) {
					const [id = ""] = args;
					if (args.length > 1 || (args.length === 1 && !/^[A-Z]+\d{4,}$/.test(id))) {
						console.error("usage: arthur resources [<ticket id>]");
						return 2;
					}
					if (args.length === 0) return room.lines().then((lines) => void console.log(lines));
					console.log(guard.report(id));
				},
			});
		},
		start() {
			void sweep();
			void check();
			timers = [setInterval(() => void sweep(), SWEEP_SECONDS * 1000), setInterval(() => void check(), CHECK_SECONDS * 1000)];
		},
		stop() {
			for (const timer of timers) clearInterval(timer);
		},
	};
}
