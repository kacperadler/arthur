import { spawn, spawnSync } from "node:child_process";
import type { Run } from "./github-api.ts";

// What the github plugin asks of a project's checkout (spec/roadmap.md, entries 57 and 58): the run that built a branch,
// and a branch pushed to origin, never with a prompt.

// The commits of a branch looked through for its nearest run, from its tip.
export const DEPTH = 1000;
const PUSH_MS = 60_000;

export const git = (path: string, ...args: readonly string[]) => {
	const ran = spawnSync("git", ["-C", path, ...args], { encoding: "utf8" });
	return ran.status === 0 ? ran.stdout.trim() : undefined;
};

// The run that built `branch`: the newest of `runs` (newest first) on the nearest commit of its first-parent line, from its
// tip back at most DEPTH commits, with how many commits below the tip that is; undefined for a branch gone or with none.
export function nearestRun(path: string, branch: string, runs: readonly Run[]): { readonly run: Run; readonly below: number } | undefined {
	const bySha = new Map<string, Run>();
	for (const run of runs) if (!bySha.has(run.sha)) bySha.set(run.sha, run);
	const commits = git(path, "rev-list", "--first-parent", `--max-count=${DEPTH}`, `refs/heads/${branch}`, "--")?.split("\n") ?? [];
	const below = commits.findIndex((sha) => bySha.has(sha));
	const run = bySha.get(commits[below] ?? "");
	return run === undefined ? undefined : { run, below };
}

// `git push origin <branch>`, resolving to one line: `github: pushed ...`, or `github: <branch> not pushed to origin: <why>`.
// No terminal, no prompt: git's own is off, Git Credential Manager is told never to ask, ssh may not use an askpass, and the
// push runs in a session of its own, which has no terminal to ask on; it is killed after PUSH_MS. A remote's URL is never
// said, as it may hold a credential.
export function push(path: string, branch: string): Promise<string> {
	const failed = (why: string) => `github: ${branch} not pushed to origin: ${why}`;
	if (git(path, "remote", "get-url", "origin") === undefined) return Promise.resolve(failed(`${path} has no origin remote`));
	const ref = `refs/heads/${branch}`;
	const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", SSH_ASKPASS_REQUIRE: "never" };
	const child = spawn("git", ["-C", path, "push", "--porcelain", "origin", `${ref}:${ref}`], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
	let [out, err] = ["", ""];
	child.stdout.on("data", (chunk: Buffer) => void (out += chunk));
	child.stderr.on("data", (chunk: Buffer) => void (err += chunk));
	const timer = setTimeout(() => {
		try {
			process.kill(-(child.pid ?? 0), "SIGKILL");
		} catch {}
	}, PUSH_MS);
	const { promise, resolve } = Promise.withResolvers<string>();
	child.on("error", (error) => resolve(failed(error.message)));
	child.on("close", (code, signal) => {
		clearTimeout(timer);
		// `<flag>\t<from>:<to>\t<summary>`, as `git push --porcelain` prints each ref.
		const [flag, , summary = ""] = out.split("\n").find((line) => line.includes(`\t${ref}:${ref}\t`))?.split("\t") ?? [];
		if (code === 0) return resolve(`github: pushed ${branch} to origin: ${summary || "done"}`);
		if (signal !== null) return resolve(failed(`no end in ${PUSH_MS / 1000} s`));
		if (flag === "!") return resolve(failed(summary));
		const lines = err.split("\n").filter((line) => line.trim() !== "" && !line.includes("failed to push some refs"));
		const why = lines.find((line) => /^(fatal|error|remote: error|ERROR):/.test(line)) ?? lines.at(-1) ?? `git exited ${code}`;
		resolve(failed(why.trim().replace(/'[^']*'/g, "origin").replace(/\S+:\/\/\S+/g, "origin")));
	});
	return promise;
}
