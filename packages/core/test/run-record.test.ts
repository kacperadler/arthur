import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentEvent } from "../src/agent-stream.ts";
import { runRecord } from "../src/run-record.ts";
import { secretNames } from "../src/secret-names.ts";

// What the agent's events make of the job record (run-record.ts): here the agent's text in `log` (AR0670), through the
// wrapper's `save`, which names each secret value before it writes.

const SECRET = "sk-live-4f9a8b7c6d5e";
const message = (text: string, stopReason = "stop"): AgentEvent => ({ kind: "message", text, stopReason, error: "", model: "anthropic/fake", input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.01 });

// The record's files as a `save` like the wrapper's leaves them: each text named, appended or written whole.
function record() {
	const files: Record<string, string> = {};
	const hide = secretNames({ ARTHUR_SHOP_TOKEN: SECRET });
	const run = runRecord((name, text, append = false) => void (files[name] = (append ? (files[name] ?? "") : "") + hide(text)), 0, {}, () => {});
	return { files, run };
}

test("each line of a message's text goes into log as `> <line>`, in order among the tool lines, a blank line too; a message without text adds none", () => {
	const { files, run } = record();
	run.apply([{ kind: "turn" }, message("Reading first.\nThen the tests.", "toolUse"), { kind: "tool", name: "read", detail: "README.md" }, { kind: "tool-end" }]);
	run.apply([message("", "toolUse"), { kind: "tool", name: "bash", detail: "npm test" }, { kind: "line", line: "stderr: ok" }, message("All tests pass.\n\nDone.")]);
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
