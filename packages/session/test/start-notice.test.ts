import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type SessionOptions, session } from "../src/session.ts";
import { probe } from "../src/start-notice.ts";
import turnFailures from "../src/turn-extension.ts";

const HOST = hostname();
const ARGS = ["-p", "--no-session", "--no-title", "--no-tools", "--no-extensions", "--no-skills", "--no-rules", "--mode", "json"];

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// Whole lines only: a line the agent is still appending has no line break yet.
const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line)) : []);

const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

// Whether a process whose arguments name `folder` runs, as `ps` lists it.
const running = (folder: string) => spawnSync("ps", ["-eo", "args="], { encoding: "utf8" }).stdout.split("\n").some((args) => args.includes(folder));

// `omp` on PATH plays `run` for this test; its starts, as the fake agent notes them.
function agent(t: TestContext, run: AgentRun) {
	const file = fakeAgent(run);
	const path = process.env.PATH;
	process.env.PATH = `${dirname(file)}${delimiter}${path}`;
	t.after(() => {
		process.env.PATH = path;
	});
	return { file, starts: () => lines(join(dirname(file), "starts.jsonl")) as { pid: number; args: string[] }[] };
}

// The plugin on a fake host whose orchestration answers the coordinator's model, started as `arthur run` starts it.
async function load(t: TestContext, options: SessionOptions = {}) {
	const fake = fakeHost({ name: "session", options: { compactAt: [], ...options } });
	fake.provide("roles.model", (role: string) => (role === "coordinator" ? { model: "anthropic/claude-opus-4-5", thinking: "high" } : undefined));
	const plugin = session(options);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	return {
		fake,
		plugin,
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text),
	};
}

test("at the start one word is asked of the coordinator's model first; answered, the notice is coordinator up on <host>", async (t) => {
	const omp = agent(t, { steps: [{ message: "Ready." }] });
	const box = await load(t);
	await box.plugin.start?.();
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), [`coordinator up on ${HOST}`]);
	assert.deepEqual(omp.starts().map((start) => start.args), [[...ARGS, "--model", "anthropic/claude-opus-4-5", "Answer with one word: ready."]]);
});

test("no LLM access: the model's error or omp's own error line, a credential in it never repeated, and run omp login", async (t) => {
	t.after(() => delete process.env.PROVIDER_API_KEY);
	process.env.PROVIDER_API_KEY = "hunter-two-secret";
	const denied = '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key sk-ant-api03-AbCdEf123456 (hunter-two-secret)"},"request_id":"req_011CgAWsav66AwnrHwNLjFA6"}';
	for (const [run, reason] of [
		[{ steps: [{ message: "", stopReason: "error", error: denied }], exitCode: 1 }, '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key [redacted] ([redacted])"},"request_id":"[redacted]"}'],
		[{ steps: [{ stderr: "434585 |         throw new Error(`No API key found for ${this.model.provider}." }, { stderr: "error: No API key found for anthropic." }, { stderr: "" }, { stderr: "Use /login, set an API key environment variable" }], exitCode: 1 }, "No API key found for anthropic."],
		[{ steps: [{ stderr: 'Model "anthropic/claude-opus-4-5" not found' }], exitCode: 1 }, 'Model "anthropic/claude-opus-4-5" not found'],
		[{ steps: [{ stderr: "Authorization: Bearer abc.def" }], exitCode: 1 }, "Authorization: Bearer [redacted]"],
		[{ steps: [{ message: "", stopReason: "aborted" }] }, "the model's turn ended with aborted"],
		[{ steps: [{ message: "  " }] }, "no answer"],
		[{ steps: [], exitCode: 3 }, "exit code 3"],
	] as const) {
		agent(t, run as AgentRun);
		const box = await load(t);
		await box.plugin.start?.();
		await until("the notice", () => box.notices().length === 1);
		assert.deepEqual(box.notices(), [`no LLM access on ${HOST}: ${reason}; run omp login`]);
		assert.ok(!box.notices()[0]?.includes("hunter-two-secret") && !box.notices()[0]?.includes("AbCdEf123456"));
	}
});

test("the probe times out: cut after its time, the agent killed; stopped meanwhile, no notice at all", async (t) => {
	const never = join(temporaryFolder(), "never");
	const omp = agent(t, { steps: [{ waitFor: never }] });
	assert.equal(await probe("omp", undefined, 300), "no answer within 0.3 s");
	// A slow runner may kill it before it noted its start, so its process is looked for by the fake agent's folder.
	await until("the probe killed", () => !running(dirname(omp.file)));
	const before = omp.starts().length;
	const box = await load(t);
	await box.plugin.start?.();
	await until("the second probe", () => omp.starts().length === before + 1);
	await box.plugin.stop?.();
	await until("the probe stopped", () => !alive(omp.starts()[before]?.pid ?? 0));
	await sleep(300);
	assert.deepEqual(box.notices(), []);
});

test("probeLlm: false sends coordinator up without asking the model; two starts in a row send two notices, not one", async (t) => {
	const omp = agent(t, { steps: [{ message: "Ready." }] });
	const off = await load(t, { probeLlm: false });
	await off.plugin.start?.();
	await until("the notice", () => off.notices().length === 1);
	assert.deepEqual(off.notices(), [`coordinator up on ${HOST}`]);
	assert.deepEqual(omp.starts(), []);
	const box = await load(t);
	for (const count of [1, 2]) {
		await box.plugin.start?.();
		await until(`notice ${count}`, () => box.notices().length === count);
		await box.plugin.stop?.();
	}
	assert.deepEqual(box.notices(), [`coordinator up on ${HOST}`, `coordinator up on ${HOST}`]);
	assert.equal(omp.starts().length, 2);
});

// What omp hands `agent_end`: the turn's messages, as `omp --mode json` prints them.
const said = (role: string, text: string, stopReason = "stop", errorMessage?: string) => ({
	role,
	content: text === "" ? [] : [{ type: "text", text }],
	api: "anthropic-messages",
	provider: "anthropic",
	model: "claude-opus-4-5",
	usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
	stopReason,
	timestamp: 1792363617800,
	...(errorMessage === undefined ? {} : { errorStatus: 529, errorMessage }),
});

test("a coordinator turn that fails before any text is left for arthur run, its credential redacted; one with text, or not failed, is not", (t) => {
	const folder = temporaryFolder();
	t.after(() => delete process.env.ARTHUR_SESSION_FOLDER);
	process.env.ARTHUR_SESSION_FOLDER = folder;
	const handlers: ((event: object, ctx: { hasUI: boolean }) => void)[] = [];
	turnFailures({ on: (_event, handler) => void handlers.push(handler as (typeof handlers)[number]) });
	const end = (messages: object[], hasUI = true, willContinue?: boolean) => {
		for (const handler of handlers) handler({ type: "agent_end", messages, ...(willContinue === undefined ? {} : { willContinue }), isTerminal: true }, { hasUI });
	};
	const user = { role: "user", content: [{ type: "text", text: "[via telegram] Status?" }], attribution: "user", timestamp: 1792363617727 };
	const overloaded = "529 overloaded; key sk-ant-api03-AbCdEf123456";
	end([user, said("assistant", "Looking.", "toolUse"), { role: "toolResult", toolCallId: "t1", toolName: "bash", content: [], isError: false }, said("assistant", "", "error", overloaded)]);
	end([user, said("assistant", "All quiet.")]);
	end([user, said("assistant", "", "aborted")]);
	end([user, said("assistant", "", "error", overloaded)], false);
	end([user, said("assistant", "", "error", overloaded)], true, true);
	assert.equal(existsSync(join(folder, "turn-failed")), false, "nothing left");
	// An earlier turn's text does not count: only this turn's, after its user message.
	end([said("assistant", "Earlier."), user, said("assistant", "", "toolUse"), { role: "toolResult", toolCallId: "t2", toolName: "bash", content: [], isError: false }, said("assistant", "", "error", overloaded)]);
	const left = readdirSync(join(folder, "turn-failed"));
	assert.equal(left.length, 1);
	assert.match(left[0] ?? "", new RegExp(`^\\d+-${process.pid}-1\\.txt$`));
	assert.equal(readFileSync(join(folder, "turn-failed", left[0] ?? ""), "utf8"), "529 overloaded; key [redacted]");
	// While the provider is down the inbox hands the messages over again: the same first line is not left again, another is.
	const files = () => readdirSync(join(folder, "turn-failed")).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
	end([user, said("assistant", "", "error", `${overloaded}\nsecond line differs`)]);
	assert.equal(files().length, 1, "the same reason once");
	end([user, said("assistant", "", "error", "500 internal")]);
	end([user, said("assistant", "", "aborted")]);
	assert.equal(files().length, 2, "a new reason, and an aborted turn is no answer");
	end([user, said("assistant", "Back.")]);
	end([user, said("assistant", "Still here.")]);
	assert.match(files().at(-1) ?? "", new RegExp(`^\\d+-${process.pid}-3\\.ok$`), "working again, once");
	assert.equal(files().length, 3);
	end([user, said("assistant", "", "error", overloaded)]);
	assert.match(files().at(-1) ?? "", /-4\.txt$/, "after it worked again, the first reason is told again");
});

test("arthur run sends each turn failure the coordinator's agent left as turn failed on <host>; one left before its start is dropped", async (t) => {
	const box = await load(t, { probeLlm: false });
	const failed = join(box.fake.host.folder, "turn-failed");
	mkdirSync(failed, { recursive: true });
	writeFileSync(join(failed, `${Math.floor(performance.timeOrigin) - 60_000}-1-1.txt`), "an old failure");
	await box.plugin.start?.();
	const extension = box.fake.collect<{ file: string; env: Record<string, string> }>("coordinator.extension").find(({ file }) => file.endsWith("turn-extension.ts"));
	assert.ok(extension);
	const gates = temporaryFolder();
	const omp = fakeAgent({ steps: [{ message: "", stopReason: "error", error: "529 overloaded\nretry later" }, { end: true }, { waitFor: join(gates, "next") }, { message: "", stopReason: "error", error: "500 internal" }, { end: true }, { waitFor: join(gates, "again") }, { message: "Back." }, { end: true }, { waitFor: join(gates, "never") }] });
	const child = spawn(omp, ["--continue", "-e", extension.file], { env: { ...process.env, ...extension.env }, stdio: "ignore" });
	t.after(() => child.kill());
	await until("the first notice", () => box.notices().length === 2);
	writeFileSync(join(gates, "next"), "");
	await until("the second notice", () => box.notices().length === 3);
	writeFileSync(join(gates, "again"), "");
	await until("the working-again notice", () => box.notices().length === 4);
	assert.deepEqual(box.notices(), [`coordinator up on ${HOST}`, `turn failed on ${HOST}: 529 overloaded`, `turn failed on ${HOST}: 500 internal`, `turns work again on ${HOST}`]);
	assert.deepEqual(readdirSync(failed), [], "each sent once, the old one dropped");
});
