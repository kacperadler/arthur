import { execFileSync, spawn } from "node:child_process";
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { Expect, Scenario } from "./eval-scenario.ts";
import { writeStub } from "./eval-stub.ts";

// One run of a scenario for `arthur eval` (spec/roadmap.md, entry 67): one headless coordinator turn on a fresh copy of its
// fixture, a Git repository of its own on `main` whose remote `origin` is a bare one beside it, with `arthur` on the agent's
// PATH replaced by the recording stub (eval-stub.ts) and ARTHUR_EVAL naming it, so the real one refuses (the core's CLI). Its
// system prompt is the coordinator's context for that copy (`context`), and its `TZ` a zone whose local hour is the scenario's.
// It all lives in a temporary folder of its own, removed when the run ends; the turn, the agent's output and the stub's log are
// copied to `out`. Scored only by what the run left behind: the files, the refs, the stub's log, the agent's reply and tool calls.

export type Agent = { readonly command: string; readonly args: readonly string[] };

// Etc/GMT-5 is UTC+5: the zone whose local hour is `hour` now, so `date` in the session reads the scenario's hour.
function zoneAt(hour: number): string {
	const offset = ((hour - new Date().getUTCHours() + 33) % 24) - 9;
	return offset === 0 ? "Etc/GMT" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// Each ref of the repository by name, and each of `origin` as `origin:<name>`, to its commit.
function refs(repo: string, origin: string): ReadonlyMap<string, string> {
	const list = (cwd: string, prefix: string) => git(cwd, "for-each-ref", "--format=%(refname) %(objectname)").split("\n").filter(Boolean).map((line) => line.split(" ")).map(([name = "", oid = ""]) => [`${prefix}${name}`, oid] as const);
	return new Map([...list(repo, ""), ...list(origin, "origin:")]);
}

// The agent's turn, its output to `stream.jsonl` and `stderr` in `run`; "" once it ended well, else why not. Its process group
// is killed past `seconds`, and at its end what it left running there (a command sent to the background).
async function session(agent: Agent, run: string, repo: string, env: NodeJS.ProcessEnv, seconds: number): Promise<string> {
	const [stdout, stderr] = [openSync(join(run, "stream.jsonl"), "w"), openSync(join(run, "stderr"), "w")];
	try {
		const child = spawn(agent.command, [...agent.args, `@${join(run, "turn.md")}`], { cwd: repo, env, stdio: ["ignore", stdout, stderr], detached: true });
		const kill = () => {
			try {
				if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
			} catch {
				// ESRCH: nothing of the group is left.
			}
		};
		return await new Promise<string>((resolve) => {
			let over = false;
			const timer = setTimeout(() => ((over = true), kill()), seconds * 1000);
			child.once("error", (error) => (clearTimeout(timer), resolve(`the agent ${agent.command} did not start: ${error.message}`)));
			child.once("exit", (code, signal) => {
				clearTimeout(timer);
				kill();
				resolve(over ? `the turn ran past its timeout of ${seconds} s and was stopped` : code === 0 ? "" : `the agent ended ${signal === null ? `with exit code ${code}` : `by ${signal}`}`);
			});
		});
	} finally {
		for (const fd of [stdout, stderr]) closeSync(fd);
	}
}

type Event = { readonly type?: unknown; readonly toolName?: unknown; readonly args?: { readonly command?: unknown }; readonly message?: { readonly role?: unknown; readonly content?: unknown } };

// From the agent's JSON stream: each tool call, `bash <command>` or `<tool> <its arguments as JSON>`, and the reply, the text
// of its last assistant message that has any.
function said(stream: string): { readonly tools: readonly string[]; readonly reply: string } {
	const tools: string[] = [];
	let reply = "";
	for (const line of stream.split("\n")) {
		let event: Event | undefined;
		try {
			event = JSON.parse(line) ?? undefined;
		} catch {
			continue;
		}
		if (event?.type === "tool_execution_start") tools.push(event.toolName === "bash" ? `bash ${String(event.args?.command ?? "")}` : `${String(event.toolName)} ${JSON.stringify(event.args ?? {})}`);
		const content = event?.type === "message_end" && event.message?.role === "assistant" && Array.isArray(event.message.content) ? (event.message.content as readonly { readonly type?: unknown; readonly text?: unknown }[]) : [];
		const text = content.map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : "")).join("").trim();
		if (text !== "") reply = text;
	}
	return { tools, reply };
}

// Each expectation the run left unmet, as a line; none when it passed.
export function score(expect: Expect, repo: string, before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>, calls: readonly string[], stream: string): string[] {
	const failures: string[] = [];
	const { tools, reply } = said(stream);
	for (const [path, patterns] of Object.entries(expect.files)) {
		const file = join(repo, path);
		if (!existsSync(file)) failures.push(`${path} is missing`);
		else for (const pattern of patterns) if (!new RegExp(pattern, "m").test(readFileSync(file, "utf8"))) failures.push(`${path} does not match /${pattern}/`);
	}
	for (const path of expect.missing) if (existsSync(join(repo, path))) failures.push(`${path} exists`);
	for (const [ref, wanted] of Object.entries(expect.refs)) {
		const [was, is] = [before.get(ref), after.get(ref)];
		if (wanted === "kept" && was !== is) failures.push(`${ref} moved: ${was?.slice(0, 7) ?? "none"} to ${is?.slice(0, 7) ?? "none"}`);
		if (wanted === "moved" && (is === undefined || was === is)) failures.push(`${ref} ${is === undefined ? "is gone" : `stayed at ${is.slice(0, 7)}`}, expected to move`);
	}
	let from = 0;
	for (const pattern of expect.calls) {
		const at = calls.findIndex((call, index) => index >= from && new RegExp(pattern).test(call));
		if (at < 0) {
			failures.push(`no call matches /${pattern}/${from > 0 ? ` after ${calls[from - 1]}` : ""}`);
			break;
		}
		from = at + 1;
	}
	for (const pattern of expect.never) for (const call of calls.filter((each) => new RegExp(pattern).test(each))) failures.push(`${call} matches /${pattern}/`);
	const lines = reply.split("\n").filter((line) => line.trim() !== "").length;
	if (expect.reply.lines !== undefined && lines > expect.reply.lines) failures.push(`the reply has ${lines} lines, at most ${expect.reply.lines}`);
	for (const pattern of expect.reply.match) if (!new RegExp(pattern, "m").test(reply)) failures.push(`the reply does not match /${pattern}/`);
	for (const pattern of expect.reply.never) if (new RegExp(pattern, "m").test(reply)) failures.push(`the reply matches /${pattern}/`);
	for (const pattern of expect.tools) for (const tool of tools.filter((each) => new RegExp(pattern).test(each))) failures.push(`the agent's ${tool.split("\n")[0]?.slice(0, 200)} matches /${pattern}/`);
	return failures;
}

export async function evalRun(scenario: Scenario, agent: Agent, context: (root: string, hour: number) => string, pages: Readonly<Record<string, string>>, out: string): Promise<string[]> {
	const run = realpathSync(mkdtempSync(join(tmpdir(), "arthur-eval-")));
	try {
		const [repo, origin, stub, log] = [join(run, "repo"), join(run, "origin.git"), join(run, "bin", "arthur"), join(run, "arthur.log")];
		cpSync(join(scenario.folder, "fixture"), repo, { recursive: true });
		git(repo, "init", "--quiet", "--initial-branch=main");
		for (const [key, value] of [["user.name", "arthur eval"], ["user.email", "eval@localhost"], ["commit.gpgsign", "false"]] as const) git(repo, "config", key, value);
		git(repo, "add", "--all");
		git(repo, "commit", "--quiet", "--no-verify", "--allow-empty", "--message", "fixture");
		git(run, "init", "--quiet", "--bare", origin);
		git(repo, "remote", "add", "origin", origin);
		git(repo, "push", "--quiet", "--no-verify", "--set-upstream", "origin", "main");
		const before = refs(repo, origin);
		mkdirSync(join(run, "bin"));
		writeStub(stub, repo, log, scenario.stub, pages);
		writeFileSync(join(run, "prompt.md"), context(repo, scenario.hour));
		writeFileSync(join(run, "turn.md"), scenario.turn);
		// No ARTHUR_ variable of this process reaches the turn (a job's record, a plugin's folder).
		const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ARTHUR_"))), PATH: `${join(run, "bin")}${delimiter}${process.env.PATH ?? ""}`, ARTHUR_EVAL: stub, TZ: zoneAt(scenario.hour) };
		const ended = await session({ command: agent.command, args: [...agent.args, "--append-system-prompt", join(run, "prompt.md")] }, run, repo, env, scenario.timeoutSeconds);
		// A help call (eval-stub.ts) only read a page: no expectation counts it.
		const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((entry) => entry.help !== true).map((entry) => String(entry.call)) : [];
		const failures = ended !== "" ? [ended] : score(scenario.expect, repo, before, refs(repo, origin), calls, readFileSync(join(run, "stream.jsonl"), "utf8"));
		mkdirSync(out, { recursive: true });
		for (const file of ["turn.md", "stream.jsonl", "stderr", "arthur.log"]) if (existsSync(join(run, file))) cpSync(join(run, file), join(out, file));
		writeFileSync(join(out, "failures"), failures.map((line) => `${line}\n`).join(""));
		return failures;
	} catch (error) {
		return [`the run failed: ${(error as Error).message.split("\n")[0]}`];
	} finally {
		rmSync(run, { recursive: true, force: true });
	}
}
