import { describe } from "@arthur/core";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The orchestration plugin's options (spec/roadmap.md, entry 23), checked before any setup: docs/commands/coordinator.md,
// "Options". `maxAgents`, `roles`, `plan`, `autopilot` and `morningReport` are read by later entries (26, 28, 29, 65) and checked
// here for their shape only; `coordinator` is this entry's, with its defaults applied by `coordinatorOptions`.

type Check = (value: unknown) => string | undefined;
// An object of these keys, each left out or passing its check; a nested object is its own field list.
type Fields = { readonly [key: string]: Check | Fields };

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
const role: Fields = { model: models, thinking };

const FIELDS: Fields = {
	maxAgents: whole(1),
	coordinator: {
		model: text,
		thinking,
		// tmux takes `:` and `.` in a target as window and pane.
		tmux: { session: (value) => (typeof value === "string" && /^[\w-]+$/.test(value) ? undefined : "letters, digits, _ and -"), socket: text },
		exitWaitSeconds: whole(0),
		restartDelaySeconds: whole(1),
	},
	roles: (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? undefined : "one entry per role, e.g. { worker: { model, thinking } }"),
	plan: { budgetUsd: usd },
	autopilot: { budgetUsd: usd, budgetMaxUsd: usd },
	morningReport: { at: (value) => (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : '"HH:MM", 00:00 to 23:59') },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	checkObject("", options, FIELDS, problems);
	const { roles } = options;
	if (typeof roles === "object" && roles !== null && !Array.isArray(roles))
		for (const [name, value] of Object.entries(roles)) {
			if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) checkObject(`roles.${name}.`, value, role, problems);
			else problems.push({ path: `roles.${name}`, problem: "expected a role name of lowercase letters, digits and dashes" });
		}
	return problems;
}

// `path` ends with a dot unless it is the top level, where an unknown key is an option.
function checkObject(path: string, value: unknown, fields: Fields, problems: OptionProblem[]): void {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push({ path: path.slice(0, -1), problem: `expected an object with ${Object.keys(fields).join(", ")}, got ${describe(value)}` });
		return;
	}
	for (const [key, given] of Object.entries(value)) {
		const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
		if (field === undefined) problems.push({ path: `${path}${key}`, problem: `unknown ${path === "" ? "option" : "key"}; ${path === "" ? "options" : "keys"}: ${Object.keys(fields).join(", ")}` });
		if (field === undefined || given === undefined) continue;
		if (typeof field === "object") checkObject(`${path}${key}.`, given, field, problems);
		else {
			const expected = field(given);
			if (expected !== undefined) problems.push({ path: `${path}${key}`, problem: `expected ${expected}, got ${describe(given)}` });
		}
	}
}

// The coordinator's process, as `coordinator` sets it: the session `arthur` on tmux socket `arthur` by default.
export type Coordinator = {
	readonly model?: string;
	readonly thinking?: string;
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
		session: given.tmux?.session ?? "arthur",
		socket: given.tmux?.socket ?? "arthur",
		exitWaitSeconds: given.exitWaitSeconds ?? 60,
		restartDelaySeconds: given.restartDelaySeconds ?? 5,
	};
}
