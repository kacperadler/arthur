import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import type { ListenOptions } from "./listen-options.ts";
import { missing, modelFile } from "./listen-tools.ts";

// One file to text on this server (spec/roadmap.md, entry 81): ffmpeg makes a 16 kHz mono WAV in the plugin's folder, removed
// after, and whisper-cli transcribes it on the CPU; one file at a time, in the order they were asked. docs/listen.md.

export type Segment = { readonly start: number; readonly end: number; readonly text: string };
// `seconds`: the length given, else the WAV's, rounded; `text` is whisper's segments joined by spaces, "" when it heard no speech.
export type Transcript = { readonly seconds: number; readonly text: string; readonly segments: readonly Segment[] };
// Why the file was not transcribed, with its length when known; `over` when it is longer than `maxSeconds`.
export type Untranscribed = { readonly why: string; readonly seconds?: number; readonly over?: true };
export type Transcribe = (path: string, seconds?: number) => Promise<Transcript | Untranscribed>;

// whisper-cli's line of one segment: `[00:00:01.000 --> 00:00:03.500]   text`.
const SEGMENT = /^\[(\d+):(\d\d):(\d\d\.\d+) --> (\d+):(\d\d):(\d\d\.\d+)\]\s*(.*)$/;

const lastLine = (text: string) => text.trim().split("\n").at(-1)?.trim() ?? "";

// The length of the WAV `file` in seconds: its data chunk over the byte rate of its fmt chunk.
function wavSeconds(file: string): number {
	const data = readFileSync(file);
	let rate = 0;
	for (let at = 12; at + 8 <= data.length; ) {
		const [id, size] = [data.toString("ascii", at, at + 4), data.readUInt32LE(at + 4)];
		if (id === "fmt " && at + 16 <= data.length) rate = data.readUInt32LE(at + 16);
		if (id === "data") return rate > 0 ? Math.min(size, data.length - at - 8) / rate : 0;
		at += 8 + size + (size % 2);
	}
	return 0;
}

// whisper-cli's segments from its stdout, whisper's own `[BLANK_AUDIO]` and empty ones left out.
function segments(stdout: string): Segment[] {
	return stdout.split("\n").flatMap((line) => {
		const [, h1 = "", m1 = "", s1 = "", h2 = "", m2 = "", s2 = "", text = ""] = SEGMENT.exec(line.trim()) ?? [];
		const said = text.replaceAll("[BLANK_AUDIO]", "").trim();
		if (h1 === "" || said === "") return [];
		return [{ start: Number(h1) * 3600 + Number(m1) * 60 + Number(s1), end: Number(h2) * 3600 + Number(m2) * 60 + Number(s2), text: said }];
	});
}

export function transcriber(host: Pick<Host, "folder" | "jobs">, options: ListenOptions): Transcribe {
	const { folder } = host;
	const why = (tool: string, ran: { readonly code: number | null; readonly stderr: string }) => lastLine(ran.stderr) || `${tool} exited with code ${ran.code ?? "on a signal"}`;
	const one = async (path: string, given?: number): Promise<Transcript | Untranscribed> => {
		const known = given === undefined ? undefined : Math.round(given);
		const absent = missing(options, folder);
		if (absent !== undefined) return { why: absent, seconds: known };
		if (!(statSync(path, { throwIfNoEntry: false })?.isFile() ?? false)) return { why: `no file ${path}`, seconds: known };
		if (known !== undefined && known > options.maxSeconds) return { why: "over maxSeconds", seconds: known, over: true };
		const wav = join(folder, `${randomUUID()}.wav`);
		try {
			const ffmpeg = await host.jobs.run("local", ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], options.timeoutSeconds);
			if (ffmpeg.code !== 0) return { why: why("ffmpeg", ffmpeg), seconds: known };
			const seconds = known ?? Math.round(wavSeconds(wav));
			if (seconds > options.maxSeconds) return { why: "over maxSeconds", seconds, over: true };
			const argv = ["whisper-cli", "-m", modelFile(options.model, folder), "-t", String(options.threads), "-l", options.language, "-np", "-f", wav];
			const whisper = await host.jobs.run("local", argv, options.timeoutSeconds);
			if (whisper.code !== 0) return { why: why("whisper-cli", whisper), seconds };
			const found = segments(whisper.stdout);
			return { seconds, text: found.map((segment) => segment.text).join(" "), segments: found };
		} finally {
			rmSync(wav, { force: true });
		}
	};
	// The queue: each file starts once the one before it ended, whatever that one answered.
	let last: Promise<unknown> = Promise.resolve();
	return (path, seconds) => {
		const run = last.then(() => one(path, seconds));
		last = run.catch(() => {});
		return run;
	};
}
