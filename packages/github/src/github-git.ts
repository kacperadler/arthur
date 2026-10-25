import { spawn, spawnSync } from "node:child_process";
import { configRefusal } from "@arthur/core/git-config";
import type { Run } from "./github-api.ts";

// What the github plugin asks of a project's checkout (spec/roadmap.md, entries 57 and 58): the run that built a branch,
// and a branch pushed to origin, never with a prompt.

// The commits of a branch looked through for its nearest run, from its tip.
export const DEPTH = 1000;
const PUSH_MS = 60_000;

// No hook or fsmonitor the checkout's config names runs, here or in the push, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
const UNHOOKED = ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"];
export const git = (path: string, ...args: readonly string[]) => {
	const ran = spawnSync("git", [...UNHOOKED, "-C", path, ...args], { encoding: "utf8" });
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

type Ran = { readonly code: number | null; readonly out: string; readonly why: string };
// `git <args>` in the checkout at `path`, in a session of its own, which has no terminal to ask on, killed after PUSH_MS. `why`
// is a failure's: git's first error line, a quoted remote URL said as `origin`, as it may hold a credential.
function gitAway(path: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<Ran> {
	const child = spawn("git", [...UNHOOKED, "-C", path, ...args], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
	let [out, err] = ["", ""];
	child.stdout.on("data", (chunk: Buffer) => void (out += chunk));
	child.stderr.on("data", (chunk: Buffer) => void (err += chunk));
	const timer = setTimeout(() => {
		try {
			process.kill(-(child.pid ?? 0), "SIGKILL");
		} catch {}
	}, PUSH_MS);
	const { promise, resolve } = Promise.withResolvers<Ran>();
	child.on("error", (error) => resolve({ code: null, out, why: error.message }));
	child.on("close", (code, signal) => {
		clearTimeout(timer);
		const lines = err.split("\n").filter((line) => line.trim() !== "" && !line.includes("failed to push some refs"));
		const why = signal !== null ? `no end in ${PUSH_MS / 1000} s` : (lines.find((line) => /^(fatal|error|remote: error|ERROR):/.test(line)) ?? lines.at(-1) ?? `git exited ${code}`);
		resolve({ code, out, why: why.trim().replace(/'[^']*'/g, "origin").replace(/\S+:\/\/\S+/g, "origin") });
	});
	return promise;
}

// `git push origin <branch>`, resolving to one line: `github: pushed ...`, or `github: <branch> not pushed to origin: <why>`.
// No prompt: git's own is off, an empty GIT_ASKPASS keeps git from every askpass program (core.askPass and SSH_ASKPASS too),
// Git Credential Manager is told never to ask, ssh may not use an askpass. No hook runs, so a branch whose `.gitattributes`
// (any folder's) names `filter=lfs` gets `git lfs push origin <ref>` first, as Git LFS's pre-push hook would (AR0379); git-lfs
// must be on PATH, as git would otherwise run a `lfs` alias of the config. Nor does a program the repository's own config may
// name (`core.sshCommand`, a credential helper; @arthur/core/git-config): such a key refuses the push.
export async function push(path: string, branch: string): Promise<string> {
	const failed = (why: string) => `github: ${branch} not pushed to origin: ${why}`;
	const planted = configRefusal(path);
	if (planted !== "") return failed(planted);
	if (git(path, "remote", "get-url", "origin") === undefined) return failed(`${path} has no origin remote`);
	const ref = `refs/heads/${branch}`;
	const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "", GCM_INTERACTIVE: "never", SSH_ASKPASS_REQUIRE: "never" };
	if (git(path, "grep", "--quiet", "--fixed-strings", "-e", "filter=lfs", ref, "--", ":(glob)**/.gitattributes") !== undefined) {
		if (spawnSync("git-lfs", ["version"]).status !== 0) return failed("its .gitattributes names filter=lfs, and git-lfs is not installed");
		const lfs = await gitAway(path, ["lfs", "push", "origin", ref], env);
		if (lfs.code !== 0) return failed(`its LFS objects were not pushed: ${lfs.why}`);
	}
	const ran = await gitAway(path, ["push", "--porcelain", "origin", `${ref}:${ref}`], env);
	// `<flag>\t<from>:<to>\t<summary>`, as `git push --porcelain` prints each ref.
	const [flag, , summary = ""] = ran.out.split("\n").find((line) => line.includes(`\t${ref}:${ref}\t`))?.split("\t") ?? [];
	if (ran.code === 0) return `github: pushed ${branch} to origin: ${summary || "done"}`;
	return failed(flag === "!" ? summary : ran.why);
}
