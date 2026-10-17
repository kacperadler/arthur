import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import type { AgentRun } from "./testing.ts";

// The fake agent's player (spec/roadmap.md, entries 11, 14 and 23), started by the `omp` script `fakeAgent` writes, as
// `node fake-agent.ts <run.json> <omp's arguments>`: it notes the start in `starts.jsonl` beside the run, loads each `-e`
// extension as omp does, then plays the run, printing each event in the shape `omp --mode json` prints it, asking the
// extensions' `tool_call` handlers before each tool call (a block fails the call with its reason, as omp does), calling their
// `tool_result` handlers after it, noting each message they send (`sendUserMessage`) in `messages.jsonl` beside the run, and
// exits with the run's code.

const [file = "", ...args] = process.argv.slice(2);
const run = JSON.parse(readFileSync(file, "utf8")) as AgentRun;
appendFileSync(join(dirname(file), "starts.jsonl"), `${JSON.stringify({ pid: process.pid, cwd: process.cwd(), args })}\n`);

const handlers: { readonly event: string; readonly handler: (...args: unknown[]) => unknown }[] = [];
const pi = {
	on: (event: string, handler: (...args: unknown[]) => unknown) => void handlers.push({ event, handler }),
	sendUserMessage: (content: string, options: unknown) => appendFileSync(join(dirname(file), "messages.jsonl"), `${JSON.stringify({ content, options })}\n`),
};
for (const [index, arg] of args.entries()) {
	if (arg !== "-e") continue;
	// The path is the wrapper's argument, known only when the fake runs.
	const extension = (await import(pathToFileURL(args[index + 1] ?? "").href)) as { default: (api: typeof pi) => void };
	extension.default(pi);
}

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
		let blocked: string | undefined;
		for (const { event: name, handler } of handlers) {
			if (name !== "tool_call" || blocked !== undefined) continue;
			const verdict = (await handler({ type: "tool_call", toolCallId, toolName: step.tool, input: step.args ?? {} }, {})) as { block?: boolean; reason?: string } | undefined;
			if (verdict?.block) blocked = verdict.reason || "Tool execution was blocked by an extension";
		}
		const isError = blocked !== undefined || (step.failed ?? false);
		const result = { content: [{ type: "text", text: blocked ?? step.output ?? "" }], details: {} };
		// Inside the tool's execution, as omp runs it, before the end event.
		const done = { type: "tool_result", toolCallId, toolName: step.tool, input: step.args ?? {}, ...result, isError };
		for (const { event: name, handler } of handlers) if (name === "tool_result") await handler(done, {});
		await event({ type: "tool_execution_end", toolCallId, toolName: step.tool, result, isError });
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
