import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The delivery plugin's options file (spec/roadmap.md, entries 52, 53, 54 and 93), checked before any setup by walking `table`;
// the reviewer's model is orchestration's `roles.reviewer`. docs/commands/review.md, docs/commands/review-needed.md,
// docs/commands/merge.md.

export const summary = "review jobs of a worker's branch, their verdict moving the ticket, at most 4 FAILs before the owner decides; whether a branch needs one; its merge with the checks on main, on its own after a PASS or a no review and green CI; CHANGELOG.md from the merged tickets";

// Git, which the review's checkout and its range need, is the core's tool.
export const tools: readonly Tool[] = [];

// The always-review list left out: what reads secrets (`.env` loading, entry 3, the env guard), the CI-failure handling (entries
// 57 to 59), the CI's workflows, the review rules, the prompt files every role reads (roles, criteria, the vision, the overrides
// under `.agents/`, named as `**` enters no dot folder; AR0351), the board (AR0484), what the merge and each spawn run (AR0358, AR0432).
export const ALWAYS_REVIEW = ["**/env.ts", "**/env-*.ts", "**/ci.ts", "**/ci-*.ts", "**/github-ci.ts", "**/auto-merge.ts", "**/merge-command.ts", ".github/workflows/**", "**/review-needed.ts", "**/checks-extension.ts", "**/roles/**", "**/criteria/**", ".agents/**", "spec/vision.md", "spec/build.json", "**/package.json", "**/package-lock.json", "**/npm-shrinkwrap.json", "**/bun.lock", "**/bun.lockb", "**/yarn.lock", "**/pnpm-lock.yaml", "**/.npmrc", "**/.nvmrc", "**/composer.json", "**/composer.lock", "**/uv.lock", "**/pyproject.toml", "**/.yarnrc.yml", "**/.pnpmfile.cjs", "**/bunfig.toml", ".githooks/**", ".husky/**"];
// An hour for each step of a merge's checks on main (AR0374), a whole test run's.
export const STEP_SECONDS = 3600;

const globs: Check = (value) => (Array.isArray(value) && value.every((each) => typeof each === "string" && each !== "" && !each.startsWith("/")) ? undefined : 'a list of glob patterns from a project\'s root, such as "**/env.ts"');
const seconds: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of seconds, 1 or more");

export const table: OptionTable = {
	review: {
		about: "How arthur review-needed decides whether a branch needs a review",
		fields: {
			alwaysReview: { about: "The files a branch that changes one always gets a review for, in every project, as glob patterns from its root; a list replaces the default", default: ALWAYS_REVIEW.join(", "), check: globs },
		},
	},
	merge: { about: "How arthur merge runs the checks on main", fields: { stepSeconds: { about: "Seconds each step (the install, npm run check, npm test) may run before it is killed and fails the merge", default: String(STEP_SECONDS), check: seconds } } },
};

// Each option of `table` is an object of fields, each with its check.
export function checkOptions(options: Options): OptionProblem[] {
	const names = Object.keys(table);
	const problems = Object.keys(options).filter((key) => !names.includes(key)).map((key) => ({ path: key, problem: `unknown option; options: ${names.join(", ")}` }));
	for (const [name, entry] of Object.entries(table)) {
		const [given, fields] = [options[name], "fields" in entry ? entry.fields : {}];
		if (given === undefined) continue;
		if (typeof given !== "object" || given === null || Array.isArray(given)) problems.push({ path: name, problem: `expected an object { ${Object.keys(fields).map((key) => `${key}?`).join(", ")} }, got ${describe(given)}` });
		else
			for (const [key, value] of Object.entries(given)) {
				const field = fields[key];
				const said = field !== undefined && "check" in field ? field.check(value) : undefined;
				const wrong = field === undefined ? `unknown key; keys: ${Object.keys(fields).join(", ")}` : said && `expected ${said}, got ${describe(value)}`;
				if (wrong !== undefined) problems.push({ path: `${name}.${key}`, problem: wrong });
			}
	}
	return problems;
}
