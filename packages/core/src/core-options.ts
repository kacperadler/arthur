import { memoryBytes } from "./job-memory.ts";
import type { Check, OptionTable, Tool } from "./option-table.ts";

// The core's options file (spec/roadmap.md, entries 2 and 93): the options of `core` in arthur.config.ts, which config.ts
// checks by walking `table`, what the core is, and the tools it runs.

export const summary = "the config, the plugin host, the jobs in their worktrees with their limits, and the ticket board";

export const tools: readonly Tool[] = [
	{ name: "git", version: ["git", "--version"] },
	{ name: "node", version: ["node", "--version"] },
	{ name: "omp", version: ["omp", "--version"] },
	{ name: "ssh", version: ["ssh", "-V"] },
	{ name: "systemd-run", version: ["systemd-run", "--version"] },
	// The Tailscale step of docs/setup.md needs it on every machine; no plugin uses it yet.
	{ name: "tailscale", version: ["tailscale", "version"] },
];

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const optional =
	(check: Check): Check =>
	(value) =>
		value === undefined ? undefined : check(value);
const text: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "a non-empty string");
const clock: Check = (value) => (typeof value === "string" && HH_MM.test(value) ? undefined : 'a time "HH:MM" from 00:00 to 23:59');
const atLeastZero: Check = (value) =>
	typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "a number of 0 or more";

// A check is called for a key left out too; a nested object left out is not walked.
export const table: OptionTable = {
	home: { about: "Arthur's home folder: job records, the event log, each plugin's state; relative to the config's folder", default: ".arthur", check: optional(text) },
	envFile: { about: "The file of env values the config's ...Env options name, outside every folder an agent works in; relative to the config's folder", default: "~/.config/arthur/.env ($XDG_CONFIG_HOME/arthur/.env when that is set)", check: optional(text) },
	agent: { about: "The coding agent every job and the coordinator run", fields: { command: { about: "The agent's binary", default: "omp", check: optional(text) } } },
	timeZone: {
		about: "The time zone of every time of day in the config and of the clock every plugin shares",
		default: "the system's",
		check: optional((value) => (typeof value === "string" && knownZone(value) ? undefined : "a time zone such as Europe/Warsaw")),
	},
	quietHours: {
		about: "Channels send without a notification from `from` up to `to`, across midnight when `from` is later; equal: never quiet",
		default: "no quiet hours",
		fields: { from: { about: 'Where quiet hours start, "HH:MM"', check: clock }, to: { about: 'Where quiet hours end, "HH:MM"', check: clock } },
	},
	jobs: {
		about: "Each job's limits, and the joint CPU and memory of all jobs together",
		fields: {
			timeoutMinutes: { about: "Minutes a job may run before it is stopped; 0 for no limit", default: "120", check: optional(atLeastZero) },
			budgetUsd: { about: "USD a job may spend before it is stopped; 0 for no limit", default: "2", check: optional(atLeastZero) },
			idleMinutes: { about: "Minutes without output or a tool call after which a running job is idle; 0: never", default: "10", check: optional(atLeastZero) },
			cpu: {
				about: "The cores all jobs together may use, in one systemd slice",
				default: "the machine's cores less one, at least 1",
				check: optional((value) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? undefined : "a number above 0")),
			},
			memory: {
				about: "The memory all jobs together may use, as systemd's MemoryMax",
				default: "70%",
				check: optional((value) => (typeof value === "string" && memoryBytes(value, 1) !== undefined ? undefined : 'systemd MemoryMax syntax such as "70%", "8G" or "infinity"')),
			},
			offlineGraceMinutes: { about: "Minutes a job stays blocked once its machine stops answering, then it fails; 0: it fails at once", default: "30", check: optional(atLeastZero) },
			unsandboxed: { about: "Where a job's sandbox cannot be set up (macOS, no python3, a kernel without Landlock), its agent runs with the writes of Arthur's user; false: such a job fails, failed: no sandbox", default: "false", check: optional((value) => (typeof value === "boolean" ? undefined : "true or false")) },
		},
	},
};

function knownZone(name: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: name });
		return true;
	} catch {
		return false;
	}
}
