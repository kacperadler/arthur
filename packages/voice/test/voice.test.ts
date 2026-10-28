import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig } from "@arthur/core";
import { turnText } from "@arthur/core/parts";
import type { Part } from "@arthur/core/parts";
import type { Command } from "@arthur/core/plugin";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { voice } from "../src/voice.ts";
import { checkOptions } from "../src/voice-options.ts";

// The voice plugin against the fake host, with a fake `ffmpeg` and a fake `whisper-cli` on PATH that print and exit as the
// real ones do. A note's file is JSON that tells them what to do: its length, whisper's segments, a failure or a hang.
// docs/voice.md.

type Note = { readonly seconds: number; readonly segments?: readonly (readonly [number, number, string])[]; readonly ffmpeg?: string; readonly whisper?: string; readonly hang?: "ffmpeg" | "whisper"; readonly delayMs?: number };

// ffmpeg: `-i <note>`, the WAV last; writes a 16 kHz mono WAV of the note's length, the note in a chunk of its own before the
// data, as real ffmpeg writes a LIST chunk. whisper-cli: `-f <wav>`; prints each segment as whisper-cli does. Both log to calls.jsonl.
const FAKE = (tool: string) => `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2), log = (phase) => fs.appendFileSync(path.join(__dirname, "calls.jsonl"), JSON.stringify({ tool: ${JSON.stringify(tool)}, phase, args }) + "\\n");
const fail = (line, code) => { process.stderr.write(line + "\\n"); process.exit(code); };
log("start");
if (${JSON.stringify(tool)} === "ffmpeg") {
	const input = args[args.indexOf("-i") + 1];
	if (!fs.existsSync(input)) fail(input + ": No such file or directory", 1);
	const note = JSON.parse(fs.readFileSync(input, "utf8"));
	if (note.hang === "ffmpeg") setInterval(() => {}, 1000);
	else if (note.ffmpeg) fail(input + ": " + note.ffmpeg, 1);
	else {
		const chunk = (id, body) => Buffer.concat([Buffer.from(id), Buffer.from(Uint32Array.of(body.length).buffer), body, Buffer.alloc(body.length % 2)]);
		const fmt = Buffer.alloc(16); fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(1, 2); fmt.writeUInt32LE(16000, 4); fmt.writeUInt32LE(32000, 8); fmt.writeUInt16LE(2, 12); fmt.writeUInt16LE(16, 14);
		const body = Buffer.concat([Buffer.from("WAVE"), chunk("fmt ", fmt), chunk("note", Buffer.from(JSON.stringify(note))), chunk("data", Buffer.alloc(Math.round(note.seconds * 32000)))]);
		fs.writeFileSync(args.at(-1), Buffer.concat([Buffer.from("RIFF"), Buffer.from(Uint32Array.of(body.length).buffer), body]));
		log("end");
	}
} else {
	const text = fs.readFileSync(args[args.indexOf("-f") + 1], "latin1");
	const note = JSON.parse(text.slice(text.indexOf("note") + 8, text.indexOf("data")).replace(/\\0+$/, ""));
	const at = (s) => new Date(s * 1000).toISOString().slice(11, 23);
	if (note.hang === "whisper") setInterval(() => {}, 1000);
	else if (note.whisper) { process.stderr.write("whisper_init_from_file_with_params_no_state: failed to open model\\n"); fail(note.whisper, 3); }
	// A delay before the answer, so a second run started too early would show in calls.jsonl.
	else setTimeout(() => {
		process.stdout.write("\\n" + (note.segments ?? []).map(([s, e, t]) => "[" + at(s) + " --> " + at(e) + "]   " + t + "\\n").join(""));
		log("end");
	}, note.delayMs ?? 0);
}
`;

// A folder for PATH holding the fakes named in `tools`, its calls in `calls()`.
function fakes(tools: readonly string[] = ["ffmpeg", "whisper-cli"]) {
	const dir = temporaryFolder();
	for (const tool of tools) {
		writeFileSync(join(dir, tool), FAKE(tool));
		chmodSync(join(dir, tool), 0o755);
	}
	const calls = (): { tool: string; phase: string; args: string[] }[] => {
		try {
			return readFileSync(join(dir, "calls.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
		} catch {
			return [];
		}
	};
	return { dir, calls };
}

// The plugin set up with `options`, the model file in its folder and only `tools` on PATH.
async function load(options: Readonly<Record<string, unknown>> = {}, tools?: readonly string[], model = true) {
	const fake = fakeHost({ name: "voice", options });
	if (model) {
		mkdirSync(join(fake.host.folder, "models"));
		writeFileSync(join(fake.host.folder, "models", "ggml-medium.bin"), "model");
	}
	const bin = fakes(tools);
	await fake.setup(voice(options as never));
	const notes = temporaryFolder();
	let count = 0;
	const note = (content: Note) => {
		const path = join(notes, `note-${++count}.ogg`);
		writeFileSync(path, JSON.stringify(content));
		return path;
	};
	const part = (path: string, seconds?: number, kind: Part["kind"] = "voice"): Part => ({ kind, path, mime: "audio/ogg", ...(seconds === undefined ? {} : { seconds }) });
	const turn = (...parts: Part[]) => turnText(fake.host, 1, { channel: "telegram", parts });
	const wavs = () => readdirSync(fake.host.folder).filter((name) => name.endsWith(".wav"));
	return { fake, ...bin, note, part, turn, wavs };
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

const HELLO: Note = { seconds: 3, segments: [[0, 1.5, " Hello there."], [1.5, 3, " How are you?"]] };

test("options: the defaults hold with none given; each wrong one is refused naming it", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ model: "large-v3-turbo", threads: 8, language: "auto", timeoutSeconds: 1, maxSeconds: 1 }), []);
	assert.deepEqual(checkOptions({ model: "/srv/models/ggml-medium.bin", language: "yue" }), []);
	const paths = (options: Readonly<Record<string, unknown>>) => checkOptions(options).map((problem) => `${problem.path}: ${problem.problem}`);
	for (const key of ["threads", "timeoutSeconds", "maxSeconds"])
		for (const value of [0, -1, 1.5, "4"]) assert.deepEqual(paths({ [key]: value }), [`${key}: expected a positive whole number, got ${typeof value === "string" ? `"${value}"` : value}`]);
	for (const value of ["PL", "p", "polish", "", 2]) assert.equal(paths({ language: value }).length, 1, String(value));
	for (const value of ["models/ggml-medium.bin", "medium.bin", "../medium", "", 1]) assert.equal(paths({ model: value }).length, 1, String(value));
	assert.deepEqual(paths({ nope: 1 }), ["nope: unknown option; options: model, threads, language, timeoutSeconds, maxSeconds"]);
});

test("a voice note becomes [voice <seconds> s] <transcript> (<path>), with the model, threads and language; the WAV is removed", async () => {
	const { note, part, turn, calls, wavs, dir, fake } = await load({ threads: 2, language: "auto" });
	const path = note(HELLO);
	assert.equal(await onPath(dir, () => turn(part(path, 3))), `[voice 3 s] Hello there. How are you? (${path})`);
	const whisper = calls().find((call) => call.tool === "whisper-cli");
	assert.deepEqual(whisper?.args.slice(0, 7), ["-m", join(fake.host.folder, "models", "ggml-medium.bin"), "-t", "2", "-l", "auto", "-np"]);
	assert.deepEqual(wavs(), []);
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-replied"), []);
});

test("an audio part is claimed too; without the part's seconds, the WAV's length; other kinds are left alone", async () => {
	const { note, part, turn, dir } = await load();
	const path = note({ seconds: 4.4, segments: [[0, 4, "Music and words."]] });
	const photo: Part = { kind: "photo", path: "/m/p.jpg", mime: "image/jpeg" };
	assert.equal(await onPath(dir, () => turn(part(path, undefined, "audio"), photo)), `[audio 4 s] Music and words. (${path})\n[photo, image/jpeg] (/m/p.jpg)`);
});

test("an empty or silent note, no text or only [BLANK_AUDIO], is no speech", async () => {
	const { note, part, turn, dir } = await load();
	const [empty, blank] = [note({ seconds: 2 }), note({ seconds: 2, segments: [[0, 2, " [BLANK_AUDIO]"]] })];
	assert.equal(await onPath(dir, () => turn(part(empty, 2), part(blank, undefined, "audio"))), `[voice: no speech] (${empty})\n[audio: no speech] (${blank})`);
});

test("a note over maxSeconds is not transcribed: one line to the human, the path to the coordinator", async () => {
	const { note, part, turn, dir, calls, fake, wavs } = await load({ maxSeconds: 5 });
	const [given, measured] = [note(HELLO), note({ ...HELLO, seconds: 7 })];
	assert.equal(await onPath(dir, () => turn(part(given, 6))), `[voice 6 s: not transcribed: over maxSeconds] (${given})`);
	assert.deepEqual(calls(), [], "nothing runs when the part's seconds are over");
	assert.equal(await onPath(dir, () => turn(part(measured, undefined, "audio"))), `[audio 7 s: not transcribed: over maxSeconds] (${measured})`);
	assert.deepEqual(calls().map((call) => call.tool), ["ffmpeg", "ffmpeg"], "whisper never runs");
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => (event.data as { text: string }).text), ["voice note of 6 s is over maxSeconds 5; not transcribed", "audio of 7 s is over maxSeconds 5; not transcribed"]);
	assert.equal(await onPath(dir, () => turn(part(note(HELLO), 5))).then((line) => line.startsWith("[voice 5 s] Hello")), true, "exactly maxSeconds is transcribed");
	assert.deepEqual(wavs(), []);
});

test("ffmpeg or whisper failing, or a run past timeoutSeconds, gives why; the queue goes on", async () => {
	const { note, part, turn, dir, wavs } = await load({ timeoutSeconds: 1 });
	const [bad, broken, hung, slow, fine] = [note({ ...HELLO, ffmpeg: "Invalid data found when processing input" }), note({ ...HELLO, whisper: "error: failed to initialize whisper context" }), note({ ...HELLO, hang: "whisper" }), note({ ...HELLO, hang: "ffmpeg" }), note(HELLO)];
	assert.equal(
		await onPath(dir, () => turn(part(bad, 3), part(broken, 3), part(hung), part(slow, 3), part(fine, 3))),
		[
			`[voice 3 s: not transcribed: ${bad}: Invalid data found when processing input] (${bad})`,
			`[voice 3 s: not transcribed: error: failed to initialize whisper context] (${broken})`,
			`[voice 3 s: not transcribed: timed out after 1 s] (${hung})`,
			`[voice 3 s: not transcribed: timed out after 1 s] (${slow})`,
			`[voice 3 s] Hello there. How are you? (${fine})`,
		].join("\n"),
	);
	assert.deepEqual(wavs(), []);
});

test("two notes at once, from two messages, are transcribed one after the other in the order they came", async () => {
	const { note, part, turn, dir, calls } = await load();
	const [first, second, third] = [note({ ...HELLO, delayMs: 300 }), note(HELLO), note({ ...HELLO, delayMs: 100 })];
	const [one, two] = await onPath(dir, () => Promise.all([turn(part(first, 3), part(second, 3)), turn(part(third, 3))]));
	assert.equal(one, `[voice 3 s] Hello there. How are you? (${first})\n[voice 3 s] Hello there. How are you? (${second})`);
	assert.equal(two, `[voice 3 s] Hello there. How are you? (${third})`);
	const whisper = calls().filter((call) => call.tool === "whisper-cli");
	assert.deepEqual(whisper.map((call) => call.phase), ["start", "end", "start", "end", "start", "end"], "never two at once");
	const ffmpeg = calls().filter((call) => call.tool === "ffmpeg" && call.phase === "start").map((call) => call.args[call.args.indexOf("-i") + 1]);
	assert.deepEqual(ffmpeg, [first, third, second], "the queue's order: the first message's first part, the second message's, then the first's second");
});

test("whisper-cli, the model or ffmpeg missing: nothing runs, the note goes on as a path naming arthur doctor", async () => {
	for (const [tools, model, what] of [[["ffmpeg"], true, "whisper-cli"], [["ffmpeg", "whisper-cli"], false, "model"], [["whisper-cli"], true, "ffmpeg"]] as const) {
		const { note, part, turn, dir, calls, fake } = await load({}, tools, model);
		const path = note(HELLO);
		const named = what === "model" ? `model ${join(fake.host.folder, "models", "ggml-medium.bin")}` : what;
		assert.equal(await onPath(dir, () => turn(part(path, 3))), `[voice 3 s: not transcribed: ${named} missing; see arthur doctor] (${path})`);
		assert.equal(await onPath(dir, () => turn(part(path))), `[voice: not transcribed: ${named} missing; see arthur doctor] (${path})`);
		assert.deepEqual(calls(), []);
	}
});

test("arthur doctor names each requirement, none critical, with the model in the home's voice folder or at its path", async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), "export default {};\n");
	const core = (await loadConfig(join(folder, "arthur.config.ts"))).core;
	const { dir } = fakes(["whisper-cli"]);
	const lines = await onPath(dir, async () => Promise.all(((await voice().doctor?.({}, core)) ?? []).map(async (need) => `${need.name}: ${await need.check()}; critical ${need.critical}; ${need.costs}`)));
	const costs = "voice notes and audio files reach the coordinator as paths, and arthur transcribe refuses";
	assert.deepEqual(lines, [`whisper-cli: ok; critical false; ${costs}`, `whisper model: missing: no file ${join(core.home, "voice", "models", "ggml-medium.bin")}; critical false; ${costs}`, `ffmpeg: missing: ffmpeg not found on PATH; critical false; ${costs}`]);
	const own = join(folder, "own.bin");
	writeFileSync(own, "model");
	assert.equal(await (await voice().doctor?.({ model: own }, core))?.[1]?.check(), "ok");
});

test("voice.transcribe: through the host, a file's transcript and its segments in seconds; each refusal an error", async () => {
	const { note, dir, fake } = await load({ maxSeconds: 5 });
	const transcribe = (path: string, bin = dir) => onPath(bin, () => fake.call<Promise<unknown>>("voice.transcribe", path));
	const path = note(HELLO);
	assert.deepEqual(await transcribe(path), { seconds: 3, text: "Hello there. How are you?", segments: [{ start: 0, end: 1.5, text: "Hello there." }, { start: 1.5, end: 3, text: "How are you?" }] });
	const long = note({ ...HELLO, seconds: 6 });
	await assert.rejects(transcribe(long), { message: `${long}: audio of 6 s is over maxSeconds 5; not transcribed` });
	await assert.rejects(transcribe("/no/such.ogg"), { message: "/no/such.ogg: not transcribed: no file /no/such.ogg" });
	await assert.rejects(transcribe(""), { message: 'voice.transcribe: expected a file\'s path, got ""' });
	await assert.rejects(transcribe(path, temporaryFolder()), { message: `${path}: not transcribed: whisper-cli missing; see arthur doctor` });
});

// `arthur transcribe` of a plugin loaded by `load`, run with its fakes on PATH: its exit code, then each line it printed, `! ` before stderr's.
async function cli(loaded: { readonly fake: FakeHost; readonly dir: string }, ...args: string[]): Promise<unknown[]> {
	const command = loaded.fake.commands.find((each) => each.name === "transcribe") as Command;
	return onPath(loaded.dir, async () => {
		const printed: string[] = [];
		const [log, error] = [console.log, console.error];
		console.log = (line: string) => void printed.push(line);
		console.error = (line: string) => void printed.push(`! ${line}`);
		try {
			return [await command.run({ args, project: undefined }), ...printed];
		} finally {
			[console.log, console.error] = [log, error];
		}
	});
}

test("arthur transcribe prints the transcript, with --times a segment a line; refusals and wrong arguments", async () => {
	const loaded = await load({ maxSeconds: 5 });
	const path = loaded.note(HELLO);
	assert.deepEqual(await cli(loaded, path), [0, "Hello there. How are you?"]);
	assert.deepEqual(await cli(loaded, path, "--times"), [0, "0.00 1.50 Hello there.", "1.50 3.00 How are you?"]);
	assert.deepEqual(await cli(loaded, loaded.note({ seconds: 2 }), "--times"), [0, "[no speech in 2 s]"]);
	assert.deepEqual(await cli(loaded, "/no/such.ogg"), [1, "! refused: /no/such.ogg: not transcribed: no file /no/such.ogg"]);
	const long = loaded.note({ ...HELLO, seconds: 6 });
	assert.deepEqual(await cli(loaded, long), [1, `! refused: ${long}: audio of 6 s is over maxSeconds 5; not transcribed`]);
	assert.deepEqual(await cli(loaded), [2, "! usage: arthur transcribe <file> [--times]"]);
	assert.deepEqual(await cli(loaded, path, path), [2, "! usage: arthur transcribe <file> [--times]"]);
	assert.equal((await cli(loaded, path, "--nope"))[0], 2);
});

test("arthur transcribe refuses while whisper-cli, the model or ffmpeg is missing, naming arthur doctor", async () => {
	for (const [tools, model, what] of [[["ffmpeg"], true, "whisper-cli"], [["ffmpeg", "whisper-cli"], false, "model"], [["whisper-cli"], true, "ffmpeg"]] as const) {
		const loaded = await load({}, tools, model);
		const path = loaded.note(HELLO);
		const named = what === "model" ? `model ${join(loaded.fake.host.folder, "models", "ggml-medium.bin")}` : what;
		assert.deepEqual(await cli(loaded, path), [1, `! refused: ${path}: not transcribed: ${named} missing; see arthur doctor`]);
		assert.deepEqual(loaded.calls(), []);
	}
});
