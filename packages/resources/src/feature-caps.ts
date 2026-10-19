import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { CAPS, capsProblems } from "./resource-options.ts";

// Caps per feature (spec/roadmap.md, entry 33): what all jobs of one ticket together may spend and use, from `perFeature`,
// each replaced by the `caps` of the ticket's own JSON block, `0` meaning no cap: docs/resources.md.

export type FeatureCaps = { readonly budgetUsd?: number; readonly hours?: number; readonly cpu?: number; readonly memory?: string | 0 };
// The caps in force for one ticket, none left as 0, and where each comes from: `ticket <id>` or `perFeature`.
export type InForce = { readonly caps: FeatureCaps; readonly from: Readonly<Record<string, string>> };
// What the spend reads of a job of `host.jobs.list()`.
type Job = { readonly cost: string; readonly budget: string; readonly seconds: number };

export const KEYS = Object.keys(CAPS) as readonly (keyof typeof CAPS)[];
// A ticket's folder in a `Ticket:` path, and its id.
const FEATURE = /(?:^|\/)spec\/features\/([A-Z]+\d{4,})-[^/]*\//;

// The ticket of a job or a spawn: the first of its `Ticket:` paths that lies in one; undefined for none.
export const ticketOf = (tickets: readonly string[]): string | undefined => tickets.map((path) => FEATURE.exec(path)?.[1]).find(Boolean);

// The `caps` of ticket `id`'s JSON block, in its `ticket.md` in its project's main checkout, as the human edits it; undefined
// without a project list, for a ticket on no board, and for a block without `caps`. A block that is not JSON, or caps of the
// wrong shape, are refused, naming the file.
function ticketCaps(host: Host, id: string): FeatureCaps | undefined {
	if (host.collect("projects").length === 0) return undefined;
	const ticket = host.board.get(id);
	const project = host.board.projects().find((each) => each.name === ticket?.project);
	const file = ticket === undefined || project === undefined ? "" : join(project.path, ticket.path);
	const block = file !== "" && existsSync(file) ? /^```json\n([\s\S]*?)^```$/m.exec(readFileSync(file, "utf8"))?.[1] : undefined;
	if (block === undefined) return undefined;
	let json: unknown;
	try {
		json = JSON.parse(block);
	} catch (error) {
		throw new Error(`${file}: its JSON block is not JSON (${(error as Error).message}); fix it by hand`);
	}
	if (typeof json !== "object" || json === null || !("caps" in json)) return undefined;
	const problems = capsProblems(json.caps, "caps");
	if (problems.length > 0) throw new Error(`${file}: ${problems.map((each) => `${each.path}: ${each.problem}`).join("; ")}`);
	return json.caps as FeatureCaps;
}

// Ticket `id`'s caps: each of its own `caps`, else `perFeature`'s.
export function capsOf(host: Host, perFeature: FeatureCaps, id: string): InForce {
	const own = ticketCaps(host, id) ?? {};
	const caps: Record<string, unknown> = {};
	const from: Record<string, string> = {};
	for (const key of KEYS) {
		const [value, where] = own[key] !== undefined ? [own[key], `ticket ${id}`] : [perFeature[key], "perFeature"];
		if (value === undefined || value === 0) continue;
		caps[key] = value;
		from[key] = where;
	}
	return { caps: caps as FeatureCaps, from };
}

// What `jobs`, those of one ticket, spent: USD, a job whose `cost` is missing or broken counting as its whole budget (with no
// budget, without end); and the seconds of their runs, each one in a run up to now.
export type Spent = { readonly usd: number; readonly seconds: number };
export function spentOn(jobs: readonly Job[]): Spent {
	const cost = (job: Job) => (job.cost.trim() !== "" && Number.isFinite(Number(job.cost)) ? Number(job.cost) : Number(job.budget) || Infinity);
	return { usd: jobs.reduce((sum, job) => sum + cost(job), 0), seconds: jobs.reduce((sum, job) => sum + job.seconds, 0) };
}

export const usd = (value: number): string => (Number.isFinite(value) ? `$${value.toFixed(4)}` : "unknown (a job with neither its cost nor a budget)");
export const hours = (seconds: number): string => `${(seconds / 3600).toFixed(2)} h`;

// The first of a ticket's money and time caps its jobs reached, both at 4 decimals in USD and to the second in time: a spend
// exactly at the cap reaches it. `spent` and `limit` are USD, or hours. Undefined when none is reached.
export type Reached = { readonly cap: "budgetUsd" | "hours"; readonly spent: number; readonly limit: number; readonly text: string };
export function reachedCap(caps: FeatureCaps, spent: Spent): Reached | undefined {
	const { budgetUsd, hours: time } = caps;
	if (budgetUsd !== undefined && Math.round(spent.usd * 10_000) >= Math.round(budgetUsd * 10_000))
		return { cap: "budgetUsd", spent: spent.usd, limit: budgetUsd, text: `feature cap budgetUsd reached: ${usd(spent.usd)} of $${budgetUsd}` };
	if (time !== undefined && Math.floor(spent.seconds) >= Math.round(time * 3600))
		return { cap: "hours", spent: spent.seconds / 3600, limit: time, text: `feature cap hours reached: ${hours(spent.seconds)} of ${time} h` };
	return undefined;
}
