import type { Host } from "@arthur/core/plugin";
import { count, look, recordOf, type Thing } from "./docker-look.ts";
import { type Settings, sweep } from "./docker-sweep.ts";

// `arthur docker` and `arthur docker sweep` (spec/roadmap.md, entry 72): on each machine labelled `tools: docker`, Docker's own
// usage and what each job labelled, the jobs that no longer exist marked; and the sweep by hand. docs/commands/docker.md.

const USAGE = "usage: arthur docker [sweep [--machine <name>] [--dry-run]]";
const NONE = "no machine is labelled tools: docker (the machines plugin's labels), so the docker plugin acts on none";

// Docker's usage on each machine, `docker system df`, then the resources labelled with each job; exit 1 when one was not read.
async function usage(host: Host, machines: readonly string[]): Promise<number> {
	const lines: string[] = [];
	let failed = false;
	for (const machine of machines) {
		const seen = await look(host, machine);
		if ("problem" in seen) {
			lines.push(`${machine}: ${seen.problem}`);
			failed ||= seen.failed;
			continue;
		}
		// Read after the listing, as the sweep reads them: a job's record exists before anything it makes.
		const ids = host.jobs.list().map((record) => record.id);
		lines.push(`${machine}: Docker's data root ${seen.root}`, ...seen.system.map((row) => `  ${row.Type}: ${row.TotalCount} (${row.Active} active), ${row.Size}, ${row.Reclaimable} reclaimable`));
		const jobs = new Map<string, Thing[]>();
		for (const thing of seen.things) {
			const job = thing.job === undefined ? undefined : (recordOf(ids, thing.job) ?? thing.job);
			if (job !== undefined) jobs.set(job, [...(jobs.get(job) ?? []), thing]);
		}
		for (const [job, things] of jobs) lines.push(`  ${job}${recordOf(ids, job) === undefined ? " (no longer exists, so the sweep removes them)" : ""}: ${count(things.map((thing) => thing.kind))}`);
	}
	console.log(lines.join("\n"));
	return failed ? 1 : 0;
}

export function dockerCommand(host: Host, labelled: (machine: string) => unknown, settings: Settings): void {
	host.commands.register({
		name: "docker",
		doc: new URL("../docs/commands/docker.md", import.meta.url),
		async run({ args }) {
			const [verb, ...flags] = args;
			const dryRun = flags.filter((flag) => flag === "--dry-run").length;
			const at = flags.indexOf("--machine");
			const named = at < 0 ? undefined : flags[at + 1];
			if ((verb !== undefined && verb !== "sweep") || dryRun > 1 || flags.length !== dryRun + (at < 0 ? 0 : 2)) {
				console.error(USAGE);
				return 2;
			}
			const all = host.jobs.machines();
			const machines = all.filter((machine) => labelled(machine) !== undefined);
			if (named !== undefined && !all.includes(named)) {
				console.error(`arthur docker sweep: unknown machine ${named}; machines: ${all.join(", ")}`);
				return 2;
			}
			if (named !== undefined && !machines.includes(named)) {
				console.error(`arthur docker sweep: machine ${named} is not labelled tools: docker; labelled: ${machines.join(", ") || "none"}`);
				return 2;
			}
			if (machines.length === 0) return void console.log(NONE);
			if (verb === undefined) return usage(host, machines);
			const swept = await sweep(host, named === undefined ? machines : [named], settings, dryRun === 1);
			console.log(swept.flatMap((each) => [...each.would, each.line]).join("\n"));
			return swept.some((each) => each.failed) ? 1 : 0;
		},
	});
}
