import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentStream } from "./agent-stream.ts";
import { eventBus } from "./events.ts";
import { deadline, reached } from "./job-limits.ts";
import { endScope } from "./job-scope.ts";
import { signal, stopGroup } from "./job-stop.ts";
import { commitsSince } from "./git.ts";
import { runRecord } from "./run-record.ts";
import { closeSteers } from "./steer-inbox.ts";

// The wrapper (spec/roadmap.md, entry 11): one background process per job, `node wrapper.ts <home> <id> <agent>`, started
// in the job's scope by `launch` (job-scope.ts); it starts the agent, in a process group of its own, in the job's worktree
// and keeps the record `<home>/jobs/<id>/` current from what the agent prints: `pid` and `state` (`running`) first, then
// `log`, `result`, `cost`, `tool-calls`, `activity` and `checks` as they change; at the end every one of them and `commits`,
// then `state` (`done`, `failed`, `stopped`, `limit: time` or `limit: budget`) last, so a reader that sees it final can
// trust the rest; then `job-ended`. SIGTERM to the wrapper (`arthur stop`, entry 14) and a job past its record's `timeout`
// or `budget` (entry 12) run the one stop (job-stop.ts); a kind with `resume-on-budget` gets one resume at its budget,
// doubled. A record with `continue` (`arthur continue`) resumes the agent's session with it. Once the agent is done, what
// is left in the job's scope is killed (entry 13), and steers still waiting are moved aside. A record deleted while the job
// runs stops the agent and what is left in its scope, and ends the wrapper with one line on its own output,
// `<home>/wrapper.log`, writing nothing else.

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
	let child: ChildProcess | undefined;
	const leave = (): never => {
		if (child?.pid !== undefined) signal(-child.pid, "SIGTERM");
		endScope(id);
		process.stderr.write(`[arthur ${new Date().toISOString()}] job ${id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written\n`);
		process.exit(1);
	};
	// A use of the record that finds it gone ends the wrapper.
	const guard = <T>(use: () => T): T => {
		try {
			return use();
		} catch (error) {
			if (existsSync(folder)) throw error;
			return leave();
		}
	};
	// A file of the record written whole (under a temporary name, then renamed), or appended to.
	const save = (name: string, text: string | Uint8Array, append = false): void =>
		guard(() => {
			if (append) return appendFileSync(join(folder, name), text);
			writeFileSync(join(folder, `.${name}`), text);
			renameSync(join(folder, `.${name}`), join(folder, name));
		});
	const field = (name: string): string => guard(() => readFileSync(join(folder, name), "utf8"));
	const note = (line: string) => save("log", `[arthur ${new Date().toISOString()}] ${line}\n`, true);
	const names = ["kind", "project", "model", "thinking", "branch", "root", "worktree", "base", "timeout", "budget", "resume-on-budget"];
	const [kind = "", project = "", model = "", thinking = "", branch = "", root = "", worktree = "", base = "", timeout = "", budget = "", resumes = ""] = names.map(field);
	const [instruction, spent] = ["continue", "cost"].map((name) => (existsSync(join(folder, name)) ? field(name) : undefined));
	// A resumed run continues the agent's last session in the worktree, which is the job's own, with `resume` as its message.
	const args = (resume: string | undefined) => [
		...(resume === undefined ? [] : ["--continue"]),
		...["-p", "--mode", "json", "--auto-approve", "--tools", branch === "" ? READ_ONLY_TOOLS : WORKER_TOOLS],
		...["--append-system-prompt", join(folder, "prompt")],
		...["-e", join(import.meta.dirname, "env-guard.ts"), "-e", join(import.meta.dirname, "steer.ts")],
		...(model ? ["--model", model] : []),
		...(thinking ? ["--thinking", thinking] : []),
		resume ?? `@${join(folder, "task")}`,
	];
	// What stopped the job first, which its state says, whatever came after; `final` once nothing may resume it: its time
	// is up, or `arthur stop` asked. A stop that comes once the agent exited on its own leaves its ending as it is.
	let why = undefined as "time" | "budget" | "stop" | undefined;
	let final = false;
	let stopping = Promise.resolve();
	const halt = (which: "time" | "budget" | "stop") => {
		final ||= which !== "budget";
		const what = which === "stop" ? "arthur stop" : `limit: ${which}`;
		if (why !== undefined) return which === "budget" || note(`${what}: ${which === "stop" ? "asked" : "reached"} as well`);
		if (which === "stop" && (child?.exitCode !== null || child.signalCode !== null)) return note("arthur stop: the agent had ended already");
		why = which;
		note(`${what}: stopping the agent`);
		if (child?.pid !== undefined) stopping = stopGroup(child.pid, id, note);
	};
	process.on("SIGTERM", () => halt("stop"));
	save("pid", String(process.pid));
	save("state", "running");
	let budgetUsd = Number(budget);
	const cancel = deadline(Number(timeout), () => halt("time"));
	const record = runRecord(save, worktree, Number(spent ?? 0) || 0, (cost) => reached(cost, budgetUsd) && halt("budget"));

	let failure = undefined as Error | undefined;
	// One run of the agent, until it exits, its output is read and its stop, if any, is over.
	const play = async (argv: readonly string[]): Promise<[number | null, NodeJS.Signals | null]> => {
		note(`agent: ${agent} ${argv.join(" ")}`);
		const stream = agentStream();
		const closed = Promise.withResolvers<[number | null, NodeJS.Signals | null]>();
		const env = { ...process.env, ARTHUR_JOB: folder };
		const running = spawn(agent, argv, { cwd: worktree, stdio: ["ignore", "pipe", "pipe"], detached: true, env });
		child = running;
		running.stdout.setEncoding("utf8");
		running.stdout.on("data", (chunk: string) => record.apply(stream.push(chunk)));
		running.stderr.on("data", (chunk: Buffer) => save("log", chunk, true));
		running.once("error", (error) => (failure = error));
		running.once("close", (code, killed) => closed.resolve([code, killed]));
		const ending = await closed.promise;
		record.apply(stream.end());
		await stopping;
		return ending;
	};
	let [code, killed] = await play(args(instruction));
	if (why === "budget" && !final && resumes === "true") {
		const doubled = budgetUsd * 2;
		note(`limit: budget: $${record.cost().toFixed(4)} reached $${budgetUsd}; the kind resumes once, its budget doubled to $${doubled}`);
		save("budget", String(doubled));
		[budgetUsd, why] = [doubled, undefined];
		record.clearStop();
		[code, killed] = await play(args(`Your budget of $${budget} ran out and was doubled to $${doubled}, once. Go on with the task where you stopped.`));
	}
	cancel();
	endScope(id);
	const undelivered = guard(() => {
		if (!existsSync(folder)) return leave();
		mkdirSync(join(folder, "steer"), { recursive: true });
		return closeSteers(join(folder, "steer"), String(process.pid), note);
	});

	let commits = "";
	try {
		if (branch !== "") commits = commitsSince(root, base, branch);
	} catch (error) {
		note(`no commits listed: ${error instanceof Error ? error.message : String(error)}`);
	}
	const [state, reason] =
		why === "stop" ? ["stopped", "the job was stopped by arthur stop"]
		: why === "time" ? ["limit: time", `the job ran past its timeout of ${timeout} minutes`]
		: why === "budget" ? ["limit: budget", `its cost $${record.cost().toFixed(4)} reached its budget of $${budgetUsd}`]
		: failure !== undefined ? ["failed", `the agent did not start: ${failure.message}`]
		: killed !== null ? ["failed", `the agent was killed by ${killed}`]
		: record.stopped() !== "" ? ["failed", `the agent stopped on ${record.stopped()}`]
		: code !== 0 ? ["failed", `the agent exited ${code}`]
		: record.result() === "" ? ["failed", "the agent ended without a final message"]
		: ["done", "the agent exited 0"];
	record.end();
	save("commits", commits === "" ? "" : `${commits}\n`);
	note(`${state}: ${reason}`);
	save("state", state);
	eventBus(home).emit("core", "job-ended", { id, kind, project, state, reason, ...(undelivered.length > 0 ? { undelivered } : {}) });
}
