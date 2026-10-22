import { appendFileSync, existsSync, linkSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import type { AgentRun } from "./testing.ts";

// The fake agent's player (spec/roadmap.md, entries 11, 14, 23, 24 and 35), started by the `omp` script `fakeAgent` writes, as `node fake-agent.ts
// <run.json> <omp's arguments>`: it loads each `-e` extension as omp does (one may read the job's record) and calls its `session_start` handlers, only
// then notes the start in `starts.jsonl` beside the run, plays the run, printing each event in the shape `omp --mode json` prints it, asking the
// extensions' `tool_call` handlers before each tool call (a block fails the call with its reason, as omp does), calling their `tool_result` handlers
// after it, noting each message they send (`sendUserMessage`) in `messages.jsonl` beside the run with the step it came in, the system prompt of each
// turn in `system.jsonl` and each `agent_end` in `ends.jsonl`, and exits with the run's code. A handler's `ctx` has a UI (`hasUI`) unless omp runs
// with `--mode`; `ui` calls are noted in `ui.jsonl`; it is idle outside a turn (`prompt` to `end`).

const [file = "", ...args] = process.argv.slice(2);
const run = JSON.parse(readFileSync(file, "utf8")) as AgentRun;
// With `clock`, `Date.now()` here and in the extensions answers the time in ms that file holds, while it exists.
const [clock, realNow] = [run.clock, Date.now];
if (clock !== undefined) Date.now = () => (existsSync(clock) ? Number(readFileSync(clock, "utf8")) : realNow());
// A file a test reads while the agent runs is never seen empty: it is made whole with its first line, by a link.
const note = (name: string, entry: object) => {
	const [path, line, whole] = [join(dirname(file), name), `${JSON.stringify(entry)}\n`, join(dirname(file), `.${name}.${process.pid}`)];
	if (existsSync(path)) return appendFileSync(path, line);
	writeFileSync(whole, line);
	try {
		linkSync(whole, path);
	} catch {
		appendFileSync(path, line); // another start of this agent made it first
	}
	rmSync(whole);
};

// The step being played; whether no turn runs; the sends still to throw and to drop; the messages sent while idle, for the next
// `prompt`; the turns' messages.
let [at, idle, failures, drops, continued] = [-1, true, run.failSends ?? 0, run.dropSends ?? 0, 0];
const prompts: string[] = [];
const conversation: object[] = [];
const user = (text: string) => ({ role: "user", content: [{ type: "text", text }] });
const BASE = "The fake agent's own system prompt.";
const handlers: { readonly event: string; readonly handler: (...args: unknown[]) => unknown }[] = [];
const pi = {
	on: (event: string, handler: (...args: unknown[]) => unknown) => void handlers.push({ event, handler }),
	sendUserMessage(content: string, options: unknown) {
		if (failures-- > 0) throw new Error("fake agent: sendUserMessage failed");
		if (idle && drops-- > 0) return;
		note("messages.jsonl", { content, options, step: at });
		if (idle) prompts.push(content);
		else conversation.push(user(content));
	},
};
const ui = (method: string) => (...values: unknown[]) => note("ui.jsonl", { method, args: values });
const ctx = {
	hasUI: !args.includes("--mode"),
	cwd: process.cwd(),
	isIdle: () => idle,
	// A message sent while idle that no `prompt` took yet, as omp's queue holds it.
	hasPendingMessages: () => prompts.length > 0,
	// As omp's `/compact`: noted in `compactions.jsonl` with its instructions and the step, or throwing the run's `compactError`.
	compact: async (instructions?: unknown) => {
		if (run.compactError !== undefined) throw new Error(run.compactError);
		note("compactions.jsonl", { instructions: instructions ?? null, step: at });
	},
	ui: { setStatus: ui("setStatus"), notify: ui("notify") },
	// As omp's: unref'd, and a throw is logged, not fatal.
	setInterval: (fn: () => unknown, ms: number) => setInterval(() => Promise.try(fn).catch((error) => console.error(error)), ms).unref(),
};
const ask = async (type: string, data: object) => {
	const answers: unknown[] = [];
	for (const { event, handler } of handlers) if (event === type) answers.push(await handler({ type, ...data }, ctx));
	return answers;
};
for (const [index, arg] of args.entries()) {
	if (arg !== "-e") continue;
	// The path is the wrapper's argument, known only when the fake runs.
	const extension = (await import(pathToFileURL(args[index + 1] ?? "").href)) as { default: (api: typeof pi) => void };
	extension.default(pi);
}
await ask("session_start", {});
note("starts.jsonl", { pid: process.pid, cwd: process.cwd(), args });

// Resolves once the line is handed to the pipe, so a signal that follows never cuts it.
const print = (stream: NodeJS.WriteStream, line: string) => {
	const { promise, resolve } = Promise.withResolvers<void>();
	stream.write(`${line}\n`, () => resolve());
	return promise;
};
const event = (data: object) => print(process.stdout, JSON.stringify(data));

for (const [index, step] of run.steps.entries()) {
	at = index;
	if ("tool" in step) {
		const toolCallId = `toolu_fake_${index}`;
		const input = step.args ?? {};
		await event({ type: "tool_execution_start", toolCallId, toolName: step.tool, args: input });
		const verdicts = (await ask("tool_call", { toolCallId, toolName: step.tool, input })) as ({ block?: boolean; reason?: string } | undefined)[];
		const verdict = verdicts.find((each) => each?.block);
		const blocked = verdict === undefined ? undefined : verdict.reason || "Tool execution was blocked by an extension";
		const isError = blocked !== undefined || (step.failed ?? false);
		const result = { content: [{ type: "text", text: blocked ?? step.output ?? "" }], details: {} };
		conversation.push({ role: "toolResult", toolCallId, toolName: step.tool, ...result, isError });
		// Inside the tool's execution, as omp runs it, before the end event.
		await ask("tool_result", { toolCallId, toolName: step.tool, input, ...result, isError });
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
		conversation.push(message);
		await event({ type: "turn_start" });
		await event({ type: "message_end", message });
	} else if ("prompt" in step) {
		while (prompts.length === 0) await sleep(10);
		idle = false;
		for (const until = Date.now() + (step.compactMs ?? 0); Date.now() < until; ) await sleep(10);
		// As omp: the extensions' `before_agent_start` handlers first, the last system prompt one returns going to the model.
		const turn = prompts.splice(0);
		const answers = (await ask("before_agent_start", { prompt: turn.join("\n\n"), systemPrompt: [BASE] })) as ({ systemPrompt?: string[] } | undefined)[];
		note("system.jsonl", { systemPrompt: answers.findLast((answer) => answer?.systemPrompt !== undefined)?.systemPrompt ?? [BASE], step: index });
		conversation.push(...turn.map(user));
		await ask("agent_start", {});
	} else if ("end" in step) {
		// As omp's main session: its `session_stop` handlers first; a continuation, at most 8 in a row, goes on with the next steps.
		const answers = (await ask("session_stop", { messages: [...conversation], stop_hook_active: continued > 0 })) as ({ continue?: boolean; additionalContext?: string } | undefined)[];
		const more = continued < 8 ? answers.find((answer) => answer?.continue === true && typeof answer.additionalContext === "string" && answer.additionalContext !== "") : undefined;
		continued = more === undefined ? 0 : continued + 1;
		if (more !== undefined) {
			note("messages.jsonl", { content: more.additionalContext, options: { continue: true }, step: index });
			conversation.push(user(more.additionalContext ?? ""));
		} else idle = true;
		const goesOn = more !== undefined || step.continues === true;
		await ask("agent_end", { messages: [...conversation], willContinue: goesOn ? true : undefined });
		note("ends.jsonl", { willContinue: goesOn, step: index });
	} else if ("stdout" in step) await print(process.stdout, step.stdout);
	else if ("stderr" in step) await print(process.stderr, step.stderr);
	// Waits for the test; a test whose folder is gone, as after its process exited, never comes.
	else if ("waitFor" in step) while (!existsSync(step.waitFor) && existsSync(dirname(step.waitFor))) await sleep(10);
	else process.kill(process.pid, step.signal);
}
process.exitCode = run.exitCode ?? 0;
