import type { Host } from "@arthur/core/plugin";

// What is said in a video's sound track (AR0551), asked of the listen plugin's `listen.transcribe` through the host.
// docs/video.md.

type Segment = { readonly start: number; readonly end: number; readonly text: string };

// Seconds to one decimal, as a video's line shows them.
export const tenth = (seconds: number): number => Math.round(seconds * 10) / 10;

// Each segment of `wav` as `(<start>-<end> s) <text>`, or why there is none: the note of the line's head.
export async function words(host: Pick<Host, "collect">, wav: string): Promise<{ readonly transcript: string } | { readonly note: string }> {
	try {
		const [asked] = host.collect<Promise<{ readonly segments: readonly Segment[] }>>("listen.transcribe", wav);
		if (asked === undefined) return { note: "not transcribed: the listen plugin is not enabled" };
		const { segments } = await asked;
		if (segments.length === 0) return { note: "no speech" };
		return { transcript: segments.map(({ start, end, text }) => `(${tenth(start)}-${tenth(end)} s) ${text}`).join(" ") };
	} catch (error) {
		// listen's own refusal names the WAV, which is removed: `<wav>: not transcribed: <why>`.
		return { note: `not transcribed: ${(error as Error).message.replace(`${wav}: `, "").replace(/^not transcribed: /, "")}` };
	}
}
