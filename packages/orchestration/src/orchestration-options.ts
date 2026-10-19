import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";
import { AUTOPILOT_BUDGET, AUTOPILOT_CAP } from "./autopilot.ts";
import { PLAN_BUDGET } from "./plans.ts";

// The orchestration plugin's options file (spec/roadmap.md, entries 23, 26 and 93), checked before any setup by walking `table`:
// docs/commands/coordinator.md, "Options". `plan` is entry 28's (plans.ts), `autopilot` entry 29's (autopilot.ts);
// `morningReport` is read by a later entry (65) and checked here for its shape only; `coordinator` is entry 23's, with its
// defaults applied by `coordinatorOptions`; `maxAgents` and `roles` are entry 26's.

export const summary = "the coordinator: one omp in its own tmux session, its inbox and context, planning and autopilot";

export const tools: readonly Tool[] = [{ name: "tmux", version: ["tmux", "-V"] }];

// omp's thinking levels (`omp --help`).
export const THINKING = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];

const text: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "a non-empty string");
const whole =
	(min: number): Check =>
	(value) =>
		Number.isInteger(value) && (value as number) >= min ? undefined : `a whole number of at least ${min}`;
const usd: Check = (value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "an amount in USD, 0 or more");
const thinking: Check = (value) => (typeof value === "string" && THINKING.includes(value) ? undefined : `one of ${THINKING.join(", ")}`);
const models: Check = (value) =>
	text(value) === undefined || (Array.isArray(value) && value.length > 0 && value.every((each) => text(each) === undefined)) ? undefined : "a model name, or a non-empty list of them";
const role: OptionTable = {
	model: { about: "The role's model, or an ordered list: the first available at the job's start is used", default: "the agent's own", check: models },
	thinking: { about: "The role's thinking level", default: "the agent's own", check: thinking },
};
// `roles.quick` is not a role: its one model is omp's quick model (`--smol`) for every job and the coordinator.
export const QUICK = "quick";
const quick: OptionTable = { model: { about: "omp's quick model (--smol) for every job and the coordinator", check: text } };
// The most jobs in a run at once, across every project and machine, when `maxAgents` is left out: the harness Arthur replaces held 3.
export const MAX_AGENTS = 3;

export const table: OptionTable = {
	maxAgents: { about: "Jobs in a run at once, across every project and machine, the human's spawns included", default: String(MAX_AGENTS), check: whole(1) },
	coordinator: {
		about: "The coordinator's agent and the tmux session it runs in",
		fields: {
			model: { about: "The coordinator's model", default: "the agent's own", check: text },
			thinking: { about: "The coordinator's thinking level", default: "the agent's own", check: thinking },
			tmux: {
				about: "Where the coordinator runs, which arthur attach joins",
				fields: {
					// tmux takes `:` and `.` in a target as window and pane.
					session: { about: "The tmux session's name", default: "arthur", check: (value) => (typeof value === "string" && /^[\w-]+$/.test(value) ? undefined : "letters, digits, _ and -") },
					socket: { about: "The tmux socket: a name (tmux -L), or a path when it holds a / (tmux -S)", default: "arthur", check: text },
				},
			},
			exitWaitSeconds: { about: "Seconds to wait for the previous coordinator to exit, so two never refresh the OAuth token at once", default: "60", check: whole(0) },
			restartDelaySeconds: { about: "Seconds after the coordinator ended, for any reason, before it starts again", default: "5", check: whole(1) },
		},
	},
	roles: {
		about: `Each role's model and thinking by role name (worker, reviewer, planner, ...); ${QUICK} takes only model, omp's quick model`,
		check: (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? undefined : "one entry per role, e.g. { worker: { model, thinking } }"),
		each: role,
	},
	plan: { about: "Plan jobs (arthur spawn --kind plan)", fields: { budgetUsd: { about: "A plan job's budget in USD; it resumes once at it, doubled", default: String(PLAN_BUDGET), check: usd } } },
	autopilot: {
		about: "Tickets set planned by policy (arthur ticket status <id> planned --autopilot)",
		fields: {
			budgetUsd: { about: "Its worker's budget in USD unless --budget or the ticket's JSON block (budget) gives one; at most budgetMaxUsd", default: String(AUTOPILOT_BUDGET), check: usd },
			budgetMaxUsd: { about: "The most --budget may give its worker, in USD", default: String(AUTOPILOT_CAP), check: usd },
		},
	},
	morningReport: {
		about: "The morning report, a schedule entry (roadmap entry 65)",
		fields: { at: { about: "When it is sent, in core.timeZone", check: (value) => (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : '"HH:MM", 00:00 to 23:59') } },
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	checkObject("", options, table, problems);
	const { budgetUsd = AUTOPILOT_BUDGET, budgetMaxUsd = AUTOPILOT_CAP } = (options.autopilot ?? {}) as { readonly budgetUsd?: unknown; readonly budgetMaxUsd?: unknown };
	if (typeof budgetUsd === "number" && typeof budgetMaxUsd === "number" && budgetUsd > budgetMaxUsd)
		problems.push({ path: "autopilot.budgetUsd", problem: `expected at most autopilot.budgetMaxUsd (${budgetMaxUsd}), got ${budgetUsd}` });
	const { roles } = options;
	if (typeof roles === "object" && roles !== null && !Array.isArray(roles))
		for (const [name, value] of Object.entries(roles)) {
			if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) problems.push({ path: `roles.${name}`, problem: "expected a role name of lowercase letters, digits and dashes" });
			else if (name === "coordinator") problems.push({ path: "roles.coordinator", problem: "the coordinator's model and thinking are coordinator.model and coordinator.thinking" });
			else checkObject(`roles.${name}.`, value, name === QUICK ? quick : role, problems);
		}
	return problems;
}

// `path` ends with a dot unless it is the top level, where an unknown key is an option.
function checkObject(path: string, value: unknown, fields: OptionTable, problems: OptionProblem[]): void {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push({ path: path.slice(0, -1), problem: `expected an object with ${Object.keys(fields).join(", ")}, got ${describe(value)}` });
		return;
	}
	for (const [key, given] of Object.entries(value)) {
		const entry = Object.hasOwn(fields, key) ? fields[key] : undefined;
		if (entry === undefined) problems.push({ path: `${path}${key}`, problem: `unknown ${path === "" ? "option" : "key"}; ${path === "" ? "options" : "keys"}: ${Object.keys(fields).join(", ")}` });
		if (entry === undefined || given === undefined) continue;
		if ("fields" in entry) checkObject(`${path}${key}.`, given, entry.fields, problems);
		else {
			const expected = entry.check(given);
			if (expected !== undefined) problems.push({ path: `${path}${key}`, problem: `expected ${expected}, got ${describe(given)}` });
		}
	}
}

// The coordinator's process, as `coordinator` sets it: the session `arthur` on tmux socket `arthur` by default; `quick` is
// `roles.quick.model`.
export type Coordinator = {
	readonly model?: string;
	readonly thinking?: string;
	readonly quick?: string;
	readonly session: string;
	readonly socket: string;
	readonly exitWaitSeconds: number;
	readonly restartDelaySeconds: number;
};

export function coordinatorOptions(options: Options): Coordinator {
	const given = (options.coordinator ?? {}) as { model?: string; thinking?: string; tmux?: { session?: string; socket?: string }; exitWaitSeconds?: number; restartDelaySeconds?: number };
	return {
		model: given.model,
		thinking: given.thinking,
		quick: roleOptions(options, QUICK).model as string | undefined,
		session: given.tmux?.session ?? "arthur",
		socket: given.tmux?.socket ?? "arthur",
		exitWaitSeconds: given.exitWaitSeconds ?? 60,
		restartDelaySeconds: given.restartDelaySeconds ?? 5,
	};
}

// One entry of `roles`, checked; empty when it is not there.
export function roleOptions(options: Options, name: string): { readonly model?: string | readonly string[]; readonly thinking?: string } {
	const roles = (options.roles ?? {}) as Readonly<Record<string, { model?: string | readonly string[]; thinking?: string }>>;
	return Object.hasOwn(roles, name) ? (roles[name] ?? {}) : {};
}
