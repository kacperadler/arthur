import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AgentEvent, agentStream } from "./agent-stream.ts";
import { checkLines, declaredChecks } from "./checks.ts";
import { eventBus } from "./events.ts";
import { commitsSince } from "./git.ts";

// The wrapper (spec/roadmap.md, entry 11): one background process per job, `node wrapper.ts <home> <id> <agent>`, which
// starts the agent in the job's worktree and keeps the record `<home>/jobs/<id>/` current from what the agent prints:
// `pid` and `state` (`running`) first, then `log`, `result`, `cost`, `tool-calls`, `activity` and `checks` as they change;
// at the end every one of them and `commits`, then `state` (`done` or `failed`) last, so a reader that sees it final can
// trust the rest; then `job-ended`. A record deleted while the job runs stops the agent and ends the wrapper with one line
// on its own output, `<home>/wrapper.log`, writing nothing else.

const WORKER_TOOLS = "read,edit,write,bash,grep,glob";
const READ_ONLY_TOOLS = "read,bash,grep,glob";

// Starts the wrapper of job `id` in a process group of its own and returns at once; `agent` is `core.agent.command`.
export function launch(home: string, id: string, agent: string): void {
	const log = join(home, "wrapper.log");
	const output = openSync(log, "a");
	try {
		spawn(process.execPath, [import.meta.filename, home, id, agent], { detached: true, stdio: ["ignore", output, output] })
			.on("error", (error) => appendFileSync(log, `[arthur ${new Date().toISOString()}] job ${id}: the wrapper did not start: ${error.message}\n`))
			.unref();
	} finally {
		closeSync(output);
	}
}

if (import.meta.main) {
	const [home, id, agent] = process.argv.slice(2);
	if (home === undefined || id === undefined || agent === undefined) {
		process.stderr.write("usage: node wrapper.ts <home> <job id> <agent command>\n");
		process.exit(2);
	}
	await run(home, id, agent);
}

async function run(home: string, id: string, agent: string): Promise<void> {
	const folder = join(home, "jobs", id);
	let stopAgent = () => {};
	const leave = (): never => {
		stopAgent();
		process.stderr.write(`[arthur ${new Date().toISOString()}] job ${id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written\n`);
		process.exit(1);
	};
	// A file of the record written whole (under a temporary name, then renamed), or appended to; a write that finds the
	// record gone ends the wrapper.
	const save = (name: string, text: string | Uint8Array, append = false): void => {
		try {
			if (append) return appendFileSync(join(folder, name), text);
			writeFileSync(join(folder, `.${name}`), text);
			renameSync(join(folder, `.${name}`), join(folder, name));
		} catch (error) {
			if (existsSync(folder)) throw error;
			leave();
		}
	};
	const field = (name: string): string => {
		try {
			return readFileSync(join(folder, name), "utf8");
		} catch (error) {
			if (existsSync(folder)) throw error;
			return leave();
		}
	};
	const note = (line: string) => save("log", `[arthur ${new Date().toISOString()}] ${line}\n`, true);
	const fields = ["kind", "project", "model", "thinking", "branch", "root", "worktree", "base"].map(field);
	const [kind = "", project = "", model = "", thinking = "", branch = "", root = "", worktree = "", base = ""] = fields;
	const args = [
		...["-p", "--mode", "json", "--auto-approve", "--tools", branch === "" ? READ_ONLY_TOOLS : WORKER_TOOLS],
		...["--append-system-prompt", join(folder, "prompt")],
		...(model ? ["--model", model] : []),
		...(thinking ? ["--thinking", thinking] : []),
		`@${join(folder, "task")}`,
	];
	save("pid", String(process.pid));
	save("state", "running");
	note(`agent: ${agent} ${args.join(" ")}`);
	const child = spawn(agent, args, { cwd: worktree, stdio: ["ignore", "pipe", "pipe"] });
	// SIGTERM to the job's process group, which `launch` makes the wrapper lead: the agent and every process it started (a
	// bash call's `npm test`, a server) stop with it, while the wrapper ignores its own copy to write its line. A wrapper
	// started by hand leads no group, and only the agent gets it.
	stopAgent = () => {
		process.on("SIGTERM", () => {});
		try {
			process.kill(-process.pid, "SIGTERM");
		} catch {
			child.kill("SIGTERM");
		}
	};

	let calls = 0;
	let cost = 0;
	let activity = "";
	let result = "";
	// The last message's stop when it was not a normal one: `error` or `aborted`, with omp's text.
	let stopped = "";
	const checks: string[] = [];
	const declared = declaredChecks(worktree);
	const act = (name: string) => name !== activity && save("activity", (activity = name));
	const apply = (events: readonly AgentEvent[]) => {
		for (const event of events) {
			if (event.kind === "line") save("log", `${event.line}\n`, true);
			else if (event.kind === "turn") act("think");
			else if (event.kind === "tool") {
				save("tool-calls", String(++calls));
				act("tool");
				save("log", `${event.name} ${event.detail}\n`, true);
			} else if (event.kind === "tool-end") {
				act("think");
				// An edit after a check makes the results the record holds stale: they no longer describe the code.
				const edit = event.name === "edit" || event.name === "write";
				const lines = edit ? (checks.length > 0 && checks.at(-1) !== "stale" ? ["stale"] : []) : checkLines(event.command ?? "", event.output, event.failed, declared);
				if (lines.length === 0) continue;
				checks.push(...lines);
				save("checks", `${checks.join("\n")}\n`);
			} else {
				if (event.text !== "") result = event.text;
				stopped = event.stopReason === "error" || event.stopReason === "aborted" ? [event.stopReason, event.error].filter(Boolean).join(": ") : "";
				cost += event.cost;
				save("cost", cost.toFixed(4));
			}
		}
	};
	const stream = agentStream();
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk: string) => apply(stream.push(chunk)));
	child.stderr.on("data", (chunk: Buffer) => save("log", chunk, true));
	let failure = undefined as Error | undefined;
	child.once("error", (error) => (failure = error));
	const closed = Promise.withResolvers<[number | null, NodeJS.Signals | null]>();
	child.once("close", (code, signal) => closed.resolve([code, signal]));
	const [code, signal] = await closed.promise;
	apply(stream.end());

	let commits = "";
	try {
		if (branch !== "") commits = commitsSince(root, base, branch);
	} catch (error) {
		note(`no commits listed: ${error instanceof Error ? error.message : String(error)}`);
	}
	const [state, reason] =
		failure !== undefined ? ["failed", `the agent did not start: ${failure.message}`]
		: signal !== null ? ["failed", `the agent was killed by ${signal}`]
		: stopped !== "" ? ["failed", `the agent stopped on ${stopped}`]
		: code !== 0 ? ["failed", `the agent exited ${code}`]
		: result === "" ? ["failed", "the agent ended without a final message"]
		: ["done", "the agent exited 0"];
	save("result", result);
	save("cost", cost.toFixed(4));
	save("tool-calls", String(calls));
	save("activity", activity);
	save("checks", checks.map((line) => `${line}\n`).join(""));
	save("commits", commits === "" ? "" : `${commits}\n`);
	note(`${state}: ${reason}`);
	save("state", state);
	eventBus(home).emit("core", "job-ended", { id, kind, project, state, reason });
}
