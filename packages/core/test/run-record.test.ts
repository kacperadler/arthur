import assert from "node:assert/strict";
import { test } from "node:test";
import { type AgentEvent, agentStream } from "../src/agent-stream.ts";
import { LOOP, runRecord } from "../src/run-record.ts";
import { secretNames } from "../src/secret-names.ts";

// What the agent's events make of the job record (run-record.ts): here the agent's text in `log` (AR0670), through the
// wrapper's `save`, which names each secret value before it writes.

const SECRET = "sk-live-4f9a8b7c6d5e";
const message = (text: string, stopReason = "stop"): AgentEvent => ({ kind: "message", text, stopReason, error: "", model: "anthropic/fake", input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.01 });

// The record's files as a `save` like the wrapper's leaves them: each text named, appended or written whole; `loops` counts the loops told.
function record() {
	const files: Record<string, string> = {};
	const hide = secretNames({ ARTHUR_SHOP_TOKEN: SECRET });
	const told = { loops: 0 };
	const run = runRecord((name, text, append = false) => void (files[name] = (append ? (files[name] ?? "") : "") + hide(text)), 0, {}, () => {}, () => void told.loops++);
	return { files, run, told };
}

// A tool call and its end as omp's JSON mode prints them, read by the stream: `args` whole, `intent` what the agent says it is for.
let calls = 0;
function call(toolName: string, args: Readonly<Record<string, unknown>>, isError: boolean, intent = `Try ${calls}`): AgentEvent[] {
	const toolCallId = `toolu_${++calls}`;
	const result = { content: [{ type: "text", text: isError ? "Nothing applied." : "ok" }], details: {} };
	const lines = [{ type: "tool_execution_start", toolCallId, toolName, args: { ...args, i: intent }, intent }, { type: "tool_execution_end", toolCallId, toolName, result, isError }];
	return agentStream().push(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
}
const EDIT = { path: "src/cart.ts", edits: [{ oldText: "a", newText: "b" }] };

test("each line of a message's text goes into log as `> <line>`, in order among the tool lines, a blank line too; a message without text adds none", () => {
	const { files, run } = record();
	run.apply([{ kind: "turn" }, message("Reading first.\nThen the tests.", "toolUse"), ...call("read", { path: "README.md" }, false)]);
	run.apply([message("", "toolUse"), ...call("bash", { command: "npm test" }, false).slice(0, 1), { kind: "line", line: "stderr: ok" }, message("All tests pass.\n\nDone.")]);
	assert.equal(files.log, "> Reading first.\n> Then the tests.\nread README.md\nbash npm test\nstderr: ok\n> All tests pass.\n> \n> Done.\n");
	assert.equal(run.result(), "All tests pass.\n\nDone.", "the result is the last message with text");
});

test("a secret value in a message's text reaches log named, never as itself", () => {
	const { files, run } = record();
	run.apply([message(`The key is ${SECRET}.\nIt works.`)]);
	run.end();
	assert.equal(files.log, "> The key is ARTHUR_SHOP_TOKEN.\n> It works.\n");
	assert.ok(!JSON.stringify(files).includes(SECRET), "in no file of the record");
});

test("the same failed tool call 5 times in a row is a loop, told once with the call; 4 are none, and the agent's intent is no part of the call", () => {
	const { run, told } = record();
	for (let count = 1; count < LOOP; count++) run.apply(call("edit", EDIT, true));
	assert.deepEqual([LOOP, told.loops, run.looped()], [5, 0, ""], "4 in a row");
	run.apply(call("edit", EDIT, true));
	assert.deepEqual([told.loops, run.looped()], [1, "edit src/cart.ts"]);
	for (let count = 0; count < 2 * LOOP; count++) run.apply(call("edit", EDIT, true));
	assert.equal(told.loops, 1, "told once, however long it goes on");
	// A second loop after it, of a tool whose arguments hold no path, command or pattern: the first is the one named.
	const todo = () => call("todo", { items: ["a"] }, true);
	run.apply([...call("edit", EDIT, false), ...Array.from({ length: LOOP }, todo).flat()]);
	assert.deepEqual([told.loops, run.looped()], [1, "edit src/cart.ts"]);
	const other = record();
	other.run.apply(Array.from({ length: LOOP }, todo).flat());
	assert.deepEqual([other.told.loops, other.run.looped()], [1, "todo"]);
});

test("the stream reads a tool call's id, whole arguments and error flag, each missing one as none", () => {
	const read = (line: object) => agentStream().push(`${JSON.stringify(line)}\n`);
	assert.deepEqual(read({ type: "tool_execution_start", toolCallId: "toolu_1", toolName: "bash", args: { command: "npm  test\n", timeout: 5, i: "Run the tests" } }), [{ kind: "tool", id: "toolu_1", name: "bash", detail: "npm test ", call: 'bash {"command":"npm  test\\n","timeout":5}' }]);
	assert.deepEqual(read({ type: "tool_execution_start", toolName: "todo" }), [{ kind: "tool", id: "", name: "todo", detail: "", call: "todo {}" }]);
	assert.deepEqual(read({ type: "tool_execution_end", toolCallId: "toolu_1", toolName: "bash", result: { content: [] }, isError: true }), [{ kind: "tool-end", id: "toolu_1", failed: true }]);
	for (const isError of [false, undefined, "true", 1]) assert.deepEqual(read({ type: "tool_execution_end", toolCallId: "toolu_1", isError }), [{ kind: "tool-end", id: "toolu_1", failed: false }], String(isError));
});

test("another call, a successful one, other arguments or another tool between starts the count again; calls at once count each", () => {
	const four = () => Array.from({ length: LOOP - 1 }, () => call("edit", EDIT, true)).flat();
	const between: readonly (readonly [string, AgentEvent[]])[] = [
		["another failed call", call("bash", { command: "npm test" }, true)],
		["another call that passed", call("read", { path: "src/cart.ts" }, false)],
		["the same call, passed", call("edit", EDIT, false)],
		["other arguments under the same path", call("edit", { ...EDIT, edits: [{ oldText: "a", newText: "c" }] }, true)],
		["another tool with the same arguments", call("write", EDIT, true)],
		["an end no call started", [{ kind: "tool-end", id: "toolu_unknown", failed: true }]],
	];
	for (const [what, events] of between) {
		const { run, told } = record();
		run.apply([...four(), ...events, ...four()]);
		assert.deepEqual([told.loops, run.looped()], [0, ""], what);
		run.apply(call("edit", EDIT, true));
		assert.equal(told.loops, 1, `${what}: the fifth after it`);
	}
	// Five calls of one message, started together and ended in any order.
	const { run, told } = record();
	const batch = Array.from({ length: LOOP }, () => call("bash", { command: "npm test" }, true));
	run.apply([...batch.map(([start]) => start!), ...batch.map(([, end]) => end!).reverse()]);
	assert.deepEqual([told.loops, run.looped()], [1, "bash npm test"]);
	// A call that failed 5 times, never in a row.
	const mixed = record();
	for (let count = 0; count < LOOP; count++) mixed.run.apply([...call("bash", { command: "npm test" }, true), ...call("edit", EDIT, true)]);
	assert.equal(mixed.told.loops, 0);
	// The end of the fourth call read twice is no fifth call.
	const twice = record();
	const failed = four();
	twice.run.apply([...failed, failed.at(-1)!]);
	assert.equal(twice.told.loops, 0);
});
