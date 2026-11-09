import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig } from "@arthur/core";
import type { Command } from "@arthur/core/plugin";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { speak } from "../src/speak.ts";
import { checkOptions } from "../src/speak-options.ts";

// The speak plugin against the fake host, with a fake `piper` and a fake `ffmpeg` on PATH that print and exit as the real ones
// do. The text tells them what to do: a word `piper-fails`, `ffmpeg-fails`, `piper-hangs` or `ffmpeg-hangs`. docs/speak.md.

// piper: `--model <onnx> --output_file <wav>`, the text on stdin; writes the WAV as `<model>|<text>`. ffmpeg: `-i <wav>`, the
// OGG last; writes `ogg:` and the WAV's bytes. Both log to calls.jsonl.
const FAKE = (tool: string) => `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2), log = (phase, more) => fs.appendFileSync(path.join(__dirname, "calls.jsonl"), JSON.stringify({ tool: ${JSON.stringify(tool)}, phase, args, ...more }) + "\\n");
const fail = (line, code) => { process.stderr.write("a line before\\n" + line + "\\n"); process.exit(code); };
if (${JSON.stringify(tool)} === "piper") {
	const text = fs.readFileSync(0, "utf8");
	log("start", { stdin: text });
	if (text.includes("piper-hangs")) setInterval(() => {}, 1000);
	else if (text.includes("piper-fails")) fail("ValueError: Unable to find voice", 1);
	// A delay before the answer, so a second run started too early would show in calls.jsonl.
	else setTimeout(() => { fs.writeFileSync(args[args.indexOf("--output_file") + 1], args[args.indexOf("--model") + 1] + "|" + text); log("end"); }, text.includes("slow") ? 300 : 0);
} else {
	log("start");
	const wav = fs.readFileSync(args[args.indexOf("-i") + 1], "utf8");
	if (wav.includes("ffmpeg-hangs")) setInterval(() => {}, 1000);
	else if (wav.includes("ffmpeg-fails")) fail("Unknown encoder 'libopus'", 8);
	else { fs.writeFileSync(args.at(-1), "ogg:" + wav); log("end"); }
}
`;

const VOICES = ["pl_PL-gosia-medium", "en_US-lessac-medium"];

// A folder for PATH holding the fakes named in `tools`, its calls in `calls()`.
function fakes(tools: readonly string[] = ["piper", "ffmpeg"]) {
	const dir = temporaryFolder();
	for (const tool of tools) {
		writeFileSync(join(dir, tool), FAKE(tool));
		chmodSync(join(dir, tool), 0o755);
	}
	const calls = (): { tool: string; phase: string; args: string[]; stdin?: string }[] =>
		existsSync(join(dir, "calls.jsonl")) ? readFileSync(join(dir, "calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
	return { dir, calls };
}

// The plugin set up with `options`, the default voices and their configs in its folder and only `tools` on PATH.
async function load(options: Readonly<Record<string, unknown>> = {}, tools?: readonly string[]) {
	const fake = fakeHost({ name: "speak", options });
	mkdirSync(join(fake.host.folder, "voices"));
	for (const voice of VOICES) for (const file of [`${voice}.onnx`, `${voice}.onnx.json`]) writeFileSync(join(fake.host.folder, "voices", file), "voice");
	const bin = fakes(tools);
	await fake.setup(speak(options as never));
	const asked = (text: unknown) => fake.call<Promise<string>>("speak.say", text);
	// One text, or with `all` several at once, asked with the fakes on PATH.
	const say = (text: unknown) => onPath(bin.dir, () => asked(text));
	const all = (texts: readonly string[]) => onPath(bin.dir, () => Promise.all(texts.map((text) => asked(text).then((path) => path.endsWith(".ogg"), (error: Error) => error.message))));
	const left = () => readdirSync(fake.host.folder).filter((name) => name !== "voices").sort();
	return { fake, ...bin, say, all, left };
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

test("options: the defaults hold with none given; each wrong one is refused naming it", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ voices: { pl: "pl_PL-darkman-medium", en: "/srv/voices/en.onnx" }, maxChars: 1, timeoutSeconds: 1 }), []);
	assert.deepEqual(checkOptions({ voices: { en: "en_GB-alan-low" } }), []);
	const paths = (options: Readonly<Record<string, unknown>>) => checkOptions(options).map((problem) => `${problem.path}: ${problem.problem}`);
	for (const key of ["maxChars", "timeoutSeconds"])
		for (const value of [0, -1, 1.5, "4"]) assert.deepEqual(paths({ [key]: value }), [`${key}: expected a positive whole number, got ${typeof value === "string" ? `"${value}"` : value}`]);
	const voices = "voices: expected a record of pl, en or both, each a Piper voice name such as pl_PL-gosia-medium or the absolute path of a .onnx file, got";
	for (const value of [{}, { de: "de_DE-thorsten-medium" }, { pl: "pl.onnx" }, { pl: "voices/pl" }, { pl: "/srv/pl.bin" }, { pl: "" }, { pl: 1 }, [], "pl_PL-gosia-medium", null])
		assert.ok(paths({ voices: value })[0]?.startsWith(voices), JSON.stringify(value));
	assert.deepEqual(paths({ nope: 1 }), ["nope: unknown option; options: voices, maxChars, timeoutSeconds"]);
});

test("speak.say: a Polish text by the Polish voice, any other by the English one, into an OGG/Opus file in the plugin's folder; the WAV is removed", async () => {
	const { say, calls, fake, left } = await load();
	const voice = (name: string) => join(fake.host.folder, "voices", `${name}.onnx`);
	const texts = ["Zrobione, AR0081 już scalone.", "Tak, gotowe", "TERAZ", "Done: AR0081 merged.", "Teraźniejszość", "Not now; takes time"];
	const paths = [];
	for (const text of texts) paths.push(await say(text));
	assert.deepEqual(paths.map((path) => readFileSync(path, "utf8")), texts.map((text, at) => `ogg:${voice(VOICES[[0, 0, 0, 1, 0, 1][at] ?? 0] ?? "")}|${text}\n`));
	assert.ok(paths.every((path) => path.startsWith(join(fake.host.folder, "")) && path.endsWith(".ogg")));
	assert.deepEqual(left(), paths.map((path) => path.split("/").at(-1)).sort(), "only the voice notes stay");
	const [piper, ffmpeg] = calls().filter((call) => call.phase === "start");
	assert.deepEqual(piper?.args, ["--model", voice(VOICES[0] ?? ""), "--output_file", paths[0]?.replace(/\.ogg$/, ".wav")]);
	assert.equal(piper?.stdin, "Zrobione, AR0081 już scalone.\n");
	assert.deepEqual(ffmpeg?.args, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", paths[0]?.replace(/\.ogg$/, ".wav"), "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", paths[0]]);
	const own = join(temporaryFolder(), "own.onnx");
	writeFileSync(own, "voice");
	writeFileSync(`${own}.json`, "config");
	const loaded = await load({ voices: { en: own } });
	assert.equal(readFileSync(await loaded.say("Hello."), "utf8"), `ogg:${own}|Hello.\n`, "a voice given by its path is used where it is");
});

test("speak.say refuses before anything runs: a text over maxChars, an empty one, one in a language without a voice, anything but a text", async () => {
	const { say, calls, left } = await load({ maxChars: 10, voices: { en: VOICES[1] } });
	await assert.rejects(say("a".repeat(11)), { message: "the text has 11 characters, over maxChars 10" });
	await assert.rejects(say(" \n "), { message: "the text is empty" });
	await assert.rejects(say("Tak."), { message: "no voice for pl in voices" });
	await assert.rejects(say(5), { message: "speak.say: expected a text, got 5" });
	await assert.rejects(say(undefined), { message: "speak.say: expected a text, got undefined" });
	assert.deepEqual(calls(), []);
	assert.ok((await say("a".repeat(10))).endsWith(".ogg"), "exactly maxChars is spoken");
	assert.equal(left().length, 1);
});

test("piper or ffmpeg failing, or a run past timeoutSeconds, rejects naming the tool and why, leaves no file, and the queue goes on", async () => {
	const { all, left } = await load({ timeoutSeconds: 1 });
	assert.deepEqual(await all(["piper-fails now", "ffmpeg-fails now", "piper-hangs now", "ffmpeg-hangs now", "Fine."]), ["piper: ValueError: Unable to find voice", "ffmpeg: Unknown encoder 'libopus'", "piper: timed out after 1 s", "ffmpeg: timed out after 1 s", true]);
	assert.equal(left().length, 1, "only the last voice note stays: no WAV, no half OGG");
});

test("two texts at once are spoken one after the other, in the order they were asked", async () => {
	const { all, calls } = await load();
	assert.deepEqual(await all(["slow one", "second"]), [true, true]);
	assert.deepEqual(
		calls().map((call) => `${call.tool} ${call.phase}`),
		["piper start", "piper end", "ffmpeg start", "ffmpeg end", "piper start", "piper end", "ffmpeg start", "ffmpeg end"],
	);
	assert.equal(calls()[0]?.stdin, "slow one\n");
});

test("piper, the voice's model or its config, or ffmpeg missing: nothing runs, and the rejection says why and names arthur doctor", async () => {
	const { say, calls, fake, dir } = await load({}, ["ffmpeg"]);
	await assert.rejects(say("Done."), { message: "piper not found on PATH; see arthur doctor" });
	writeFileSync(join(dir, "piper"), FAKE("piper"));
	await assert.rejects(say("Done."), { message: "piper not found on PATH; see arthur doctor" }, "a piper that cannot be run is missing too");
	chmodSync(join(dir, "piper"), 0o755);
	const model = join(fake.host.folder, "voices", `${VOICES[1]}.onnx`);
	rmSync(`${model}.json`);
	await assert.rejects(say("Done."), { message: `no file ${model}.json; see arthur doctor` });
	rmSync(model);
	await assert.rejects(say("Done."), { message: `no file ${model}; see arthur doctor` });
	assert.ok((await say("Już gotowe.")).endsWith(".ogg"), "the other language's voice is there");
	rmSync(join(dir, "ffmpeg"));
	await assert.rejects(say("Już gotowe."), { message: "ffmpeg not found on PATH; see arthur doctor" });
	assert.deepEqual(calls().filter((call) => call.phase === "start").map((call) => call.tool), ["piper", "ffmpeg"]);
});

test("arthur doctor names piper, each voice and ffmpeg, none critical, each with its fix", async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), "export default {};\n");
	const core = (await loadConfig(join(folder, "arthur.config.ts"))).core;
	const { dir } = fakes(["piper"]);
	const doctor = (options: Readonly<Record<string, unknown>>) => onPath(dir, async () => Promise.all(((await speak().doctor?.(options, core)) ?? []).map(async (need) => ({ line: `${need.name}: ${await need.check()}; critical ${need.critical}; ${need.costs}`, fix: need.fix }))));
	const costs = "a reply to a voice note goes as text alone, and arthur say refuses";
	const voices = join(core.home, "speak", "voices");
	const lines = await doctor({});
	assert.deepEqual(
		lines.map((need) => need.line),
		[`piper: ok; critical false; ${costs}`, `voice pl: missing: no file ${join(voices, `${VOICES[0]}.onnx`)}; critical false; ${costs}`, `voice en: missing: no file ${join(voices, `${VOICES[1]}.onnx`)}; critical false; ${costs}`, `ffmpeg: missing: ffmpeg not found on PATH; critical false; ${costs}`],
	);
	const url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx";
	const file = join(voices, "pl_PL-gosia-medium.onnx");
	assert.deepEqual(
		lines.map((need) => need.fix),
		["pipx install piper-tts (https://github.com/OHF-Voice/piper1-gpl), which puts piper on PATH", `curl -fL --create-dirs -o ${file} ${url} && curl -fL -o ${file}.json ${url}.json`, `curl -fL --create-dirs -o ${join(voices, `${VOICES[1]}.onnx`)} https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx && curl -fL -o ${join(voices, `${VOICES[1]}.onnx`)}.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json`, "sudo apt-get install -y ffmpeg"],
	);
	const own = join(folder, "own.onnx");
	writeFileSync(own, "voice");
	const [, mine] = await doctor({ voices: { pl: own } });
	assert.deepEqual(mine, { line: `voice pl: missing: no file ${own}.json; critical false; ${costs}`, fix: `put the voice at ${own} and its config at ${own}.json (https://huggingface.co/rhasspy/piper-voices)` });
	writeFileSync(`${own}.json`, "config");
	assert.deepEqual((await doctor({ voices: { pl: own } })).map((need) => need.line.split(";")[0]), ["piper: ok", "voice pl: ok", "ffmpeg: missing: ffmpeg not found on PATH"], "only the languages voices names");
	assert.equal((await doctor({ voices: { en: "my-voice" } }))[1]?.fix, `put the voice at ${join(voices, "my-voice.onnx")} and its config at ${join(voices, "my-voice.onnx")}.json (https://huggingface.co/rhasspy/piper-voices)`);
});

// `arthur say` of a plugin loaded by `load`, run with its fakes on PATH: its exit code, then each line it printed, `! ` before stderr's.
async function cli(loaded: { readonly fake: FakeHost; readonly dir: string }, ...args: string[]): Promise<unknown[]> {
	const command = loaded.fake.commands.find((each) => each.name === "say") as Command;
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

test("arthur say prints the voice note's path, or with --out writes it there; refusals and wrong arguments", async () => {
	const loaded = await load({ maxChars: 20 });
	const [code, path] = await cli(loaded, "Merged", "AR0081.");
	assert.equal(code, 0);
	assert.equal(readFileSync(String(path), "utf8"), `ogg:${join(loaded.fake.host.folder, "voices", `${VOICES[1]}.onnx`)}|Merged AR0081.\n`, "the words are one text");
	const out = join(temporaryFolder(), "reply.ogg");
	assert.deepEqual(await cli(loaded, "Gotowe.", "--out", out), [0, out]);
	assert.equal(readFileSync(out, "utf8").endsWith("|Gotowe.\n"), true);
	assert.equal(loaded.left().length, 1, "the file --out names is the only copy");
	const gone = join(temporaryFolder(), "no", "such", "reply.ogg");
	const [failed, said] = await cli(loaded, "Hello.", "--out", gone);
	assert.deepEqual([failed, String(said).startsWith(`! refused: ENOENT: no such file or directory, copyfile`)], [1, true]);
	assert.deepEqual(await cli(loaded, "a".repeat(21)), [1, "! refused: the text has 21 characters, over maxChars 20"]);
	assert.deepEqual(await cli(loaded, "piper-fails"), [1, "! refused: piper: ValueError: Unable to find voice"]);
	for (const args of [[], [""], [" "], ["Hello.", "--out", ""], ["--out", out]]) assert.deepEqual(await cli(loaded, ...args), [2, "! usage: arthur say <text> [--out <file>]"], JSON.stringify(args));
	assert.equal((await cli(loaded, "Hello.", "--nope"))[0], 2);
	rmSync(join(loaded.dir, "piper"));
	assert.deepEqual(await cli(loaded, "Hello."), [1, "! refused: piper not found on PATH; see arthur doctor"]);
});
