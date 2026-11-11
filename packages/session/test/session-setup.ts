import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { type AgentRun, fakeAgent, type FakeHost, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { type SessionOptions, session } from "../src/session.ts";

// The session test files' shared setup: the plugin on a fake host, the two ways a compaction is asked for, and a fake coordinator.

export const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";
export const HANDOFF = "Work in progress: AR0143, its worker runs.\nNext: review its branch.\nUnanswered: merge AR0140? (asked at 12:40)";

// Whole lines only: a line the agent is still appending has no line break yet.
const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line)) : []);

// The plugin on a fake host in Warsaw at `now`, started as `arthur run` starts it, its printed lines caught; stopped at the end.
// Its tick, and its handoff extension's, is 100 ms, not 500: a test's 250 ms sleep is two of them.
export async function load(t: TestContext, options: SessionOptions, now: string) {
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void out.push(text));
	t.mock.method(console, "error", (text: string) => void err.push(text));
	const fake = fakeHost({ name: "session", options, timeZone: "Europe/Warsaw", now: new Date(now) });
	const plugin = session(options, 100);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	const [file, use] = [join(fake.host.folder, "request.json"), join(fake.host.folder, "context-use")];
	return {
		fake,
		out,
		err,
		file,
		handoff: join(fake.host.folder, "handoff.md"),
		start: () => plugin.start?.(),
		at: (when: string) => fake.setNow(new Date(when)),
		request: () => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : undefined),
		// A turn's end at `percent` of its context window, as the turn extension reports it; `consumed` waits until a tick took
		// it, which decides on the report and on the slot in that same tick.
		report: (percent: string) => writeFileSync(use, percent),
		consumed: () => until("the report read", () => !existsSync(use)),
	};
}

// The two ways a compaction is asked for at 13:00: its slot, or a turn's report at compactAtPercent.
type Fire = { at(when: string): unknown; report(percent: string): unknown };
export const TRIGGERS: readonly { readonly options: SessionOptions; readonly fire: (box: Fire) => unknown }[] = [
	{ options: { compactAt: ["13:00"] }, fire: (box) => box.at("2026-10-18T13:00:00+02:00") },
	{ options: { compactOn: "context", compactAtPercent: 80 }, fire: (box) => box.report("80") },
];

// The coordinator: the fake agent playing `run` with the extension the plugin gives orchestration, after `before`'s, and its
// variables; killed at the end. `open(name)` lets a step `{ waitFor: gate(name) }` go on.
export function coordinator(t: TestContext, fake: FakeHost, run: (gate: (name: string) => string) => AgentRun, before: readonly string[] = []) {
	const gates = temporaryFolder();
	const agent = fakeAgent(run((name) => join(gates, name)));
	const [extension] = fake.collect<{ file: string; env: Record<string, string> }>("coordinator.extension");
	assert.ok(extension);
	const child = spawn(agent, [...before.flatMap((file) => ["-e", file]), "-e", extension.file], { env: { ...process.env, ...extension.env }, stdio: "ignore" });
	t.after(() => {
		writeFileSync(join(gates, "release"), "");
		child.kill();
	});
	return {
		open: (name: string) => writeFileSync(join(gates, name), ""),
		messages: () => lines(join(dirname(agent), "messages.jsonl")),
		compactions: () => lines(join(dirname(agent), "compactions.jsonl")),
	};
}
