import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Requirement } from "@arthur/core/plugin";
import type { Language, SpeakOptions } from "./speak-options.ts";

// What speaking needs on this server (AR0553): `piper` and `ffmpeg` on PATH and each voice's model with its config beside it.
// `arthur doctor` lists them, none critical; a text is spoken only when none it needs is missing. docs/speak.md.

const COSTS = "a reply to a voice note goes as text alone, and arthur say refuses";
// A voice name as rhasspy/piper-voices names it: `<language>_<REGION>-<speaker>-<quality>`, its folder on Hugging Face.
const PUBLISHED = /^(([a-z]{2,3})_[A-Z]{2})-([a-z0-9_]+)-(x_low|low|medium|high)$/;

// The voice's model: a path as given, a name in `folder`, the plugin's own (`<home>/speak/`).
export const voiceFile = (voice: string, folder: string): string => (voice.startsWith("/") ? voice : join(folder, "voices", `${voice}.onnx`));

const isFile = (path: string) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

// Whether an executable file `name` is in a folder of PATH, as the shell finds it.
function onPath(name: string): boolean {
	return (process.env.PATH ?? "").split(delimiter).some((dir) => {
		try {
			accessSync(join(dir || ".", name), constants.X_OK);
			return isFile(join(dir || ".", name));
		} catch {
			return false;
		}
	});
}

// Each requirement for `languages`: `absent` says why it is missing, undefined when it is there.
function needs(options: SpeakOptions, folder: string, languages: readonly Language[]) {
	const voices = languages.flatMap((language) => {
		const voice = options.voices[language];
		if (voice === undefined) return [];
		const file = voiceFile(voice, folder);
		const [, region = "", code = "", speaker = "", quality = ""] = PUBLISHED.exec(voice) ?? [];
		const url = `https://huggingface.co/rhasspy/piper-voices/resolve/main/${code}/${region}/${speaker}/${quality}/${voice}.onnx`;
		const fix = code === "" || voice.startsWith("/") ? `put the voice at ${file} and its config at ${file}.json (https://huggingface.co/rhasspy/piper-voices)` : `curl -fL --create-dirs -o ${file} ${url} && curl -fL -o ${file}.json ${url}.json`;
		const absent = () => [file, `${file}.json`].filter((each) => !isFile(each)).map((each) => `no file ${each}`)[0];
		return [{ name: `voice ${language}`, absent, fix }];
	});
	return [
		{ name: "piper", absent: () => (onPath("piper") ? undefined : "piper not found on PATH"), fix: "pipx install piper-tts (https://github.com/OHF-Voice/piper1-gpl), which puts piper on PATH" },
		...voices,
		{ name: "ffmpeg", absent: () => (onPath("ffmpeg") ? undefined : "ffmpeg not found on PATH"), fix: "sudo apt-get install -y ffmpeg" },
	];
}

// Why `language` cannot be spoken, the first thing missing (`<why>; see arthur doctor`), or undefined.
export function missing(options: SpeakOptions, folder: string, language: Language): string | undefined {
	for (const need of needs(options, folder, [language])) {
		const why = need.absent();
		if (why !== undefined) return `${why}; see arthur doctor`;
	}
	return undefined;
}

export function requirements(options: SpeakOptions, folder: string): Requirement[] {
	return needs(options, folder, ["pl", "en"]).map(({ name, absent, fix }) => ({
		name,
		check: () => {
			const why = absent();
			return why === undefined ? "ok" : `missing: ${why}`;
		},
		costs: COSTS,
		fix,
		critical: false,
	}));
}
