import type { Day } from "@arthur/core/clock";
import type { Host, Project } from "@arthur/core/plugin";

// The schedule entry of one of manage's read-only kinds, the audit (spec/roadmap.md, entry 62) and the retro (entry 63): one
// entry with the schedule plugin at `at` on `days`, whose run starts the kind on the main project, or no job, printing why, on a
// day not in `days` (the schedule's late run of a missed slot too) or when `skip` gives a reason: docs/manage.md.

export type Scheduled = {
	readonly kind: string;
	// The option that makes the entry, and the name of its `days` in a line.
	readonly option: string;
	readonly daysOption: string;
	readonly at: string;
	readonly days?: readonly Day[];
	readonly task: string;
	readonly model?: string | readonly string[];
	readonly skip: (main: Project) => string | undefined;
};

export function scheduleKind(host: Host, scheduled: Scheduled): void {
	const { kind, option, at, days } = scheduled;
	const entry = { id: kind, at, ...(days === undefined ? {} : { days }), option: `${option}.at`, run: () => run(host, scheduled) };
	if (host.collect("schedule.register", host.name, [entry]).length === 0) throw new Error(`${option}.at needs the schedule plugin, which starts the ${kind}; add schedule() to the config's plugins, or leave ${option} out`);
}

async function run(host: Host, { kind, daysOption, days, task, model, skip }: Scheduled): Promise<void> {
	const day = host.clock.local().day;
	if (days !== undefined && !days.includes(day)) return console.log(`manage: ${kind}: no job, ${day} is not in ${daysOption} (${days.join(", ")})`);
	const [main] = host.board.projects();
	if (main === undefined) throw new Error(`no project for the ${kind}`);
	const why = skip(main);
	if (why !== undefined) return console.log(`manage: ${kind}: no job, ${why}`);
	const job = await host.jobs.spawn({ task, kind, project: main.name, ...(model === undefined ? {} : { model }) });
	if (job.failed !== undefined) throw new Error(`job ${job.id} did not start: ${job.failed}`);
	console.log(`manage: ${kind}: started job ${job.id}`);
}
