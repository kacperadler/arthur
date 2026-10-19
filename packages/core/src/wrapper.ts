import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentStream } from "./agent-stream.ts";
import { eventBus } from "./events.ts";
import { deadline, reached } from "./job-limits.ts";
import { oomFirst, watchMemory } from "./job-memory.ts";
import { endScope } from "./job-scope.ts";
import { signal, stopGroup } from "./job-stop.ts";
import { blockedBy, current, kept, moveJob, type State } from "./job-state.ts";
import { commitsSince } from "./git.ts";
import { runRecord } from "./run-record.ts";
import { closeSteers } from "./steer-inbox.ts";

// One background process per job, `node wrapper.ts <home> <id> <agent>`, started in the job's scope by `launch` (job-scope.ts);
// what it writes and when: docs/commands/spawn.md. A pipe a process the agent left holds open is read 2 s past its exit, then closed.

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
	const names = ["kind", "project", "model", "thinking", "branch", "root", "worktree", "base", "timeout", "budget", "resume-on-budget", "idle-minutes"];
	const [kind = "", project = "", model = "", thinking = "", branch = "", root = "", worktree = "", base = "", timeout = "", budget = "", resumes = "", idle = ""] = names.map(field);
	const bus = eventBus(home);
	// A move from `from` to `to` (job-state.ts) only: a job a plugin holds is `blocked` until `unblock`, so it never moves here.
	const move = (from: State, to: State) => guard(() => moveJob(home, id, bus, (now) => (now.state === from ? [to, ""] : undefined)));
	// The agent's output: `active` takes its time, an idle job works again, and it turns idle after `idle-minutes` without any.
	let quiet = () => {};
	const active = () => {
		guard(() => utimesSync(join(folder, "active"), new Date(), new Date()));
		if (field("state") === "idle") move("idle", "working");
		quiet();
		quiet = deadline(Number(idle), () => move("working", "idle"));
	};
	// `quick` and `memory` are missing from a record an older Arthur wrote.
	const [instruction, spent, quick, memory = ""] = ["continue", "cost", "quick", "memory"].map((name) => (existsSync(join(folder, name)) ? field(name) : undefined));
	// A resumed run continues the agent's last session in the worktree, which is the job's own, with `resume` as its message.
	const args = (resume: string | undefined) => [
		...(resume === undefined ? [] : ["--continue"]),
		...["-p", "--mode", "json", "--auto-approve", "--tools", branch === "" ? READ_ONLY_TOOLS : WORKER_TOOLS],
		...["--append-system-prompt", join(folder, "prompt")],
		...["env-guard.ts", "worktree-guard.ts", "steer.ts"].flatMap((extension) => ["-e", join(import.meta.dirname, extension)]),
		...(model ? ["--model", model] : []),
		...(thinking ? ["--thinking", thinking] : []),
		...(quick ? ["--smol", quick] : []),
		resume ?? `@${join(folder, "task")}`,
	];
	// What stopped the job first, which its state says, whatever came after; `final` once nothing may resume it: its time
	// is up, its memory went over its cap, or `arthur stop` asked. A stop that comes once the agent exited on its own leaves its
	// ending as it is.
	type Why = "time" | "budget" | "memory" | "stop";
	let why = undefined as Why | undefined;
	let final = false;
	let stopping = Promise.resolve();
	const halt = (which: Why) => {
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
	save("active", "");
	active();
	rmSync(join(folder, "continuing"), { recursive: true, force: true });
	let budgetUsd = Number(budget);
	const cancel = deadline(Number(timeout), () => halt("time"));
	const record = runRecord(save, Number(spent ?? 0) || 0, (cost) => reached(cost, budgetUsd) && halt("budget"));
	const watching = watchMemory(id, memory, () => halt("memory"));

	let failure = undefined as Error | undefined;
	// One run of the agent, until it exits, its output is read and its stop, if any, is over.
	const play = async (argv: readonly string[]): Promise<[number | null, NodeJS.Signals | null]> => {
		note(`agent: ${agent} ${argv.join(" ")}`);
		const stream = agentStream();
		const closed = Promise.withResolvers<[number | null, NodeJS.Signals | null]>();
		const running = oomFirst(() => spawn(agent, argv, { cwd: worktree, env: { ...process.env, ARTHUR_JOB: folder }, stdio: ["ignore", "pipe", "pipe"], detached: true }));
		child = running;
		running.stdout.setEncoding("utf8");
		running.stdout.on("data", (chunk: string) => {
			record.apply(stream.push(chunk));
			active();
		});
		running.stderr.on("data", (chunk: Buffer) => {
			save("log", chunk, true);
			active();
		});
		running.once("error", (error) => (failure = error));
		running.once("exit", () => setTimeout(() => [running.stdout, running.stderr].forEach((pipe) => pipe.destroy()), 2000).unref());
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
	quiet();
	// A kill over the cap that ended the agent before a sample saw it ends the job at the cap all the same.
	if (watching() && why === undefined) why = "memory";
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
	const reason =
		why === "stop" ? "stopped"
		: why === "time" ? `limit: time: the job ran past its timeout of ${timeout} minutes`
		: why === "budget" ? `limit: budget: its cost $${record.cost().toFixed(4)} reached its budget of $${budgetUsd}`
		: why === "memory" ? `limit: memory: the job went over its memory cap of ${memory}`
		: failure !== undefined ? `failed: the agent did not start: ${failure.message}`
		: killed !== null ? `failed: the agent was killed by ${killed}`
		: record.stopped() !== "" ? `failed: the agent stopped on ${record.stopped()}`
		: code !== 0 ? `failed: the agent exited ${code}`
		: record.result() === "" ? "failed: the agent ended without a final message"
		: "finished";
	// A run that finished on a `Blocked:` line waits for what it names; a plugin's hold ends with the run, unless it stopped the run.
	const blocked = kept(guard(() => current(home, id))) ?? (reason === "finished" ? blockedBy(record.result()) : undefined);
	const [state, said] = blocked === undefined ? (["ended", reason] as const) : (["blocked", blocked] as const);
	record.end();
	save("commits", commits === "" ? "" : `${commits}\n`);
	note(`${state}: ${said}`);
	guard(() =>
		moveJob(home, id, bus, () => {
			rmSync(join(folder, "hold"), { force: true });
			return [state, said];
		}),
	);
	bus.emit("core", "job-ended", { id, kind, project, state, reason: said, ...(undelivered.length > 0 ? { undelivered } : {}) });
}
