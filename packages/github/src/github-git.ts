import { spawn, spawnSync } from "node:child_process";
import { configRefusal } from "@arthur/core/git-config";
import type { Run } from "./github-api.ts";

// What the github plugin asks of a project's checkout (spec/roadmap.md, entries 57 and 58): the run that built a branch,
// a branch pushed to origin, and branches listed and deleted there (AR0555), never with a prompt.

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
// is a failure's: git's first error line, a quoted word, a URL or a word holding an `@` said as `origin`, as each may hold a credential.
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
		resolve({ code, out, why: why.trim().replace(/(?<!transport )'[^']*'/g, "origin").replace(/\S+:\/\/\S+/g, "origin").replace(/\S*@\S+/g, "origin") });
	});
	return promise;
}

// The env of every call to origin: no prompt. Git's own is off, an empty GIT_ASKPASS keeps git from every askpass program
// (core.askPass and SSH_ASKPASS too), Git Credential Manager is told never to ask, ssh may not use an askpass. Nor does
// origin's URL run a program (AR0393): GIT_PROTOCOL_FROM_USER=0 leaves git only the transports allowed always (http, https,
// ssh, git, and those your ~/.gitconfig allows with `protocol.<name>.allow`), so a helper `<name>::` or `<name>://` names,
// `ext::`, and a folder, whose hooks its receive-pack would run, are refused: `fatal: transport '<name>' not allowed`.
const quiet = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "", GCM_INTERACTIVE: "never", SSH_ASKPASS_REQUIRE: "never", GIT_PROTOCOL_FROM_USER: "0" });

// Why the checkout at `path` may not reach origin, "" when it may: a key of its own config that may name a program Arthur's git
// would run (`core.sshCommand`, a credential helper; @arthur/core/git-config), or no origin remote.
function originRefusal(path: string): string {
	return configRefusal(path) || (git(path, "remote", "get-url", "origin") === undefined ? `${path} has no origin remote` : "");
}

// `git push origin <branch>`, resolving to one line: `github: pushed ...`, or `github: <branch> not pushed to origin: <why>`.
// No prompt and no program of the checkout's or origin's (`quiet`, `originRefusal`). No hook runs, so a branch whose
// `.gitattributes` (any folder's) names `filter=lfs` gets `git lfs push origin <ref>` first, as Git LFS's pre-push hook would
// (AR0379); git-lfs must be on PATH, as git would otherwise run a `lfs` alias of the config.
export async function push(path: string, branch: string): Promise<string> {
	const failed = (why: string) => `github: ${branch} not pushed to origin: ${why}`;
	const refused = originRefusal(path);
	if (refused !== "") return failed(refused);
	const ref = `refs/heads/${branch}`;
	const env = quiet();
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

// Origin's branches under `prefix` (such as `arthur/`, or a full name), each with its tip, as `git ls-remote` lists them; a
// refusal or a failure is its text, as `push` says it.
export async function originBranches(path: string, prefix: string): Promise<ReadonlyMap<string, string> | string> {
	const refused = originRefusal(path);
	if (refused !== "") return refused;
	const ran = await gitAway(path, ["ls-remote", "--heads", "origin", `refs/heads/${prefix}${prefix.endsWith("/") ? "*" : ""}`], quiet());
	if (ran.code !== 0) return ran.why;
	// `<sha>\trefs/heads/<branch>`, a line each; ls-remote's pattern also matches the end of a longer name, which the prefix check drops.
	const pairs = ran.out.split("\n").flatMap((line) => (/^[0-9a-f]{40,64}\trefs\/heads\//.test(line) ? [[line.slice(line.indexOf("\t") + 12), line.slice(0, line.indexOf("\t"))] as const] : []));
	return new Map(pairs.filter(([branch]) => branch.startsWith(prefix)));
}

// Each of `tips` (a branch and the tip origin had) deleted on origin in one push, only while origin still has that tip
// (`--force-with-lease`), never with a prompt or a program (as `push`); resolves to each branch's refusal, "" for one deleted.
export async function deleteOnOrigin(path: string, tips: ReadonlyMap<string, string>): Promise<ReadonlyMap<string, string>> {
	const refused = originRefusal(path);
	const leases = [...tips].map(([branch, tip]) => `--force-with-lease=refs/heads/${branch}:${tip}`);
	const ran = refused !== "" ? { out: "", why: refused } : await gitAway(path, ["push", "--porcelain", ...leases, "origin", ...[...tips.keys()].map((branch) => `:refs/heads/${branch}`)], quiet());
	// `-\t:<ref>\t[deleted]` for a ref deleted, `!\t(delete):<ref>\t[rejected] (stale info)` for one whose tip moved.
	const lines = ran.out.split("\n").map((line) => line.split("\t"));
	return new Map(
		[...tips.keys()].map((branch) => {
			const [flag, , summary = ""] = lines.find((line) => line[1]?.endsWith(`:refs/heads/${branch}`)) ?? [];
			return [branch, flag === "-" ? "" : flag === "!" ? summary : ran.why];
		}),
	);
}
