import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The listen plugin's options file (spec/roadmap.md, entries 81 and 93), checked before any setup by walking `table`:
// docs/listen.md.

export type ListenOptions = { readonly model: string; readonly threads: number; readonly language: string; readonly timeoutSeconds: number; readonly maxSeconds: number };

export const summary = "voice notes and audio files from any channel transcribed on this server's CPU by whisper.cpp, never in the cloud";

// whisper-cli prints no version of its own; the doctor checks it is on PATH.
export const tools: readonly Tool[] = [{ name: "ffmpeg", version: ["ffmpeg", "-version"] }];

export const DEFAULTS: ListenOptions = { model: "medium", threads: 4, language: "pl", timeoutSeconds: 300, maxSeconds: 600 };

const whole: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a positive whole number");
const model: Check = (value) => (typeof value === "string" && (/^\/.*\.bin$/.test(value) || (/^[a-z0-9][a-z0-9._-]*$/.test(value) && !value.endsWith(".bin"))) ? undefined : "a whisper.cpp model name such as medium, or the absolute path of a .bin file");

export const table: OptionTable = {
	model: { about: "The whisper.cpp model: a name, the file .arthur/listen/models/ggml-<model>.bin, or the absolute path of a .bin file", default: DEFAULTS.model, check: model },
	threads: { about: "The CPU threads whisper-cli uses", default: String(DEFAULTS.threads), check: whole },
	language: {
		about: "The language spoken: a code of two or three lower-case letters, or auto for whisper's own detection",
		default: DEFAULTS.language,
		check: (value) => (typeof value === "string" && (/^[a-z]{2,3}$/.test(value) || value === "auto") ? undefined : "a language code of two or three lower-case letters, or auto"),
	},
	timeoutSeconds: { about: "Seconds ffmpeg or whisper-cli may run on one file before it is killed and the file is not transcribed", default: String(DEFAULTS.timeoutSeconds), check: whole },
	maxSeconds: { about: "The longest file transcribed, in seconds; a longer one is not", default: String(DEFAULTS.maxSeconds), check: whole },
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
export const listenOptions = (options: Options): ListenOptions => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) });
