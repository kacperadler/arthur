import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import type { Language, SpeakOptions } from "./speak-options.ts";
import { missing, voiceFile } from "./speak-tools.ts";

// One text to a voice note on this server (AR0553): piper speaks it with the voice of its language into a WAV in the plugin's
// folder, removed after, and ffmpeg makes that an OGG/Opus file beside it, the voice note; one text at a time, in the order they
// were asked. docs/speak.md.

// A letter only Polish writes, or one of its commonest words that has none: the text is Polish, else English.
const POLISH = /[ąćęłńóśźż]|\b(?:nie|tak|jest|czy|dla|oraz|przez|tylko|jeszcze|teraz)\b/i;

// The voice note's path, or a rejection with why there is none.
export type Say = (text: string) => Promise<string>;

export function speaker(host: Pick<Host, "folder" | "jobs">, options: SpeakOptions): Say {
	const { folder } = host;
	const ran = async (argv: readonly string[], input?: string) => {
		const done = await host.jobs.run("local", argv, options.timeoutSeconds, input);
		if (done.code !== 0) throw new Error(`${argv[0]}: ${done.stderr.trim().split("\n").at(-1)?.trim() || `exited with code ${done.code ?? "on a signal"}`}`);
	};
	const one = async (text: string): Promise<string> => {
		if (text.trim() === "") throw new Error("the text is empty");
		if (text.length > options.maxChars) throw new Error(`the text has ${text.length} characters, over maxChars ${options.maxChars}`);
		const language: Language = POLISH.test(text) ? "pl" : "en";
		const voice = options.voices[language];
		if (voice === undefined) throw new Error(`no voice for ${language} in voices`);
		const absent = missing(options, folder, language);
		if (absent !== undefined) throw new Error(absent);
		const name = join(folder, randomUUID());
		try {
			await ran(["piper", "--model", voiceFile(voice, folder), "--output_file", `${name}.wav`], `${text}\n`);
			await ran(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", `${name}.wav`, "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", `${name}.ogg`]);
		} catch (error) {
			rmSync(`${name}.ogg`, { force: true });
			throw error;
		} finally {
			rmSync(`${name}.wav`, { force: true });
		}
		return `${name}.ogg`;
	};
	// The queue: each text starts once the one before it ended, whatever that one answered.
	let last: Promise<unknown> = Promise.resolve();
	return (text) => {
		const run = last.then(() => one(text));
		last = run.catch(() => {});
		return run;
	};
}
