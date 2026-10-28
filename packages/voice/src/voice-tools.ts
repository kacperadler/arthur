import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Requirement } from "@arthur/core/plugin";
import type { VoiceOptions } from "./voice-options.ts";

// What a transcription needs on this server (spec/roadmap.md, entry 81): `whisper-cli` and `ffmpeg` on PATH and the model
// file. `arthur doctor` lists them, none critical; a transcription runs only when none is missing. docs/voice.md.

const COSTS = "voice notes and audio files reach the coordinator as paths, and arthur transcribe refuses";

// The model's file: a path as given, a name in `folder`, the plugin's own (`<home>/voice/`).
export const modelFile = (model: string, folder: string): string => (model.startsWith("/") ? model : join(folder, "models", `ggml-${model}.bin`));

// Whether an executable file `name` is in a folder of PATH, as the shell finds it.
function onPath(name: string): boolean {
	return (process.env.PATH ?? "").split(delimiter).some((dir) => {
		try {
			accessSync(join(dir || ".", name), constants.X_OK);
			return statSync(join(dir || ".", name)).isFile();
		} catch {
			return false;
		}
	});
}

// Each requirement: `what` a note's line names when it is missing, `why` the doctor's reason.
function needs(options: VoiceOptions, folder: string) {
	const file = modelFile(options.model, folder);
	const download = options.model.startsWith("/") ? `put the model at ${file}` : `in whisper.cpp, sh models/download-ggml-model.sh ${options.model}, then move models/ggml-${options.model}.bin to ${file}`;
	return [
		{ name: "whisper-cli", what: "whisper-cli", why: "whisper-cli not found on PATH", there: () => onPath("whisper-cli"), fix: "build whisper.cpp (git clone https://github.com/ggml-org/whisper.cpp; cmake -B build; cmake --build build -j --config Release) and put build/bin/whisper-cli on PATH" },
		{ name: "whisper model", what: `model ${file}`, why: `no file ${file}`, there: () => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false, fix: download },
		{ name: "ffmpeg", what: "ffmpeg", why: "ffmpeg not found on PATH", there: () => onPath("ffmpeg"), fix: "sudo apt-get install -y ffmpeg" },
	];
}

// The first thing missing, as a note's line names it (`<what> missing; see arthur doctor`), or undefined.
export function missing(options: VoiceOptions, folder: string): string | undefined {
	const need = needs(options, folder).find(({ there }) => !there());
	return need === undefined ? undefined : `${need.what} missing; see arthur doctor`;
}

export function requirements(options: VoiceOptions, folder: string): Requirement[] {
	return needs(options, folder).map(({ name, why, there, fix }) => ({ name, check: () => (there() ? "ok" : `missing: ${why}`), costs: COSTS, fix, critical: false }));
}
