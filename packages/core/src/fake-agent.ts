import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { AgentRun } from "./testing.ts";

// The fake agent's player (spec/roadmap.md, entry 11), started by the `omp` script `fakeAgent` writes, as
// `node fake-agent.ts <run.json> <omp's arguments>`: it notes the start in `starts.jsonl` beside the run, then plays the run,
// printing each event in the shape `omp --mode json` prints it, and exits with the run's code.

const [file = "", ...args] = process.argv.slice(2);
const run = JSON.parse(readFileSync(file, "utf8")) as AgentRun;
appendFileSync(join(dirname(file), "starts.jsonl"), `${JSON.stringify({ pid: process.pid, cwd: process.cwd(), args })}\n`);

// Resolves once the line is handed to the pipe, so a signal that follows never cuts it.
const print = (stream: NodeJS.WriteStream, line: string) => {
	const { promise, resolve } = Promise.withResolvers<void>();
	stream.write(`${line}\n`, () => resolve());
	return promise;
};
const event = (data: object) => print(process.stdout, JSON.stringify(data));

for (const [index, step] of run.steps.entries()) {
	if ("tool" in step) {
		const toolCallId = `toolu_fake_${index}`;
		await event({ type: "tool_execution_start", toolCallId, toolName: step.tool, args: step.args ?? {} });
		const result = { content: [{ type: "text", text: step.output ?? "" }], details: {} };
		await event({ type: "tool_execution_end", toolCallId, toolName: step.tool, result, isError: step.failed ?? false });
	} else if ("message" in step) {
		const cost = step.cost ?? 0;
		const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: cost, cacheRead: 0, cacheWrite: 0, total: cost } };
		const message = {
			role: "assistant",
			content: [{ type: "text", text: step.message }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "fake",
			usage,
			stopReason: step.stopReason ?? "stop",
			timestamp: Date.now(),
			...(step.error === undefined ? {} : { errorMessage: step.error }),
		};
		await event({ type: "turn_start" });
		await event({ type: "message_end", message });
	} else if ("stdout" in step) await print(process.stdout, step.stdout);
	else if ("stderr" in step) await print(process.stderr, step.stderr);
	// Waits for the test; a test whose folder is gone, as after its process exited, never comes.
	else if ("waitFor" in step) while (!existsSync(step.waitFor) && existsSync(dirname(step.waitFor))) await sleep(10);
	else process.kill(process.pid, step.signal);
}
process.exitCode = run.exitCode ?? 0;
