import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The speak plugin's options file (AR0553), checked before any setup by walking `table`: docs/speak.md.

// `voices` by language: the languages `languageOf` tells apart.
export type Language = "pl" | "en";
export type SpeakOptions = { readonly voices: Readonly<Partial<Record<Language, string>>>; readonly maxChars: number; readonly timeoutSeconds: number };

export const summary = "the coordinator's reply to a voice note spoken on this server by Piper into a voice note, never in the cloud";

// piper prints no version of its own; the doctor checks it is on PATH.
export const tools: readonly Tool[] = [{ name: "ffmpeg", version: ["ffmpeg", "-version"] }];

export const DEFAULTS: SpeakOptions = { voices: { pl: "pl_PL-gosia-medium", en: "en_US-lessac-medium" }, maxChars: 1500, timeoutSeconds: 120 };

const whole: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a positive whole number");
const voices: Check = (value) => {
	const entries = typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [];
	const named = ([language, name]: [string, unknown]) =>
		(language === "pl" || language === "en") && typeof name === "string" && (/^\/.*\.onnx$/.test(name) || (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.endsWith(".onnx")));
	return entries.length > 0 && entries.every(named) ? undefined : "a record of pl, en or both, each a Piper voice name such as pl_PL-gosia-medium or the absolute path of a .onnx file";
};

export const table: OptionTable = {
	voices: { about: "The Piper voice of each language, pl and en: a name, the file .arthur/speak/voices/<name>.onnx, or the absolute path of a .onnx file", default: `{ pl: "${DEFAULTS.voices.pl}", en: "${DEFAULTS.voices.en}" }`, check: voices },
	maxChars: { about: "The longest reply spoken, in characters; a longer one goes as text alone", default: String(DEFAULTS.maxChars), check: whole },
	timeoutSeconds: { about: "Seconds piper or ffmpeg may run on one text before it is killed and the text goes alone", default: String(DEFAULTS.timeoutSeconds), check: whole },
};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.entries(options).flatMap(([key, value]) => {
		const option = Object.hasOwn(table, key) ? table[key] : undefined;
		if (option === undefined || !("check" in option)) return [{ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }];
		const expected = value === undefined ? undefined : option.check(value);
		return expected === undefined ? [] : [{ path: key, problem: `expected ${expected}, got ${describe(value)}` }];
	});
}

// The options as given, each one left out at its default (`voices` given replaces the default whole); only after `checkOptions` found no problem.
export const speakOptions = (options: Options): SpeakOptions => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) });
