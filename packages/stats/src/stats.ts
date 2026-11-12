import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { Event, Host, JobRecord, OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { addUsage, appendLine, type Line, readLines, round } from "./stats-lines.ts";
import { ticketStats } from "./tickets.ts";

// The stats plugin (spec/roadmap.md, entries 109 and 110): one line in `runs.jsonl` of its folder per `job-ended`, what that run
// added to the job's record, written only by `arthur run` once started; at its first start one `backfill` line per record that
// ended before; the coordinator's turns through its extension (session-extension.ts); and the merged tickets' report as
// `arthur stats` and as `stats.tickets`, the `### Stats` section of manage's audit and retro prompts (tickets.ts): docs/stats.md.

// Its options file too (`./options`), which `arthur setup` reads: what it is in one line, the tools it runs, its options.
export const summary = "stats: the tokens, cost and time of every job run and coordinator turn, kept in its folder";

export const tools: readonly Tool[] = [];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; stats has no options but enabled" }));
}

const EXTENSION = fileURLToPath(new URL("session-extension.ts", import.meta.url));
type Totals = { readonly seconds: number; readonly cost: number; readonly usage: unknown };
const NONE: Totals = { seconds: 0, cost: 0, usage: {} };

// A line's numbers, or what a record holds: its `cost` file is text.
const totals = (from: Line | JobRecord): Totals => ({ seconds: Number(from.seconds) || 0, cost: Number(from.cost) || 0, usage: from.usage });
const add = (a: Totals, b: Totals, sign = 1): Totals => ({ seconds: round(a.seconds + sign * b.seconds), cost: round(a.cost + sign * b.cost), usage: addUsage(a.usage, b.usage, sign) });
// The ticket ids a record's task names by path (`spec/features/AR0650-<slug>/ticket.md`).
const ticketIds = (job: JobRecord): string[] => job.tickets.flatMap((path) => /(?:^|\/)([A-Z]+\d{4,})-[^/]*\/[^/]*$/.exec(path)?.[1] ?? []);
const described = (job: JobRecord) => ({ job: job.id, kind: job.kind, project: job.project, tickets: ticketIds(job), machine: job.machine, state: job.state, reason: job.reason });

export function stats(options: { readonly enabled?: boolean } = {}): Plugin {
	let host: Host | undefined;
	let runs = "";
	// Until `start`, the ends heard wait here: a process that never starts (a command's) writes nothing.
	let waiting: Event[] | undefined = [];
	// What `runs.jsonl` holds: its highest `seq`, and each job's lines summed.
	let last = 0;
	const counted = new Map<string, Totals>();
	const count = (line: Line) => {
		last = Math.max(last, Number(line.seq) || 0);
		counted.set(String(line.job), add(counted.get(String(line.job)) ?? NONE, totals(line)));
	};
	const put = (line: Line) => {
		appendLine(runs, line);
		count(line);
	};
	// A replayed end, or one already written before a crash, is skipped by its `seq`; the run's numbers are the record's now
	// less the job's earlier lines, so a second end of one run (blocked, then stopped) adds 0.
	const record = (given: Host, event: Event) => {
		if (event.seq <= last) return;
		const data = (typeof event.data === "object" && event.data !== null ? event.data : {}) as Readonly<Record<string, unknown>>;
		const job = given.jobs.list().find((each) => each.id === data.id);
		const at = { seq: event.seq, time: event.time };
		if (job === undefined) return put({ ...at, job: String(data.id ?? ""), kind: String(data.kind ?? ""), project: String(data.project ?? ""), tickets: [], machine: "", state: data.state ?? "", reason: data.reason ?? "", ...NONE, missing: true });
		put({ ...at, ...described(job), ...add(totals(job), counted.get(job.id) ?? NONE, -1) });
	};
	return {
		name: "stats",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(given) {
			[host, runs] = [given, join(given.folder, "runs.jsonl")];
			given.provide("coordinator.extension", () => ({ file: EXTENSION, env: { ARTHUR_STATS_FOLDER: given.folder } }));
			given.events.on("job-ended", (event) => (waiting === undefined ? record(given, event) : void waiting.push(event)));
			given.provide("stats.tickets", (project: string, since?: Date) => ticketStats(given, project, since));
			given.commands.register({
				name: "stats",
				doc: new URL("../docs/commands/stats.md", import.meta.url),
				inJob: true,
				run({ args, project }) {
					if (args.length > 0) {
						console.error("usage: arthur stats [--project <name>]");
						return 2;
					}
					console.log(ticketStats(given, project));
				},
			});
		},
		start() {
			if (host === undefined) return;
			readLines(runs).forEach(count);
			if (!existsSync(runs)) {
				// The jobs that ended before stats was installed; one still in a run gets its whole spend at its end.
				for (const job of host.jobs.list()) if (job.state !== "working" && job.state !== "idle" && job.hold === "") put({ time: job.since, ...described(job), ...totals(job), backfill: true });
				writeFileSync(runs, "", { flag: "a" });
			}
			for (const event of waiting ?? []) record(host, event);
			waiting = undefined;
		},
	};
}
