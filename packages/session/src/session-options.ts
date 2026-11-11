import type { Check, OptionTable, Tool } from "@arthur/core/option-table";

// The session plugin's options file (spec/roadmap.md, entries 35 to 38 and 93), which `checkOptions` (session.ts) walks before
// any setup: docs/session.md. Every time of day is in core.timeZone.

export const summary = "the coordinator's conversation: compacted by day, fresh each night, restarts, the restart guard and the LLM probe";

export const tools: readonly Tool[] = [];

// What the code applies to an option left out (session.ts, restart.ts).
export const DEFAULTS = { compactAt: ["08:00", "13:00", "18:00"], compactOn: "schedule", compactAtPercent: 80, compactWaitSeconds: 1800, freshAt: "23:00", freshRetryMinutes: 15, freshUntil: "03:00", restartGuard: true, probeLlm: true };

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const time: Check = (value) => (typeof value === "string" && HH_MM.test(value) ? undefined : 'a time "HH:MM" from 00:00 to 23:59');
const whole =
	(unit: string): Check =>
	(value) =>
		Number.isInteger(value) && (value as number) >= 1 ? undefined : `a whole number of ${unit} of at least 1`;
const flag: Check = (value) => (typeof value === "boolean" ? undefined : "true or false");

export const table: OptionTable = {
	compactAt: {
		about: "When the coordinator's conversation is compacted, once it is idle; [] for never",
		default: '["08:00", "13:00", "18:00"]',
		check: (value) => (Array.isArray(value) && value.every((each) => time(each) === undefined) ? undefined : 'a list of times "HH:MM"'),
	},
	compactOn: { about: 'What compacts it: "schedule" (compactAt), "context" (compactAtPercent), or "both", whichever first', default: '"schedule"', check: (value) => (["schedule", "context", "both"].includes(value as string) ? undefined : '"schedule", "context" or "both"') },
	compactAtPercent: {
		about: 'With compactOn "context" or "both": compacted once a turn ends with the conversation at this share of its context window, or more',
		default: "80",
		check: (value) => (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 99 ? undefined : "a whole number from 1 to 99"),
	},
	compactWaitSeconds: { about: "Seconds to wait for the coordinator to be idle with nothing queued, then that compaction is skipped", default: "1800", check: whole("seconds") },
	freshAt: { about: "When the coordinator starts a fresh conversation, once no job and no merge runs", default: "23:00", check: time },
	freshRetryMinutes: { about: "While a job or a merge runs, how often the fresh start is tried again", default: "15", check: whole("minutes") },
	freshUntil: { about: "The last try of the fresh start, the next day when earlier than freshAt; then that night is skipped", default: "03:00", check: time },
	restartGuard: { about: "Once a commit changed the code arthur run loaded, refuse every spawn until arthur run starts again", default: "true", check: flag },
	probeLlm: { about: "Ask the coordinator's model one word at every start, and say in the start notice whether it answered", default: "true", check: flag },
};
