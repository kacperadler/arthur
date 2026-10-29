import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The video plugin's options file (AR0551), checked before any setup by walking `table`: docs/video.md.

export type VideoOptions = { readonly everySeconds: number; readonly maxFrames: number; readonly maxSeconds: number; readonly timeoutSeconds: number };

export const summary = "videos from any channel cut on this server by ffmpeg into frames and a sound track the listen plugin transcribes";

export const tools: readonly Tool[] = [{ name: "ffmpeg", version: ["ffmpeg", "-version"] }];

export const DEFAULTS: VideoOptions = { everySeconds: 5, maxFrames: 12, maxSeconds: 600, timeoutSeconds: 300 };

const whole: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a positive whole number");

export const table: OptionTable = {
	everySeconds: { about: "Seconds between two frames taken at the fixed step; a scene change adds one between them", default: String(DEFAULTS.everySeconds), check: whole },
	maxFrames: { about: "The most frames taken from one video, the first ones in time", default: String(DEFAULTS.maxFrames), check: whole },
	maxSeconds: { about: "The longest video cut, in seconds; a longer one reaches the coordinator as its path", default: String(DEFAULTS.maxSeconds), check: whole },
	timeoutSeconds: { about: "Seconds ffprobe or ffmpeg may run on one step of a video before it is killed", default: String(DEFAULTS.timeoutSeconds), check: whole },
};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.entries(options).flatMap(([key, value]) => {
		const option = Object.hasOwn(table, key) ? table[key] : undefined;
		if (option === undefined || !("check" in option)) return [{ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }];
		const expected = value === undefined ? undefined : option.check(value);
		return expected === undefined ? [] : [{ path: key, problem: `expected ${expected}, got ${describe(value)}` }];
	});
}

// The options as given, each one left out at its default; only after `checkOptions` found no problem.
export const videoOptions = (options: Options): VideoOptions => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) });
