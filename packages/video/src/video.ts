import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Claim, Part } from "@arthur/core/parts";
import type { Host, Plugin } from "@arthur/core/plugin";
import { frames, probe, sound } from "./ffmpeg.ts";
import { checkOptions, type VideoOptions, videoOptions } from "./video-options.ts";
import { absent, requirements } from "./video-tools.ts";
import { tenth, words } from "./words.ts";

// The video plugin (AR0551): every `video` part from any channel reaches the coordinator as what it shows and what is said in
// it, cut on this server by ffmpeg into frames and a sound track the listen plugin transcribes. docs/video.md.

export function video(options: { readonly enabled?: boolean } & Partial<VideoOptions> = {}): Plugin {
	return {
		name: "video",
		module: import.meta.url,
		options,
		check: checkOptions,
		doctor: requirements,
		setup(host) {
			const loaded = videoOptions(host.options);
			host.provide("message.part", (part: Part): Promise<Claim> | undefined => (part.kind === "video" && part.path !== undefined ? cut(host, loaded, part.path, part.seconds) : undefined));
		},
	};
}

// The video at `path` as the coordinator's line; `given` its length as the channel gave it.
async function cut(host: Pick<Host, "folder" | "jobs" | "collect">, options: VideoOptions, path: string, given?: number): Promise<Claim> {
	const limit = options.timeoutSeconds;
	const known = given === undefined ? undefined : Math.round(given);
	const notCut = (why: string, seconds = known) => ({ text: `[video${seconds === undefined ? "" : ` ${seconds} s`}: not cut: ${why}] (${path})` });
	const over = (seconds: number) => ({ ...notCut("over maxSeconds", seconds), reply: `video of ${seconds} s is over maxSeconds ${options.maxSeconds}; not cut` });
	const gone = absent();
	if (gone.length > 0) return notCut(`${gone[0]} missing; see arthur doctor`);
	if (known !== undefined && known > options.maxSeconds) return over(known);
	const probed = await probe(host, path, limit);
	if ("why" in probed) return notCut(`${probed.why}; see arthur doctor`);
	const seconds = known ?? Math.round(probed.seconds);
	if (seconds > options.maxSeconds) return over(seconds);
	const folder = join(host.folder, randomUUID());
	mkdirSync(folder);
	const shown = await frames(host, path, folder, options.everySeconds, options.maxFrames, limit);
	if ("why" in shown) {
		rmSync(folder, { recursive: true, force: true });
		return notCut(`${shown.why}; see arthur doctor`, seconds);
	}
	const wav = join(folder, "sound.wav");
	const failed = probed.sound ? await sound(host, path, wav, limit) : undefined;
	const said = !probed.sound ? { note: "no sound" } : failed === undefined ? await words(host, wav) : { note: `not transcribed: ${failed.why}` };
	// The WAV goes once transcribed or refused; the frames stay for the coordinator to open.
	rmSync(wav, { force: true });
	const head = "note" in said ? `[video ${seconds} s: ${said.note}]` : `[video ${seconds} s] ${said.transcript}`;
	return { text: `${head} frames: ${shown.map((frame) => `${frame.path} at ${tenth(frame.at)} s`).join(", ")} (${path})` };
}
