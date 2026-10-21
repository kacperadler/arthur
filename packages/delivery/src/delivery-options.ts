import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The delivery plugin's options file (spec/roadmap.md, entries 52, 53, 54 and 93), checked before any setup by walking `table`;
// the reviewer's model is orchestration's `roles.reviewer`. docs/commands/review.md, docs/commands/review-needed.md.

export const summary = "review jobs of a worker's branch, their verdict moving the ticket, at most 2 FAILs before the owner decides; whether a branch needs one; its merge with the checks on main; CHANGELOG.md from the merged tickets";

// Git, which the review's checkout and its range need, is the core's tool.
export const tools: readonly Tool[] = [];

// The always-review list left out: the files that read secrets (the core's `.env` loading, entry 3, and the env guard), the
// CI-failure handling (entries 57 to 59) and the CI's workflows, and the review rules themselves.
export const ALWAYS_REVIEW = ["**/env.ts", "**/env-*.ts", "**/ci.ts", "**/ci-*.ts", ".github/workflows/**", "**/review-needed.ts", "**/checks-extension.ts", "**/roles/reviewer.md", "**/criteria/review.md"];

const globs: Check = (value) => (Array.isArray(value) && value.every((each) => typeof each === "string" && each !== "" && !each.startsWith("/")) ? undefined : 'a list of glob patterns from a project\'s root, such as "**/env.ts"');

export const table: OptionTable = {
	review: {
		about: "How arthur review-needed decides whether a branch needs a review",
		fields: {
			alwaysReview: { about: "The files a branch that changes one always gets a review for, in every project, as glob patterns from its root; a list replaces the default", default: ALWAYS_REVIEW.join(", "), check: globs },
		},
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems = Object.keys(options).filter((key) => key !== "review").map((key) => ({ path: key, problem: "unknown option; options: review" }));
	const { review } = options;
	if (review === undefined) return problems;
	if (typeof review !== "object" || review === null || Array.isArray(review)) return [...problems, { path: "review", problem: `expected an object { alwaysReview? }, got ${describe(review)}` }];
	for (const [key, value] of Object.entries(review)) {
		if (key !== "alwaysReview") problems.push({ path: `review.${key}`, problem: "unknown key; keys: alwaysReview" });
		else if (globs(value) !== undefined) problems.push({ path: "review.alwaysReview", problem: `expected ${globs(value)}, got ${describe(value)}` });
	}
	return problems;
}
