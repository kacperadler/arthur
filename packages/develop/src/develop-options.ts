import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The develop plugin's options file (spec/roadmap.md, entries 66, 67 and 93), checked before any setup by walking `table`:
// docs/develop.md, "Options".

export type EvalOptions = { readonly runs?: number; readonly baseline?: string };

export const summary = "developing Arthur itself: arthur plugin new, a new plugin package that passes the checks as created; arthur eval, coordinator turns replayed against scenarios";

export const tools: readonly Tool[] = [];

export const RUNS = 3;
export const BASELINE = "evals/baseline.json";

const runs: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of runs, 1 or more");
const baseline: Check = (value) =>
	typeof value === "string" && value.trim() !== "" && !value.startsWith("/") && !value.split("/").includes("..") ? undefined : "a path inside the main project's checkout, such as evals/baseline.json";

export const table: OptionTable = {
	evals: {
		about: "arthur eval: coordinator turns replayed against the scenarios of each loaded package, on a copy of each one's fixture",
		fields: {
			runs: { about: "How many times each scenario runs per arthur eval, all at once; --runs overrides it", default: String(RUNS), check: runs },
			baseline: { about: "The baseline, each scenario's pass rate, in the main project's checkout; arthur eval --save-baseline writes it", default: BASELINE, check: baseline },
		},
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems = Object.keys(options).filter((key) => key !== "evals").map((key) => ({ path: key, problem: "unknown option; options: evals" }));
	const evals = options.evals;
	if (evals === undefined) return problems;
	if (typeof evals !== "object" || evals === null || Array.isArray(evals)) return [...problems, { path: "evals", problem: `expected { runs, baseline }, got ${describe(evals)}` }];
	for (const [key, value] of Object.entries(evals)) {
		const check = key === "runs" ? runs : key === "baseline" ? baseline : undefined;
		if (check === undefined) problems.push({ path: `evals.${key}`, problem: "unknown key; keys: runs, baseline" });
		else if (check(value) !== undefined) problems.push({ path: `evals.${key}`, problem: `expected ${check(value)}, got ${describe(value)}` });
	}
	return problems;
}
