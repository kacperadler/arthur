import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, closeSync, constants, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agentStream } from "./agent-stream.ts";
import { eventBus } from "./events.ts";
import { deadline, reached } from "./job-limits.ts";
import { install } from "./job-install.ts";
import { oomFirst, watchMemory } from "./job-memory.ts";
import { cached, hidden, sandboxed, unsigned, writable } from "./job-sandbox.ts";
import { endScope } from "./job-scope.ts";
import { signal, stopGroup } from "./job-stop.ts";
import { blockedBy, current, kept, moveJob, type State } from "./job-state.ts";
import { commitsSince } from "./git.ts";
import { runRecord } from "./run-record.ts";
import { envFileNames, namedChunks } from "./secret-names.ts";
import { closeSteers } from "./steer-inbox.ts";

// One background process per job, `node wrapper.ts <home> <id> <agent>`, started in the job's scope by `launch` (job-scope.ts); what it writes and when: docs/commands/spawn.md. A pipe a process the agent left holds open is read 2 s past its exit, then closed.

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
	let [child, playing] = [undefined as ChildProcess | undefined, false]; // `playing` once the agent, not the install, is `child`.
	const leave = (): never => {
		if (child?.pid !== undefined) signal(-child.pid, "SIGTERM");
		endScope(id);
		process.stderr.write(`[arthur ${new Date().toISOString()}] job ${id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written\n`);
		process.exit(1);
	};
	// A use of the record that finds it, or the `pid` or `log` it made at its start, gone ends the wrapper (a `rm -r` midway).
	let started = false;
	const gone = () => !existsSync(folder) || (started && (!existsSync(join(folder, "pid")) || !existsSync(join(folder, "log"))));
	const guard = <T>(use: () => T): T => {
		try {
			return use();
		} catch (error) {
			if (!gone()) throw error;
			return leave();
		}
	};
	// A file of the record written whole (under a temporary name, then renamed), or appended to without creating it (`rm -r`); text named (secret-names.ts).
	const save = (name: string, text: string, append = false): void =>
		guard(() => {
			const fd = openSync(join(folder, append ? name : `.${name}`), append ? constants.O_WRONLY | constants.O_APPEND : "w");
			writeFileSync(fd, hide(text));
			closeSync(fd);
			if (!append) renameSync(join(folder, `.${name}`), join(folder, name));
		});
	const field = (name: string): string => guard(() => readFileSync(join(folder, name), "utf8"));
	const note = (line: string) => save("log", `[arthur ${new Date().toISOString()}] ${line}\n`, true);
	const names = ["kind", "project", "model", "thinking", "branch", "root", "worktree", "base", "timeout", "budget", "resume-on-budget", "idle-minutes"];
	const [kind = "", project = "", model = "", thinking = "", branch = "", root = "", worktree = "", base = "", timeout = "", budget = "", resumes = "", idle = ""] = names.map(field);
	const secrets = hidden(folder), hide = envFileNames(secrets), bus = eventBus(home, hide), installed = namedChunks(hide, (text) => save("log", text, true)); // Read once, before the install a prepare asked for (job-install.ts), so what it writes to the record changes neither what the agent may read nor which values are named.
	// A move from `from` to `to` (job-state.ts) only: a job a plugin holds stays `blocked` until its run ends, so it never moves here.
	const move = (from: State, to: State) => guard(() => moveJob(home, id, bus, (now) => (now.state === from ? [to, ""] : undefined)));
	// The agent's output: `active` takes its time, an idle job works again, and it turns idle after `idle-minutes` without any.
	let quiet = () => {};
	const active = () => {
		guard(() => utimesSync(join(folder, "active"), new Date(), new Date()));
		if (field("state") === "idle") move("idle", "working");
		quiet();
		quiet = deadline(Number(idle), () => move("working", "idle"));
	};
	// `quick`, `memory`, `feature`, `feature-memory`, `verdicts` and `extensions` are missing from a record an older Arthur wrote.
	const [instruction, spent, quick, memory = "", feature = "", featureMemory = "", verdicts = "", extensions = ""] = ["continue", "cost", "quick", "memory", "feature", "feature-memory", "verdicts", "extensions"].map((name) => (existsSync(join(folder, name)) ? field(name) : undefined));
	// A resumed run continues the agent's last session in the worktree, which is the job's own, with `resume` as its message after `--`, text even when it starts with `-` or `@` (AR0487); the task `@<record>/task` goes before it, as omp includes a file only from there.
	const args = (resume: string | undefined) => [
		...(resume === undefined ? [] : ["--continue"]),
		...["-p", "--mode", "json", "--auto-approve", "--tools", branch === "" ? READ_ONLY_TOOLS : WORKER_TOOLS],
		// The role's MCP servers when the spawn wrote them (job-record.ts); the overlay keeps a read-only role without `write`.
		...(existsSync(join(folder, "mcp")) ? ["--plugin-dir", join(folder, "mcp"), "--config", join(folder, "mcp.yml")] : []),
		...["--append-system-prompt", join(folder, "prompt")],
		// The core's extensions, then those the plugins registered (`extensions`, paths from this folder: job-record.ts).
		...["env-guard.ts", "worktree-guard.ts", "steer.ts", ...extensions.split("\n").filter(Boolean)].flatMap((extension) => ["-e", resolve(import.meta.dirname, extension)]),
		// A provider model goes under the name of omp's provider that the job's environment sets (`ARTHUR_AGENT_MODEL`, job-scope.ts).
		...(model ? ["--model", process.env.ARTHUR_AGENT_MODEL || model] : []),
		...(thinking ? ["--thinking", thinking] : []),
		...(quick ? ["--smol", quick] : []),
		...(resume === undefined ? [`@${join(folder, "task")}`] : ["--", resume]),
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
		if (which === "stop" && playing && (child?.exitCode !== null || child.signalCode !== null)) return note("arthur stop: the agent had ended already");
		why = which;
		note(`${what}: stopping the ${playing ? "agent" : "install"}`);
		if (child?.pid !== undefined) stopping = stopGroup(child.pid, id, note);
	};
	process.on("SIGTERM", () => halt("stop"));
	guard(() => appendFileSync(join(folder, "log"), "")); // The one use that creates `log`.
	save("pid", String(process.pid));
	started = true;
	save("active", "");
	active();
	rmSync(join(folder, "continuing"), { recursive: true, force: true });
	let budgetUsd = Number(budget);
	const cancel = deadline(Number(timeout), () => halt("time"));
	const record = runRecord(save, Number(spent ?? 0) || 0, (cost) => reached(cost, budgetUsd) && halt("budget"));
	// What went over a memory cap, the job's own or its ticket's.
	let overCap = "";
	const watching = watchMemory(id, memory, feature, featureMemory, (what) => {
		overCap = what;
		halt("memory");
	});
	let failure = await install(process.env.ARTHUR_INSTALL, worktree, (command) => sandboxed(writable(folder, worktree, extensions), secrets, "env", note, "the install")(cached(join(folder, "cache"), command)), note, (chunk) => installed.push(chunk), (running) => (child = running)).finally(installed.end); // The install runs first, in the job's sandbox, its package caches in the record's `cache` (AR0454); one that fails, or a stop or a limit during it, starts no agent.
	// One run of the agent, until it exits, its output is read and its stop, if any, is over.
	const play = async (argv: readonly string[]): Promise<[number | null, NodeJS.Signals | null]> => {
		note(`agent: ${agent} ${argv.join(" ")}`);
		const stream = agentStream(), errors = namedChunks(hide, (text) => save("log", text, true));
		const closed = Promise.withResolvers<[number | null, NodeJS.Signals | null]>();
		const running = oomFirst(() => spawn(...sandboxed(writable(folder, worktree, extensions), secrets, agent, note)(argv), { cwd: worktree, env: { ...process.env, ...unsigned(process.env), ARTHUR_JOB: folder }, stdio: ["ignore", "pipe", "pipe"], detached: true }));
		[child, playing] = [running, true];
		for (const pipe of [running.stdout, running.stderr]) pipe.setEncoding("utf8");
		running.stdout.on("data", (chunk: string) => {
			record.apply(stream.push(chunk));
			active();
		});
		running.stderr.on("data", (chunk: string) => {
			errors.push(chunk);
			active();
		});
		running.once("error", (error) => (failure = error));
		running.once("exit", () => setTimeout(() => [running.stdout, running.stderr].forEach((pipe) => pipe.destroy()), 2000).unref());
		running.once("close", (code, killed) => (errors.end(), closed.resolve([code, killed])));
		const ending = await closed.promise;
		record.apply(stream.end());
		await stopping;
		return ending;
	};
	let [code, killed] = failure === undefined && why === undefined ? await play(args(instruction)) : ([null, null] as const);
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
	const went = watching();
	if (went !== undefined && why === undefined) [why, overCap] = ["memory", went];
	endScope(id);
	const undelivered = guard(() => {
		if (gone()) return leave();
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
		: why === "time" ? `limit: time: the job ran past its timeout of ${timeout} minutes${playing ? "" : ", during its install"}`
		: why === "budget" ? `limit: budget: its cost $${record.cost().toFixed(4)} reached its budget of $${budgetUsd}`
		: why === "memory" ? `limit: memory: ${overCap}`
		: failure !== undefined ? `failed: the agent did not start: ${failure.message}`
		: killed !== null ? `failed: the agent was killed by ${killed}`
		: record.stopped() !== "" ? `failed: the agent stopped on ${record.stopped()}`
		: code !== 0 ? `failed: the agent exited ${code}`
		: record.result() === "" ? "failed: the agent ended without a final message"
		: verdicts !== "" && !verdicts.split("\n").includes(record.result().trimEnd().split("\n").at(-1)?.trim() ?? "") ? `failed: no verdict: the last line of its final message is not ${verdicts.split("\n").join(" or ")} alone`
		: "finished";
	// A run that finished on a `Blocked:` line waits for what it names; a plugin's hold ends with the run, unless it stopped the run.
	const blocked = kept(guard(() => current(home, id))) ?? (reason === "finished" ? blockedBy(record.result()) : undefined);
	const [state, said] = blocked === undefined ? (["ended", reason] as const) : (["blocked", blocked] as const);
	record.end();
	save("commits", commits === "" ? "" : `${commits}\n`);
	rmSync(join(folder, "mcp"), { recursive: true, force: true }); // The role's MCP secrets, before the state: job-record.ts `writeMcp`.
	note(`${state}: ${said}`);
	guard(() =>
		moveJob(home, id, bus, () => {
			rmSync(join(folder, "hold"), { force: true });
			return [state, hide(said)];
		}),
	);
	bus.emit("core", "job-ended", { id, kind, project, state, reason: said, ...(undelivered.length > 0 ? { undelivered } : {}) });
}
