import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AgentEvent, agentStream } from "./agent-stream.ts";
import { checkLines, declaredChecks } from "./checks.ts";
import { eventBus } from "./events.ts";
import { deadline, reached } from "./job-limits.ts";
import { endScope } from "./job-scope.ts";
import { commitsSince } from "./git.ts";

// The wrapper (spec/roadmap.md, entry 11): one background process per job, `node wrapper.ts <home> <id> <agent>`, started
// in the job's scope by `launch` (job-scope.ts); it starts the agent in the job's worktree and keeps the record
// `<home>/jobs/<id>/` current from what the agent prints: `pid` and `state` (`running`) first, then `log`, `result`,
// `cost`, `tool-calls`, `activity` and `checks` as they change; at the end every one of them and `commits`, then `state`
// (`done`, `failed`, `limit: time` or `limit: budget`) last, so a reader that sees it final can trust the rest; then
// `job-ended`. A job past its record's `timeout` or `budget` (entry 12) is
// stopped; a kind with `resume-on-budget` gets one resume at its budget, doubled. Once the agent is done, before the end's
// files, what is left in the job's scope is killed (entry 13). A record deleted while the job runs stops the agent and
// what is left in its scope, and ends the wrapper with one line on its own output, `<home>/wrapper.log`, writing nothing else.

const WORKER_TOOLS = "read,edit,write,bash,grep,glob";
const READ_ONLY_TOOLS = "read,bash,grep,glob";

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
		endScope(id);
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
	const names = ["kind", "project", "model", "thinking", "branch", "root", "worktree", "base", "timeout", "budget", "resume-on-budget"];
	const [kind = "", project = "", model = "", thinking = "", branch = "", root = "", worktree = "", base = "", timeout = "", budget = "", resumes = ""] = names.map(field);
	// A resumed run continues the agent's last session in the worktree, which is the job's own, with `resume` as its message.
	const args = (resume?: string) => [
		...(resume === undefined ? [] : ["--continue"]),
		...["-p", "--mode", "json", "--auto-approve", "--tools", branch === "" ? READ_ONLY_TOOLS : WORKER_TOOLS],
		...["--append-system-prompt", join(folder, "prompt")],
		...(model ? ["--model", model] : []),
		...(thinking ? ["--thinking", thinking] : []),
		resume ?? `@${join(folder, "task")}`,
	];
	save("pid", String(process.pid));
	save("state", "running");
	let child: ChildProcess | undefined;
	// SIGTERM to the job's process group, which `launch` makes the wrapper lead: the agent and every process it started (a
	// bash call's `npm test`, a server) stop with it, while the wrapper ignores its own copy to write its line. A wrapper
	// started by hand leads no group, and only the agent gets it.
	stopAgent = () => {
		if (process.listenerCount("SIGTERM") === 0) process.on("SIGTERM", () => {});
		try {
			process.kill(-process.pid, "SIGTERM");
		} catch {
			child?.kill("SIGTERM");
		}
	};
	// The first limit the job reached stops it; `late` once its time is up, which a resume never gets back.
	let limit = undefined as "time" | "budget" | undefined;
	let late = false;
	let budgetUsd = Number(budget);
	const stopAt = (which: "time" | "budget") => {
		if (limit !== undefined) return;
		limit = which;
		note(`limit: ${which}: stopping the agent`);
		stopAgent();
	};
	const cancel = deadline(Number(timeout), () => {
		late = true;
		if (limit === undefined) stopAt("time");
		else note("limit: time: reached as well");
	});

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
				if (reached(cost, budgetUsd)) stopAt("budget");
			}
		}
	};
	let failure = undefined as Error | undefined;
	// One run of the agent, until it exits and its output is read.
	const play = async (argv: readonly string[]): Promise<[number | null, NodeJS.Signals | null]> => {
		note(`agent: ${agent} ${argv.join(" ")}`);
		const stream = agentStream();
		const closed = Promise.withResolvers<[number | null, NodeJS.Signals | null]>();
		const running = spawn(agent, argv, { cwd: worktree, stdio: ["ignore", "pipe", "pipe"] });
		child = running;
		running.stdout.setEncoding("utf8");
		running.stdout.on("data", (chunk: string) => apply(stream.push(chunk)));
		running.stderr.on("data", (chunk: Buffer) => save("log", chunk, true));
		running.once("error", (error) => (failure = error));
		running.once("close", (code, signal) => closed.resolve([code, signal]));
		const ending = await closed.promise;
		apply(stream.end());
		return ending;
	};
	let [code, signal] = await play(args());
	if (limit === "budget" && !late && resumes === "true") {
		const doubled = budgetUsd * 2;
		note(`limit: budget: $${cost.toFixed(4)} reached $${budgetUsd}; the kind resumes once, its budget doubled to $${doubled}`);
		save("budget", String(doubled));
		[budgetUsd, limit, stopped] = [doubled, undefined, ""];
		[code, signal] = await play(args(`Your budget of $${budget} ran out and was doubled to $${doubled}, once. Go on with the task where you stopped.`));
	}
	cancel();
	endScope(id);

	let commits = "";
	try {
		if (branch !== "") commits = commitsSince(root, base, branch);
	} catch (error) {
		note(`no commits listed: ${error instanceof Error ? error.message : String(error)}`);
	}
	const [state, reason] =
		limit === "time" ? ["limit: time", `the job ran past its timeout of ${timeout} minutes`]
		: limit === "budget" ? ["limit: budget", `its cost $${cost.toFixed(4)} reached its budget of $${budgetUsd}`]
		: failure !== undefined ? ["failed", `the agent did not start: ${failure.message}`]
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
