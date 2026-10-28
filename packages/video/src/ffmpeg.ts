import { join } from "node:path";
import type { Host, Ran } from "@arthur/core/plugin";

// The three ffmpeg steps of a video (AR0551), each killed after `limit` seconds: ffprobe reads its length and whether it has a
// sound track; ffmpeg takes its frames as PNG files, then its sound track as a 16 kHz mono WAV. docs/video.md.

type Run = Pick<Host, "jobs">;
// Why a step failed: the last line the tool printed on stderr, else its exit.
export type Failed = { readonly why: string };

const failed = (tool: string, ran: Ran): Failed => ({ why: ran.stderr.trim().split("\n").at(-1)?.trim() || `${tool} exited with code ${ran.code ?? "on a signal"}` });

// A scene change: a frame that differs this much (0 to 1) from the one before it.
const SCENE = 0.4;

// The video's length in seconds as ffprobe gives it, and whether it holds an audio stream.
export async function probe(host: Run, path: string, limit: number): Promise<{ readonly seconds: number; readonly sound: boolean } | Failed> {
	const ran = await host.jobs.run("local", ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", path], limit);
	if (ran.code !== 0) return failed("ffprobe", ran);
	const { streams = [], format = {} } = JSON.parse(ran.stdout) as { streams?: { codec_type?: string }[]; format?: { duration?: string } };
	const seconds = Number(format.duration);
	if (!Number.isFinite(seconds)) return { why: "ffprobe found no duration" };
	return { seconds, sound: streams.some((stream) => stream.codec_type === "audio") };
}

// The first frame, the first of each `every` seconds after it, and each scene change, at most `max`, in `folder` as
// frame-<n>.png; each with the second it shows, from ffmpeg's showinfo lines.
export async function frames(host: Run, path: string, folder: string, every: number, max: number, limit: number): Promise<{ readonly path: string; readonly at: number }[] | Failed> {
	const select = `select='isnan(prev_selected_t)+gte(floor(t/${every})-floor(prev_selected_t/${every}),1)+gt(scene,${SCENE})',showinfo`;
	const argv = ["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-loglevel", "info", "-y", "-i", path, "-an", "-vf", select, "-fps_mode", "vfr", "-frames:v", String(max), join(folder, "frame-%d.png")];
	const ran = await host.jobs.run("local", argv, limit);
	if (ran.code !== 0) return failed("ffmpeg", ran);
	return [...ran.stderr.matchAll(/\] n: *\d+ .*\bpts_time:(-?[\d.]+)/g)].map((match, index) => ({ path: join(folder, `frame-${index + 1}.png`), at: Number(match[1]) }));
}

// The video's first sound track as a 16 kHz mono WAV at `wav`, as whisper takes it.
export async function sound(host: Run, path: string, wav: string, limit: number): Promise<Failed | undefined> {
	const ran = await host.jobs.run("local", ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-vn", "-map", "0:a:0", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], limit);
	return ran.code === 0 ? undefined : failed("ffmpeg", ran);
}
