import { describe, memoryBytes } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The docker plugin's options file (spec/roadmap.md, entries 70 and 93), checked before any setup by walking `table`, and the
// check of a project's piece, `docker.project(false)`: docs/docker.md.

export type DockerOptions = { readonly enabled?: boolean; readonly buildCache?: string | 0; readonly leftoverHours?: number; readonly sweep?: { readonly at: string } };

export const summary = "Docker on machines labelled tools: docker: what a job creates is labelled arthur.job=<id>, its compose stacks get its own project name, and Docker's data root counts for keepFree.disk";

export const tools: readonly Tool[] = [{ name: "docker", version: ["docker", "--version"] }];

const bytes: Check = (value) => (value === 0 || (typeof value === "string" && value !== "infinity" && !value.endsWith("%") && memoryBytes(value, 0) !== undefined) ? undefined : 'bytes with K, M, G or T ("10G"), or 0 for no cap');
const hours: Check = (value) => (typeof value === "number" && Number.isFinite(value) && value >= 1 ? undefined : "a number of hours, 1 or more");
const at: Check = (value) => (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : '"HH:MM", 00:00 to 23:59');

export const table: OptionTable = {
	buildCache: { about: "The size Docker's shared build cache is cut to after each job's cleanup and each sweep: bytes with K, M, G or T, 0 for no cap", default: "10G", check: bytes },
	leftoverHours: { about: "The sweep removes unlabelled dangling images and unused networks, and the build cache unused, this many hours old or older", default: "48", check: hours },
	sweep: {
		about: "The daily sweep, a schedule entry; a machine under keepFree.disk is swept at once all the same, and arthur docker sweep sweeps by hand",
		default: "none: no daily sweep",
		fields: { at: { about: "When it runs, in core.timeZone", check: at } },
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems = Object.keys(options).filter((key) => !Object.hasOwn(table, key)).map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	for (const [key, check] of [["buildCache", bytes], ["leftoverHours", hours]] as const)
		if (options[key] !== undefined && check(options[key]) !== undefined) problems.push({ path: key, problem: `expected ${check(options[key])}, got ${describe(options[key])}` });
	const sweep = options.sweep;
	if (sweep === undefined) return problems;
	if (typeof sweep !== "object" || sweep === null || Array.isArray(sweep)) return [...problems, { path: "sweep", problem: `expected { at }, got ${describe(sweep)}` }];
	const given = sweep as Readonly<Record<string, unknown>>;
	for (const key of Object.keys(given)) if (key !== "at") problems.push({ path: `sweep.${key}`, problem: "unknown key; keys: at" });
	if (at(given.at) !== undefined) problems.push({ path: "sweep.at", problem: `expected ${at(given.at)}, got ${describe(given.at)}` });
	return problems;
}

// A project's piece: `docker.project(false)`, its jobs' Docker resources left unlabelled; the only value it takes.
export const checkPiece = (value: unknown): string | undefined => (value === false ? undefined : `expected false, the one value it takes (its jobs then get no docker script), got ${describe(value)}`);
