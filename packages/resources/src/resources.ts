import { totalmem } from "node:os";
import { describe, type LoadedConfig, memoryBytes } from "@arthur/core";
import type { OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { capsProblems, type FeatureCaps } from "./feature-caps.ts";
import { featureGuard } from "./feature-guard.ts";
import { CHECK_SECONDS, type KeepFree, keepFreeProblems, roomGuard } from "./room.ts";

// The resources plugin (spec/roadmap.md, entries 32 to 34): each job's own CPU and memory, `perJob`, answered as `jobs.limits`,
// which the core sets on the job's scope inside the joint slice of `core.jobs.cpu` and `core.jobs.memory`; the caps of all
// jobs of one ticket together, `perFeature` and a ticket's own `caps`; and how many jobs each machine has room for, from its
// free CPU and memory less `keepFree` and the jobs' `perJob` reservations (room.ts): docs/resources.md.

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
			host.provide("coordinator.context", room.context);
			host.jobs.beforeSpawn(guard.check);
			host.jobs.beforeSpawn(room.check);
			sweep = () => guard.sweep().catch((error: Error) => console.error(`resources: the sweep of the feature caps failed: ${error.message}`));
			check = () => room.checkAll().then(() => {}, (error: Error) => console.error(`resources: the check of free CPU and memory failed: ${error.message}`));
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

// `perJob`'s caps, each refused above the joint limit of all jobs together, as this host's config sets it: one job cannot have
// more than all of them. A percentage of memory is of this host's. `perFeature`'s caps, each a number of 0 or more (0: none).
export function checkOptions(options: Options, core: LoadedConfig["core"]): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => key !== "perJob" && key !== "perFeature" && key !== "keepFree")
		.map((key) => ({ path: key, problem: "unknown option; options: perJob, perFeature, keepFree" }));
	if (options.perFeature !== undefined) problems.push(...capsProblems(options.perFeature, "perFeature"));
	if (options.keepFree !== undefined) problems.push(...keepFreeProblems(options.keepFree));
	const { perJob } = options;
	if (perJob === undefined) return problems;
	if (typeof perJob !== "object" || perJob === null || Array.isArray(perJob)) return [...problems, { path: "perJob", problem: `expected an object with cpu, memory, got ${describe(perJob)}` }];
	const { cpu, memory, ...unknown } = perJob as Readonly<Record<string, unknown>>;
	for (const key of Object.keys(unknown)) problems.push({ path: `perJob.${key}`, problem: "unknown key; keys: cpu, memory" });
	if (cpu !== undefined && !(typeof cpu === "number" && Number.isFinite(cpu) && cpu > 0)) problems.push({ path: "perJob.cpu", problem: `expected a number of cores above 0, got ${describe(cpu)}` });
	else if (typeof cpu === "number" && cpu > core.jobs.cpu) problems.push({ path: "perJob.cpu", problem: `${cpu} is above core.jobs.cpu, ${core.jobs.cpu}, the cores of all jobs together` });
	const bytes = typeof memory === "string" ? memoryBytes(memory, totalmem()) : undefined;
	if (memory !== undefined && bytes === undefined) problems.push({ path: "perJob.memory", problem: `expected systemd MemoryMax syntax such as "4G", "25%" or "infinity", got ${describe(memory)}` });
	else if (bytes !== undefined && bytes > (memoryBytes(core.jobs.memory, totalmem()) ?? Infinity))
		problems.push({ path: "perJob.memory", problem: `${String(memory)} is above core.jobs.memory, ${core.jobs.memory}, the memory of all jobs together` });
	return problems;
}
