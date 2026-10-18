import { totalmem } from "node:os";
import { describe, type LoadedConfig, memoryBytes } from "@arthur/core";
import type { OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { capsProblems, type FeatureCaps } from "./feature-caps.ts";
import { featureGuard } from "./feature-guard.ts";

// The resources plugin (spec/roadmap.md, entries 32 and 33): each job's own CPU and memory, `perJob`, answered as `jobs.limits`,
// which the core sets on the job's scope inside the joint slice of `core.jobs.cpu` and `core.jobs.memory`; and the caps of all
// jobs of one ticket together, `perFeature` and a ticket's own `caps`: docs/resources.md.

export type Caps = { readonly cpu?: number; readonly memory?: string };
export type ResourcesOptions = { readonly enabled?: boolean; readonly perJob?: Caps; readonly perFeature?: FeatureCaps };

// How often `arthur run` looks for jobs that took their ticket past a money or time cap.
const SWEEP_SECONDS = 10;

export function resources(options: ResourcesOptions): Plugin {
	let sweep = async () => {};
	let timer: NodeJS.Timeout | undefined;
	return {
		name: "resources",
		options,
		check: checkOptions,
		setup(host) {
			const { perJob = {}, perFeature = {} } = host.options as ResourcesOptions;
			const { cpu, memory } = perJob;
			const caps: Caps = { ...(cpu === undefined ? {} : { cpu }), ...(memory === undefined ? {} : { memory }) };
			const guard = featureGuard(host, perFeature);
			host.provide("jobs.limits", (spawn: { readonly tickets: readonly string[] }) => ({ ...caps, ...guard.slice(spawn) }));
			host.jobs.beforeSpawn(guard.check);
			sweep = () => guard.sweep().catch((error: Error) => console.error(`resources: the sweep of the feature caps failed: ${error.message}`));
			host.commands.register({
				name: "resources",
				doc: new URL("../docs/commands/resources.md", import.meta.url),
				run({ args }) {
					const [id = ""] = args;
					if (args.length !== 1 || !/^[A-Z]+\d{4,}$/.test(id)) {
						console.error("usage: arthur resources <ticket id>");
						return 2;
					}
					console.log(guard.report(id));
				},
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

// `perJob`'s caps, each refused above the joint limit of all jobs together, as this host's config sets it: one job cannot have
// more than all of them. A percentage of memory is of this host's. `perFeature`'s caps, each a number of 0 or more (0: none).
export function checkOptions(options: Options, core: LoadedConfig["core"]): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => key !== "perJob" && key !== "perFeature")
		.map((key) => ({ path: key, problem: "unknown option; options: perJob, perFeature" }));
	if (options.perFeature !== undefined) problems.push(...capsProblems(options.perFeature, "perFeature"));
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
