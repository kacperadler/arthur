import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { turnText } from "@arthur/core/parts";
import type { Part } from "@arthur/core/parts";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { video } from "../src/video.ts";
import { videoOptions } from "../src/video-options.ts";

// The video plugin against the fake host, with a fake `ffprobe` and `ffmpeg` on PATH that print and exit as the real ones do,
// and the test as the voice plugin, answering `voice.transcribe`. A video's file is JSON that tells the fakes what it holds:
// its length, a sound track, its scene changes, a step that fails or hangs. docs/video.md.

type Step = "probe" | "frames" | "sound";
type Clip = { readonly seconds?: number; readonly sound?: boolean; readonly scenes?: readonly number[]; readonly fail?: Partial<Record<Step, string>>; readonly hang?: Step };

// ffprobe: its JSON as `-show_entries format=duration:stream=codec_type -of json` prints it. ffmpeg with `-vf`: the frames its
// select keeps (the first of each `floor(t/<every>)` step, each scene change), at most `-frames:v`, a PNG each and a showinfo
// line each on stderr; with `-map 0:a:0`: the WAV, or "matches no streams" without a sound track. Each logs to calls.jsonl.
const FAKE = (tool: string) => `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
const fail = (line, code) => { process.stderr.write(line + "\\n"); process.exit(code); };
const input = ${JSON.stringify(tool)} === "ffprobe" ? args.at(-1) : args[args.indexOf("-i") + 1];
const step = ${JSON.stringify(tool)} === "ffprobe" ? "probe" : args.includes("-vf") ? "frames" : "sound";
fs.appendFileSync(path.join(__dirname, "calls.jsonl"), JSON.stringify({ tool: ${JSON.stringify(tool)}, step, args }) + "\\n");
if (!fs.existsSync(input)) fail(input + ": No such file or directory", 1);
const clip = JSON.parse(fs.readFileSync(input, "utf8"));
// A hang is real: the plugin's timeoutSeconds kills the fake through the host's own runner, which a fake clock does not drive.
if (clip.hang === step) setInterval(() => {}, 1000);
else if (step === "probe") {
	if (clip.fail?.probe !== undefined) fail(clip.fail.probe, 1);
	const streams = [{ codec_type: "video" }, ...(clip.sound ? [{ codec_type: "audio" }] : [])];
	process.stdout.write(JSON.stringify({ programs: [], streams, format: clip.seconds === undefined ? {} : { duration: clip.seconds.toFixed(6) } }, null, 4) + "\\n");
} else if (step === "frames") {
	if (clip.fail?.frames !== undefined) { fs.writeFileSync(args.at(-1).replace("%d", "1"), "half"); fail(clip.fail.frames, 1); }
	const every = Number(/floor\\(t\\/(\\d+)\\)/.exec(args[args.indexOf("-vf") + 1])[1]);
	const max = args.includes("-frames:v") ? Number(args[args.indexOf("-frames:v") + 1]) : Infinity;
	const grid = Array.from({ length: Math.ceil(clip.seconds / every) }, (_, n) => n * every);
	const scenes = /gt\\(scene,[\\d.]+\\)/.test(args[args.indexOf("-vf") + 1]) ? (clip.scenes ?? []) : [];
	const times = [...new Set([...grid, ...scenes])].sort((a, b) => a - b).slice(0, max);
	process.stderr.write("Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '" + input + "':\\n  Duration: 00:00:12.00, start: 0.000000, bitrate: 52 kb/s\\n");
	times.forEach((at, n) => {
		fs.writeFileSync(args.at(-1).replace("%d", String(n + 1)), "png");
		process.stderr.write("[Parsed_showinfo_1 @ 0x64b0cbeda900] n:" + String(n).padStart(4) + " pts:" + String(at * 10240).padStart(7) + " pts_time:" + at + "       duration:   1024 duration_time:0.1     fmt:rgb24 cl:left sar:1/1 s:320x240 i:P iskey:0 type:P checksum:2BC94BD5 plane_checksum:[2BC94BD5] mean:[127] stdev:[71.4]\\n");
		process.stderr.write("[Parsed_showinfo_1 @ 0x64b0cbeda900] color_range:pc color_space:gbr color_primaries:unknown color_trc:unknown\\n");
	});
	process.stderr.write("[out#0/image2 @ 0x64b0cb665f40] video:31kB audio:0kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: unknown\\nframe=    " + times.length + " fps=0.0 q=-0.0 Lsize=N/A time=00:00:05.00 bitrate=N/A speed= 172x\\n");
} else {
	if (!clip.sound) fail("Stream map '0:a:0' matches no streams.\\nTo ignore this, add a trailing '?' to the map.", 234);
	fs.writeFileSync(args.at(-1), "RIFF");
	if (clip.fail?.sound !== undefined) fail(clip.fail.sound, 1);
}
`;

// A folder for PATH holding the fakes named in `tools`, its calls in `calls()`.
function fakes(tools: readonly string[] = ["ffprobe", "ffmpeg"]) {
	const dir = temporaryFolder();
	for (const tool of tools) {
		writeFileSync(join(dir, tool), FAKE(tool));
		chmodSync(join(dir, tool), 0o755);
	}
	const calls = (): { tool: string; step: Step; args: string[] }[] =>
		existsSync(join(dir, "calls.jsonl")) ? readFileSync(join(dir, "calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
	return { dir, calls };
}

// What the test, as the voice plugin, answers `voice.transcribe`: its answer, or the error it rejects with; null, no voice plugin.
type Voice = ((wav: string) => { readonly seconds: number; readonly text: string; readonly segments: readonly { readonly start: number; readonly end: number; readonly text: string }[] } | Error) | null;

const HELLO: Voice = () => ({ seconds: 12, text: "Hello there. How are you?", segments: [{ start: 0, end: 1.46, text: "Hello there." }, { start: 1.46, end: 3, text: "How are you?" }] });

// The plugin set up with `options`, only `tools` on PATH, and `voice` answering `voice.transcribe` when given.
async function load(options: Readonly<Record<string, unknown>> = {}, voice: Voice = HELLO, tools?: readonly string[]) {
	const fake = fakeHost({ name: "video", options });
	const asked: { wav: string; there: boolean }[] = [];
	if (voice !== null)
		fake.provide("voice.transcribe", async (wav: string) => {
			asked.push({ wav, there: existsSync(wav) });
			const answer = voice(wav);
			if (answer instanceof Error) throw answer;
			return answer;
		});
	await fake.setup(video(options as never));
	const bin = fakes(tools);
	const clips = temporaryFolder();
	let count = 0;
	const clip = (content: Clip) => {
		const path = join(clips, `video-${++count}.mp4`);
		writeFileSync(path, JSON.stringify(content));
		return path;
	};
	const part = (path: string, seconds?: number, kind: Part["kind"] = "video"): Part => ({ kind, path, mime: "video/mp4", ...(seconds === undefined ? {} : { seconds }) });
	const turn = (...parts: Part[]) => onPath(bin.dir, () => turnText(fake.host, 1, { channel: "telegram", parts }));
	// Every file the plugin left in its folder, by its path there.
	const files = () => readdirSync(fake.host.folder, { recursive: true, encoding: "utf8" }).filter((name) => name.includes(".")).sort();
	const replies = () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => (event.data as { text: string }).text);
	return { fake, ...bin, asked, clip, part, turn, files, replies };
}

// Runs `fn` with only `dir` on PATH: the fakes start node by its absolute path.
async function onPath<T>(dir: string, fn: () => Promise<T>): Promise<T> {
	const PATH = process.env.PATH;
	process.env.PATH = dir;
	try {
		return await fn();
	} finally {
		process.env.PATH = PATH;
	}
}

// The frames of a line, `<path> at <s> s`, as the plugin names them in its folder.
const framesOf = (line: string) => [...line.matchAll(/ (\S+\.png) at ([\d.]+) s/g)].map(([, path = "", at]) => `${path.split("/").at(-1)} at ${at}`);

test("options: the defaults hold with none given, 1 is the least; each other one is refused at load, naming it", () => {
	const check = (options: Readonly<Record<string, unknown>>) => (video().check?.(options, undefined as never) ?? []).map((problem) => `${problem.path}: ${problem.problem}`);
	assert.deepEqual(check({}), []);
	assert.deepEqual(check({ everySeconds: 1, maxFrames: 1, maxSeconds: 1, timeoutSeconds: 1 }), []);
	for (const key of ["everySeconds", "maxFrames", "maxSeconds", "timeoutSeconds"])
		for (const value of [0, -1, 1.5, "5", null]) assert.deepEqual(check({ [key]: value }), [`${key}: expected a positive whole number, got ${typeof value === "string" ? `"${value}"` : value}`]);
	assert.deepEqual(check({ nope: 1 }), ["nope: unknown option; options: everySeconds, maxFrames, maxSeconds, timeoutSeconds"]);
	assert.deepEqual(check({ maxFrames: undefined }), [], "an option left undefined is left out");
	assert.deepEqual(videoOptions({ maxFrames: undefined }), { everySeconds: 5, maxFrames: 12, maxSeconds: 600, timeoutSeconds: 300 }, "the defaults docs/video.md gives");
});

test("a video becomes [video <seconds> s] <transcript> frames: <path at s>, ... (<path>); the WAV goes, the frames stay", async () => {
	const { clip, part, turn, calls, asked, files, fake, replies } = await load();
	const path = clip({ seconds: 12.4, sound: true });
	const line = await turn(part(path));
	const folder = dirname(asked[0]?.wav ?? "");
	const frame = (n: number) => join(folder, `frame-${n}.png`);
	assert.equal(line, `[video 12 s] (0-1.5 s) Hello there. (1.5-3 s) How are you? frames: ${frame(1)} at 0 s, ${frame(2)} at 5 s, ${frame(3)} at 10 s (${path})`);
	assert.equal(dirname(folder), fake.host.folder, "everything the plugin writes is in its own folder");
	assert.deepEqual(asked, [{ wav: join(folder, "sound.wav"), there: true }], "voice.transcribe gets the WAV through the host, while it is there");
	assert.deepEqual(files(), [1, 2, 3].map((n) => join(folder.split("/").at(-1) ?? "", `frame-${n}.png`)));
	const sound = calls().find((call) => call.step === "sound")?.args;
	assert.deepEqual(sound?.slice(sound.indexOf("-map"), -1), ["-map", "0:a:0", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le"]);
	assert.deepEqual(calls().map((call) => (call.step === "probe" ? call.args.at(-1) : call.args[call.args.indexOf("-i") + 1])), [path, path, path], "it reads only the file the part names");
	assert.deepEqual(replies(), []);
	assert.equal((await turn(part(clip({ seconds: 12.4, sound: true }), 9.6))).startsWith("[video 10 s] "), true, "the part's seconds, rounded, before ffprobe's");
});

test("frames at each everySeconds step and at scene changes, at most maxFrames, each at its second to a tenth", async () => {
	for (const [options, shown] of [
		[{}, ["frame-1.png at 0", "frame-2.png at 5", "frame-3.png at 7.3", "frame-4.png at 10", "frame-5.png at 15", "frame-6.png at 20"]],
		[{ everySeconds: 10, maxFrames: 3 }, ["frame-1.png at 0", "frame-2.png at 7.3", "frame-3.png at 10"]],
		[{ everySeconds: 10, maxFrames: 4 }, ["frame-1.png at 0", "frame-2.png at 7.3", "frame-3.png at 10", "frame-4.png at 20"]],
		[{ maxFrames: 1 }, ["frame-1.png at 0"]],
	] as const) {
		const { clip, part, turn, calls } = await load(options);
		assert.deepEqual(framesOf(await turn(part(clip({ seconds: 24, scenes: [7.26] })))), shown, JSON.stringify(options));
		const args = calls().find((call) => call.step === "frames")?.args ?? [];
		assert.equal(args[args.indexOf("-frames:v") + 1], String("maxFrames" in options ? options.maxFrames : 12));
	}
	const { clip, part, turn } = await load({ maxFrames: 12 });
	assert.equal(framesOf(await turn(part(clip({ seconds: 60 })))).length, 12, "exactly maxFrames when the video holds more");
});

test("a video with no sound track: its frames and no sound; ffmpeg takes no WAV and the voice plugin is not asked", async () => {
	const { clip, part, turn, calls, asked } = await load();
	const path = clip({ seconds: 7 });
	assert.deepEqual((await turn(part(path))).replace(/ frames: .*/, ""), "[video 7 s: no sound]");
	assert.deepEqual(framesOf(await turn(part(path))), ["frame-1.png at 0", "frame-2.png at 5"]);
	assert.deepEqual([calls().filter((call) => call.step === "sound"), asked], [[], []]);
});

test("the voice plugin not enabled, failing or hearing nothing: the frames, and why there are no words; the WAV goes", async () => {
	const cases: readonly (readonly [Voice, string])[] = [
		[null, "not transcribed: the voice plugin is not enabled"],
		[(wav) => new Error(`${wav}: not transcribed: whisper-cli missing; see arthur doctor`), "not transcribed: whisper-cli missing; see arthur doctor"],
		[(wav) => new Error(`${wav}: audio of 12 s is over maxSeconds 5; not transcribed`), "not transcribed: audio of 12 s is over maxSeconds 5; not transcribed"],
		[() => ({ seconds: 12, text: "", segments: [] }), "no speech"],
	];
	for (const [voice, why] of cases) {
		const { clip, part, turn, files } = await load({}, voice);
		const line = await turn(part(clip({ seconds: 12, sound: true })));
		assert.equal(line.replace(/ frames: .*/, ""), `[video 12 s: ${why}]`);
		assert.deepEqual(framesOf(line), ["frame-1.png at 0", "frame-2.png at 5", "frame-3.png at 10"]);
		assert.deepEqual(files().map((file) => file.split("/").at(-1)), ["frame-1.png", "frame-2.png", "frame-3.png"], "the frames stay, the WAV is gone");
	}
});

test("ffmpeg failing on the sound track or past timeoutSeconds: the frames, and why; the half-written WAV goes and the voice plugin is not asked", async () => {
	const { clip, part, turn, files, asked } = await load({ timeoutSeconds: 1 });
	const line = await turn(part(clip({ seconds: 12, sound: true, fail: { sound: "Error while decoding stream #0:1: Invalid data found when processing input" } })), part(clip({ seconds: 12, sound: true, hang: "sound" })));
	assert.deepEqual(
		line.split("\n").map((each) => each.replace(/ frames: .*/, "")),
		["[video 12 s: not transcribed: Error while decoding stream #0:1: Invalid data found when processing input]", "[video 12 s: not transcribed: timed out after 1 s]"],
	);
	assert.deepEqual([files().filter((file) => file.endsWith(".png")).length, files().length, asked], [6, 6, []]);
});

test("a video over maxSeconds is not cut: one line to the human, the path to the coordinator; exactly maxSeconds is cut", async () => {
	const { clip, part, turn, calls, files, replies } = await load({ maxSeconds: 5 });
	const [given, probed] = [clip({ seconds: 4, sound: true }), clip({ seconds: 6, sound: true })];
	assert.equal(await turn(part(given, 6)), `[video 6 s: not cut: over maxSeconds] (${given})`);
	assert.deepEqual(calls(), [], "nothing runs when the part's seconds are over");
	assert.equal(await turn(part(probed)), `[video 6 s: not cut: over maxSeconds] (${probed})`);
	assert.deepEqual(calls().map((call) => call.step), ["probe"], "only ffprobe runs");
	assert.deepEqual([files(), replies()], [[], ["video of 6 s is over maxSeconds 5; not cut", "video of 6 s is over maxSeconds 5; not cut"]]);
	assert.equal((await turn(part(clip({ seconds: 5, sound: true })))).startsWith("[video 5 s] (0-1.5 s) Hello"), true, "exactly maxSeconds, measured");
	assert.equal((await turn(part(given, 5))).startsWith("[video 5 s] (0-1.5 s) Hello"), true, "exactly maxSeconds, given");
});

test("ffmpeg or ffprobe missing: nothing runs, the part goes on as its path naming arthur doctor", async () => {
	for (const tool of ["ffmpeg", "ffprobe"]) {
		for (const tools of [[tool === "ffmpeg" ? "ffprobe" : "ffmpeg"], ["ffprobe", "ffmpeg"]]) {
			const { clip, part, turn, calls, dir } = await load({}, HELLO, tools);
			if (tools.length === 2) chmodSync(join(dir, tool), 0o644);
			if (tools.length === 1) mkdirSync(join(dir, tool));
			const path = clip({ seconds: 12, sound: true });
			assert.equal(await turn(part(path, 12)), `[video 12 s: not cut: ${tool} missing; see arthur doctor] (${path})`);
			assert.equal(await turn(part(path)), `[video: not cut: ${tool} missing; see arthur doctor] (${path})`);
			assert.deepEqual(calls(), []);
		}
	}
});

test("ffprobe or ffmpeg failing or past timeoutSeconds: the path with why, naming arthur doctor, and no file left", async () => {
	const { clip, part, turn, files } = await load({ timeoutSeconds: 1 });
	const clips = [
		clip({ seconds: 12, fail: { probe: "moov atom not found\nvideo.mp4: Invalid data found when processing input" } }),
		clip({}),
		clip({ seconds: 12, hang: "probe" }),
		clip({ seconds: 12, fail: { frames: "Error opening output files: Invalid argument" } }),
		clip({ seconds: 12, fail: { frames: "" } }),
		clip({ seconds: 12, hang: "frames" }),
	];
	assert.deepEqual((await turn(...clips.map((path) => part(path)))).split("\n"), [
		`[video: not cut: video.mp4: Invalid data found when processing input; see arthur doctor] (${clips[0]})`,
		`[video: not cut: ffprobe found no duration; see arthur doctor] (${clips[1]})`,
		`[video: not cut: timed out after 1 s; see arthur doctor] (${clips[2]})`,
		`[video 12 s: not cut: Error opening output files: Invalid argument; see arthur doctor] (${clips[3]})`,
		`[video 12 s: not cut: ffmpeg exited with code 1; see arthur doctor] (${clips[4]})`,
		`[video 12 s: not cut: timed out after 1 s; see arthur doctor] (${clips[5]})`,
	]);
	assert.deepEqual(files(), []);
	assert.deepEqual(clips.filter((path) => !existsSync(path)), [], "the videos stay where the channel saved them");
});

test("other kinds of part, and a part without its file, are left alone; an option left undefined is at its default", async () => {
	const { clip, part, turn, calls, fake } = await load({ maxFrames: undefined });
	const path = clip({ seconds: 12, sound: true });
	assert.equal(await turn(part(path, undefined, "photo")), `[photo, video/mp4] (${path})`);
	assert.deepEqual(fake.collect("message.part", { kind: "video", mime: "video/mp4" }), [undefined]);
	assert.deepEqual(calls(), []);
	assert.equal(framesOf(await turn(part(clip({ seconds: 120 })))).length, 12);
});

test("arthur doctor: ffmpeg on PATH with its ffprobe, not critical", async () => {
	const doctor = async (tools: readonly string[]) => {
		const [need] = (await video().doctor?.({}, undefined as never)) ?? [];
		return onPath(fakes(tools).dir, async () => `${need?.name}: ${await need?.check()}; critical ${need?.critical}; ${need?.costs}; ${need?.fix}`);
	};
	const rest = "critical false; videos reach the coordinator as paths, without their frames or words; sudo apt-get install -y ffmpeg";
	assert.equal(await doctor(["ffmpeg", "ffprobe"]), `ffmpeg: ok; ${rest}`);
	assert.equal(await doctor(["ffmpeg"]), `ffmpeg: missing: ffprobe not found on PATH; ${rest}`);
	assert.equal(await doctor([]), `ffmpeg: missing: ffmpeg and ffprobe not found on PATH; ${rest}`);
});
