import { spawnSync } from "node:child_process";
import type { Plugin } from "@arthur/core/plugin";
import { type Failure, type Instance, type Run, workflowRuns } from "./github-api.ts";
import { API_URL, checkOptions, EVERY_SECONDS, type GithubOptions, type InstanceOptions } from "./github-options.ts";
import { readState, writeState } from "./github-state.ts";

// The github plugin (spec/roadmap.md, entry 57): while `arthur run` runs, every `poll.everySeconds` the newest runs of each
// project's `ci.workflow` are asked of GitHub, and each branch in play (the checkout's own branch and every job's branch that
// still exists) gets its run: the newest run of the nearest commit on its first-parent line that has one, so a commit
// that touches no watched path counts the run before it. A finished run is told once, by its id, as `ci-finished`, across a
// restart too (github-state.ts). A refusal is said once until GitHub answers again; a rate limit stops the instance's requests
// for as long as GitHub says. docs/github.md.

export type { GithubOptions };

type Entry = { readonly name: string; readonly path: string; readonly ci?: { readonly workflow: string } };
type Watched = { readonly project: string; readonly path: string; readonly repo: string; readonly workflow: string; readonly instance: Instance };

// The commits of a branch looked through for its nearest run, from its tip.
const DEPTH = 1000;

const git = (path: string, ...args: readonly string[]) => {
	const ran = spawnSync("git", ["-C", path, ...args], { encoding: "utf8" });
	return ran.status === 0 ? ran.stdout.trim() : undefined;
};

export function github(options: GithubOptions): Plugin {
	let round = async (_signal: AbortSignal) => {};
	let every = EVERY_SECONDS * 1000;
	let timer: NodeJS.Timeout | undefined;
	let control: AbortController | undefined;
	return {
		name: "github",
		module: import.meta.url,
		options,
		requires: ["projects"],
		check: checkOptions,
		setup(host) {
			const { instances, poll } = host.options as GithubOptions;
			every = (poll?.everySeconds ?? EVERY_SECONDS) * 1000;
			const accounts = instances.map((each, index) => account(host.env, each, index));
			const [list] = host.collect<readonly Entry[]>("projects");
			const watched = (list ?? []).flatMap((project) => (project.ci === undefined ? [] : [watch(project, project.ci.workflow, accounts)]));
			let state = readState(host.folder);
			// The failure each project's last poll ended on; one is said only when no project stands on the same text already.
			const standing = new Map<string, string>();
			const fail = (project: string, { text, loud, until }: Failure) => {
				const told = [...standing.values()].includes(text);
				if (until === undefined) standing.set(project, text);
				if (told) return;
				if (loud) host.events.emit("notice", { text: `github: ${text}; polling goes on and says this again only after GitHub answered` });
				else console.error(`github: ${text}`);
			};
			const inPlay = (each: Watched) => {
				const own = git(each.path, "symbolic-ref", "--quiet", "--short", "HEAD");
				const jobs = host.jobs.list().flatMap((job) => (job.project === each.project && job.branch !== "" ? [job.branch] : []));
				return [...new Set([...(own === undefined ? [] : [own]), ...jobs])];
			};
			const finished = (each: Watched, runs: readonly Run[]) => {
				const bySha = new Map<string, Run>();
				for (const run of runs) if (!bySha.has(run.sha)) bySha.set(run.sha, run);
				const known = state[each.project];
				// A project's first poll tells nothing: what finished before it was watched is taken as told.
				const told = new Set(known ?? runs.flatMap((run) => (run.status === "completed" ? [run.id] : [])));
				const ended = new Map<Run, string[]>();
				for (const branch of inPlay(each)) {
					// A branch deleted since it was listed has no commits here, so no run.
					const commits = git(each.path, "rev-list", "--first-parent", `--max-count=${DEPTH}`, `refs/heads/${branch}`, "--")?.split("\n") ?? [];
					const run = commits.map((sha) => bySha.get(sha)).find((found) => found !== undefined);
					if (run?.status === "completed" && !told.has(run.id)) ended.set(run, [...(ended.get(run) ?? []), branch]);
				}
				for (const [run, branches] of ended) {
					told.add(run.id);
					host.events.emit("ci-finished", { project: each.project, repo: each.repo, workflow: each.workflow, run: run.id, sha: run.sha, branch: run.branch, branches, conclusion: run.conclusion, url: run.url });
				}
				// Only the ids GitHub still lists are kept: an older run is never a branch's run again.
				const ids = runs.flatMap((run) => (told.has(run.id) ? [run.id] : []));
				if (JSON.stringify(ids) === JSON.stringify(known)) return;
				state = { ...state, [each.project]: ids };
				writeState(host.folder, state);
			};
			const paused = new Map<Instance, number>();
			round = async (signal) => {
				for (const each of watched) {
					if (Date.now() < (paused.get(each.instance) ?? 0)) continue;
					const answer = await workflowRuns(each.instance, each.repo, each.workflow, signal);
					if (signal.aborted) return;
					if (answer.until !== undefined) paused.set(each.instance, answer.until);
					if (!("runs" in answer)) fail(each.project, answer);
					else {
						standing.delete(each.project);
						finished(each, answer.runs);
					}
				}
			};
		},
		start() {
			const signal = (control = new AbortController()).signal;
			const loop = () =>
				void round(signal)
					.catch((error: unknown) => console.error(`github: a poll failed: ${(error as Error).message}`))
					.finally(() => {
						if (!signal.aborted) timer = setTimeout(loop, every);
					});
			loop();
		},
		stop() {
			control?.abort();
			clearTimeout(timer);
		},
	};
}

// The instance at `instances[index]`, its token from the variable it names; a token a header cannot carry refuses the
// load, naming the option and the variable, never the value.
function account(env: Readonly<Record<string, string>>, { name, tokenEnv, apiUrl = API_URL }: InstanceOptions, index: number): Instance {
	const token = env[tokenEnv] ?? "";
	if (!/^[\x21-\x7e]+$/.test(token)) throw new Error(`instances[${index}].tokenEnv: ${tokenEnv} is empty or holds a space or a character outside ASCII, which a header cannot carry`);
	return { name, label: name ?? "(unnamed)", tokenEnv, apiUrl: apiUrl.replace(/\/+$/, ""), token };
}

// A project with a `ci.workflow`: its GitHub repository from its checkout's `origin`, and the instance named after the
// repository's owner, else the unnamed one. A project neither fits refuses the load; the remote's URL is never said, as it
// may hold a credential.
function watch(project: Entry, workflow: string, accounts: readonly Instance[]): Watched {
	const remote = git(project.path, "remote", "get-url", "origin");
	if (remote === undefined) throw new Error(`project ${project.name}: ci.workflow is set, but its checkout has no origin remote to name its GitHub repository`);
	// An owner is letters, digits and dashes, a repository adds `.` and `_`: what a credential in the URL can never pass as.
	const [, owner, name] = /[/:]([A-Za-z0-9-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote) ?? [];
	if (owner === undefined || name === undefined) throw new Error(`project ${project.name}: its origin remote names no <owner>/<repository>`);
	const instance = accounts.find((each) => each.name === owner.toLowerCase()) ?? accounts.find((each) => each.name === undefined);
	if (instance === undefined)
		throw new Error(`project ${project.name}: no instance of github is named ${owner.toLowerCase()}, the owner of ${owner}/${name}, and none is unnamed; github's instances: ${accounts.map((each) => each.label).join(", ")}`);
	return { project: project.name, path: project.path, repo: `${owner}/${name}`, workflow, instance };
}
