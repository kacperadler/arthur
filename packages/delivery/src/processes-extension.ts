import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// Delivery's OMP extension that reminds a job's agent of the processes it left running (AR0585), loaded with `-e` like
// checks-extension.ts: at the end of a run (omp's `session_stop`, which comes right before `agent_end`, so its continuation
// goes on with the same run before its last message counts as the result), the job's processes other than the agent and its
// wrapper, when there are any, are named to the agent once, which then stops those it no longer needs and ends again. The
// wrapper still kills what is left in the job's scope when the job ends: docs/delivery.md, "Processes a job leaves running".

type Continuation = { readonly continue: true; readonly additionalContext: string } | undefined;
type ExtensionApi = { on(event: "session_stop", handler: () => Continuation): void };

export default function processes(pi: ExtensionApi): void {
	const record = process.env.ARTHUR_JOB;
	if (record === undefined || record === "") return;
	// Once per run, which is one omp process: the second end of the run is its end.
	let reminded = false;
	pi.on("session_stop", () => {
		if (reminded) return undefined;
		const left = leftovers(basename(record));
		if (left.length === 0) return undefined;
		reminded = true;
		// omp reads a file a message names as `@<path>` into the turn: a word joiner before each such `@` of a command line.
		const named = left.map(({ pid, command }) => `- pid ${pid}: ${command.replace(/(?<=^|[\s([{<"'`])@/g, "\u2060@")}`);
		const intro = "[Arthur] Before your run ends: these processes of your job are still running.";
		const ask = "Stop each one you started and no longer need (a dev server, a watcher, a test run in the background) and leave the rest. Then end with your final message again, whole: the job's result is your last message, not the one above.";
		return { continue: true, additionalContext: `${intro}\n\n${named.join("\n")}\n\n${ask}` };
	});
}

// The processes of job `id` but the agent (this process) and its wrapper (its parent): in the job's systemd scope,
// `arthur-job-<id>.scope`, every one, a daemon that left the agent's process tree included; in a job that runs bare, the
// agent's descendants.
function leftovers(id: string): { readonly pid: number; readonly command: string }[] {
	const self = "/proc/self/cgroup";
	const cgroup = /^0::(.*)$/m.exec(existsSync(self) ? readFileSync(self, "utf8") : "")?.[1];
	const procs = join("/sys/fs/cgroup", cgroup ?? "", "cgroup.procs");
	const scope = cgroup?.endsWith(`/arthur-job-${id}.scope`) && existsSync(procs) ? new Set(readFileSync(procs, "utf8").split("\n").filter(Boolean).map(Number)) : undefined;
	const ps = spawnSync("ps", ["-A", "-o", "pid=,ppid=,args="], { encoding: "utf8" });
	// Without `ps` (ENOENT), none: a handler that throws would break the run's end.
	const all = (ps.stdout ?? "")
		.split("\n")
		.map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
		.flatMap((match) => (match === null ? [] : [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] ?? "" }]));
	// The agent's descendants: each process whose parent is one already, in any order ps lists them.
	const below = [process.pid];
	for (const parent of scope === undefined ? below : []) for (const each of all) if (each.ppid === parent) below.push(each.pid);
	const job = scope ?? new Set(below);
	return all.filter(({ pid }) => job.has(pid) && pid !== process.pid && pid !== process.ppid && pid !== ps.pid).map(({ pid, command }) => ({ pid, command }));
}
