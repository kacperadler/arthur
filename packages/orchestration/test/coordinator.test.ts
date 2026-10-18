import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { type TestContext, test } from "node:test";
import { type AgentRun, type FakeHost, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type OrchestrationOptions, orchestration } from "../src/orchestration.ts";

const ENV_GUARD = fileURLToPath(import.meta.resolve("@arthur/core/env-guard"));
const INBOX = fileURLToPath(new URL("../src/inbox-extension.ts", import.meta.url));
const CONTEXT = fileURLToPath(new URL("../src/context-extension.ts", import.meta.url));
const CLI = fileURLToPath(import.meta.resolve("@arthur/core/plugin").replace(/plugin\.ts$/, "cli.ts"));
const PATH = process.env.PATH ?? "";

// What the plugin printed, each line with the time it came.
type Line = { readonly at: number; readonly text: string };

// The plugin set up on a fake host with its tmux server on a socket in the test's folder, the agent `omp` on `PATH` being
// `agent` (a fake's path), and its output caught; its server is killed and `PATH` restored when the test ends.
async function load(t: TestContext, agent: string, coordinator: NonNullable<OrchestrationOptions["coordinator"]> = {}, root?: string, roles?: OrchestrationOptions["roles"]) {
	const socket = join(temporaryFolder(), "tmux.sock");
	const options: OrchestrationOptions = { coordinator: { exitWaitSeconds: 1, restartDelaySeconds: 1, ...coordinator, tmux: { session: "coord", socket, ...coordinator.tmux } }, roles };
	const tmuxSocket = options.coordinator?.tmux?.socket ?? socket;
	process.env.PATH = `${dirname(agent)}${delimiter}${PATH}`;
	const [out, err] = [[] as Line[], [] as Line[]];
	t.mock.method(console, "log", (text: string) => out.push({ at: Date.now(), text }));
	t.mock.method(console, "error", (text: string) => err.push({ at: Date.now(), text }));
	const fake = fakeHost({ name: "orchestration", root });
	const plugin = orchestration(options);
	await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	t.after(async () => {
		await plugin.stop?.();
		tmux(tmuxSocket, "kill-server");
		process.env.PATH = PATH;
	});
	return { fake, plugin, socket: tmuxSocket, out, err, starts: () => starts(agent) };
}

function tmux(socket: string, ...args: string[]) {
	return spawnSync("tmux", [socket.includes("/") ? "-S" : "-L", socket, ...args], { encoding: "utf8" });
}

// The fake agent's starts, from `starts.jsonl` beside it.
function starts(agent: string): { pid: number; cwd: string; args: string[] }[] {
	const file = join(dirname(agent), "starts.jsonl");
	return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
}

async function until(what: string, holds: () => boolean, ms = 15_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// A command the plugin registered, run as the CLI would, with what it printed.
async function command(fake: FakeHost, name: string, args: string[], lines: { out: Line[]; err: Line[] }) {
	const [before, errors] = [lines.out.length, lines.err.length];
	const code = (await fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })) ?? 0;
	return { code, out: lines.out.slice(before).map((line) => line.text), err: lines.err.slice(errors).map((line) => line.text) };
}

// A fake agent that stays until `release` exists in its folder.
function waiting(steps: AgentRun["steps"] = []): { agent: string; release: () => void } {
	const folder = temporaryFolder();
	const agent = fakeAgent({ steps: [...steps, { waitFor: join(folder, "release") }] });
	return { agent, release: () => writeFileSync(join(folder, "release"), "") };
}

test("the coordinator is one interactive omp in its tmux session, with --continue, its model, thinking and quick model, the env guard and its context", async (t) => {
	const { agent, release } = waiting();
	t.after(release);
	const { plugin, socket, starts } = await load(t, agent, { model: "anthropic/claude-opus-5-5", thinking: "high" }, undefined, { quick: { model: "anthropic/claude-haiku-5-5" } });
	await plugin.start?.();
	await until("the coordinator's start", () => starts().length === 1);
	const [start] = starts();
	const models = ["--model", "anthropic/claude-opus-5-5", "--thinking", "high", "--smol", "anthropic/claude-haiku-5-5"];
	assert.deepEqual(start?.args, ["--continue", "--auto-approve", ...models, "-e", ENV_GUARD, "-e", INBOX, "-e", CONTEXT]);
	assert.equal(start?.cwd, process.cwd());
	// The context extension runs `arthur coordinator context` with this node, in the agent's folder, before each turn.
	const command = tmux(socket, "show-environment", "-t", "=coord", "ARTHUR_ORCHESTRATION_CONTEXT").stdout.trim();
	assert.equal(command, `ARTHUR_ORCHESTRATION_CONTEXT=${JSON.stringify([process.execPath, CLI, "coordinator", "context"])}`);
	assert.equal(tmux(socket, "display-message", "-p", "-t", "=coord:", "#{pane_pid}").stdout.trim(), String(start?.pid));
	// A second start while it runs is not made: one coordinator.
	await sleep(1500);
	assert.equal(starts().length, 1);
	await plugin.stop?.();
	assert.notEqual(tmux(socket, "has-session", "-t", "=coord").status, 0, "arthur run's stop ends the session");
	await sleep(1500);
	assert.equal(starts().length, 1, "nothing starts it after arthur run stopped");
});

test("a coordinator that ends is started again after restartDelaySeconds, and one crashing in a loop never faster", async (t) => {
	const agent = fakeAgent({ steps: [{ stderr: "crash" }], exitCode: 1 });
	const { plugin, out, starts } = await load(t, agent, { restartDelaySeconds: 1 });
	await plugin.start?.();
	await until("three starts", () => starts().length >= 3);
	await plugin.stop?.();
	const started = out.filter((line) => line.text.startsWith("orchestration: coordinator started: omp (pid "));
	assert.ok(started.length >= 3);
	for (const [index, line] of started.entries()) if (index > 0) assert.ok(line.at - (started[index - 1]?.at ?? 0) >= 1000, `starts ${index} and ${index + 1} came ${line.at - (started[index - 1]?.at ?? 0)} ms apart`);
	assert.ok(out.some((line) => line.text === "orchestration: the coordinator ended; starting it again in 1 s"));
});

test("a previous omp still alive after exitWaitSeconds refuses the start, logged, and the start is tried again until it exits", async (t) => {
	// The first start ignores the hangup tmux sends when its session is killed, and stays until `release`.
	const folder = temporaryFolder();
	const agent = join(folder, "omp");
	writeFileSync(
		agent,
		`#!/bin/sh\necho "{\\"pid\\": $$, \\"cwd\\": \\"$PWD\\", \\"args\\": []}" >> "${folder}/starts.jsonl"\n` +
			`if [ ! -e "${folder}/first" ]; then : > "${folder}/first"; trap '' HUP; until [ -e "${folder}/release" ]; do sleep 0.1; done; else sleep 60; fi\n`,
		{ mode: 0o755 },
	);
	t.after(() => writeFileSync(join(folder, "release"), ""));
	const { plugin, socket, out, err, starts } = await load(t, agent, { exitWaitSeconds: 1, restartDelaySeconds: 1 });
	await plugin.start?.();
	await until("the first start", () => starts().length === 1);
	const [first] = starts();
	tmux(socket, "kill-session", "-t", "=coord");
	await until("two refusals", () => err.filter((line) => line.text.includes("coordinator start refused")).length >= 2);
	// At least exitWaitSeconds; a slow runner may wait longer before it looks again.
	assert.match(err[0]?.text ?? "", new RegExp(`^orchestration: coordinator start refused: the previous omp \\(pid ${first?.pid}\\) is still running [1-9]\\d*\\.\\d s later; trying again in 1 s$`));
	assert.equal(starts().length, 1, "no second omp beside the first");
	const released = Date.now();
	writeFileSync(join(folder, "release"), "");
	await until("the second start", () => starts().length === 2);
	assert.ok((out.find((line) => line.text.startsWith("orchestration: coordinator started:") && line.at >= released)?.at ?? 0) >= released);
	assert.equal(spawnSync("kill", ["-0", String(first?.pid)]).status, 1, "the previous omp had exited");
});

test("arthur coordinator stop ends the session and keeps it stopped until arthur run starts again; attach then says so", async (t) => {
	const { agent, release } = waiting();
	t.after(release);
	const { fake, plugin, socket, out, err, starts } = await load(t, agent, { tmux: { socket: `arthur-test-${process.pid}` } });
	const lines = { out, err };
	await plugin.start?.();
	await until("the start", () => starts().length === 1);
	assert.deepEqual(await command(fake, "coordinator", ["stop"], lines), {
		code: 0,
		out: [`arthur coordinator stop: tmux session coord (socket ${socket}) ended; it stays stopped until arthur run starts again`],
		err: [],
	});
	await until("the end seen", () => out.some((line) => line.text.includes("arthur coordinator stop asked, so it stays stopped")));
	await sleep(1500);
	assert.equal(starts().length, 1);
	assert.deepEqual(await command(fake, "attach", [], lines), {
		code: 1,
		out: [],
		err: [`arthur attach: no coordinator: tmux session coord (socket ${socket}) is not running; arthur coordinator stop stopped it until arthur run starts again`],
	});
	// A second stop with nothing running says so, and keeps the mark.
	assert.deepEqual((await command(fake, "coordinator", ["stop"], lines)).out, [`arthur coordinator stop: tmux session coord (socket ${socket}) was not running; it stays stopped until arthur run starts again`]);
	await plugin.stop?.();
	await plugin.start?.();
	await until("the start after arthur run started again", () => starts().length === 2);
});

test("arthur attach with no session says so; wrong usage of either command exits 2", async (t) => {
	const { fake, out, err } = await load(t, fakeAgent({ steps: [] }));
	const lines = { out, err };
	const { code, err: said } = await command(fake, "attach", [], lines);
	assert.equal(code, 1);
	assert.match(said[0] ?? "", /^arthur attach: no coordinator: tmux session coord \(socket .*tmux\.sock\) is not running; arthur run starts it$/);
	assert.deepEqual(await command(fake, "attach", ["now"], lines), { code: 2, out: [], err: ["usage: arthur attach"] });
	for (const args of [[], ["start"], ["stop", "now"], ["context", "now"]])
		assert.deepEqual(await command(fake, "coordinator", args, lines), { code: 2, out: [], err: ["usage: arthur coordinator stop|context"] });
});

test("arthur coordinator stop is refused while a job runs, naming it, and the coordinator goes on", async (t) => {
	const root = temporaryFolder();
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: root });
	git("init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "# demo\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	const { agent, release } = waiting();
	t.after(release);
	const { fake, plugin, socket, out, err, starts } = await load(t, agent, {}, root);
	await plugin.start?.();
	await until("the coordinator's start", () => starts().length === 1);
	const job = await fake.host.jobs.spawn({ task: "Wait." });
	await until("the job in its run", () => fake.host.jobs.running().includes(job.id));
	assert.deepEqual(await command(fake, "coordinator", ["stop"], { out, err }), {
		code: 1,
		out: [],
		err: [`arthur coordinator stop: refused: 1 job running: ${job.id}; the coordinator is who hears their end; stop them first (arthur stop <id>, or arthur stopall)`],
	});
	assert.equal(tmux(socket, "has-session", "-t", "=coord").status, 0, "the coordinator still runs");
	assert.equal(existsSync(join(fake.host.folder, "stopped")), false);
	release();
	await until("the job's end", () => fake.host.jobs.running().length === 0);
	assert.equal((await command(fake, "coordinator", ["stop"], { out, err })).code, 0);
});

test("a coordinator tool call naming a secrets file is refused with the env guard's line", async (t) => {
	const { agent, release } = waiting([{ tool: "bash", args: { command: "cat .env" }, output: "SECRET=1" }]);
	t.after(release);
	const { plugin, socket, starts } = await load(t, agent);
	await plugin.start?.();
	await until("the start", () => starts().length === 1);
	const refusal =
		"arthur: refused: this call names the secrets file .env, whose values no tool call may read; set one key with sed -i 's/^KEY=.*/KEY=value/' <file>, or ask the human";
	const shown = () => tmux(socket, "capture-pane", "-p", "-J", "-S", "-", "-t", "=coord:").stdout;
	await until("the tool call's end in the pane", () => shown().includes('"type":"tool_execution_end"'));
	const end = JSON.parse(shown().split("\n").find((line) => line.includes('"type":"tool_execution_end"')) ?? "{}");
	assert.deepEqual([end.result?.content?.[0]?.text, end.isError], [refusal, true]);
});

test("arthur attach puts the terminal in the coordinator's session until it detaches", async (t) => {
	const folder = temporaryFolder();
	const socket = join(folder, "tmux.sock");
	t.after(() => tmux(socket, "kill-server"));
	tmux(socket, "new-session", "-d", "-s", "coord", "sleep", "60");
	const plugin = fileURLToPath(new URL("../src/orchestration.ts", import.meta.url));
	mkdirSync(join(folder, "project"));
	writeFileSync(join(folder, "project", "arthur.config.ts"), `import { orchestration } from ${JSON.stringify(plugin)};\nexport default { plugins: [orchestration({ coordinator: { tmux: { session: "coord", socket: ${JSON.stringify(socket)} } } })] };\n`);
	// `script` gives the CLI a terminal, as a human's shell would.
	const attached = spawn("script", ["-qec", `${process.execPath} ${CLI} attach`, "/dev/null"], { cwd: join(folder, "project"), stdio: "ignore", env: { ...process.env, TERM: "xterm-256color" } });
	const exited = new Promise<number | null>((resolve) => attached.once("exit", resolve));
	await until("a client in the session", () => tmux(socket, "list-clients", "-t", "=coord").stdout.trim() !== "");
	tmux(socket, "detach-client", "-s", "=coord");
	assert.equal(await exited, 0);
	assert.equal(tmux(socket, "has-session", "-t", "=coord").status, 0, "the session goes on after the detach");
});
