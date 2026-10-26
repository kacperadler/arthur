import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { oomFirst } from "./job-memory.ts";

// The install a prepare asks for with the variable `ARTHUR_INSTALL` (the projects plugin's), the wrapper's first step: in the
// worktree, in the job's scope, so its caps and `endScope` cover the lifecycle scripts it runs (AR0373), and in the sandbox
// `sandbox` starts `sh -c <command>` in (job-sandbox.ts; AR0449), so branch code reads no secret of Arthur's; its output in the
// job's log. `started` gets its process, which a stop or a limit stops as it would the agent; a pipe a process it left holds
// open is read 2 s past its exit, then closed. Resolves to why it failed, undefined when it passed or there was none.
export async function install(command: string | undefined, worktree: string, sandbox: (command: string) => [string, string[]], note: (line: string) => void, log: (chunk: Buffer) => void, started: (child: ChildProcess) => void): Promise<Error | undefined> {
	if (!command) return undefined;
	note(`install: ${command}`);
	const child = oomFirst(() => spawn(...sandbox(command), { cwd: worktree, stdio: ["ignore", "pipe", "pipe"], detached: true }));
	started(child);
	const out = { stdout: "", stderr: "" };
	for (const name of ["stdout", "stderr"] as const) child[name].on("data", (chunk: Buffer) => void ((out[name] += chunk), log(chunk)));
	child.once("exit", () => setTimeout(() => [child.stdout, child.stderr].forEach((pipe) => pipe.destroy()), 2000).unref());
	const [code, signal] = (await once(child, "close")) as [number | null, NodeJS.Signals | null];
	if (code === 0) return undefined;
	const last = (out.stderr.trim() || out.stdout.trim()).split("\n").at(-1);
	return new Error(`install \`${command}\` exited ${code ?? signal}${last ? `: ${last}` : ""}`);
}
