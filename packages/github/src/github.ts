import type { Plugin } from "@arthur/core/plugin";
import { type Failure, type Instance, type Run, type Watched, workflowRuns } from "./github-api.ts";
import { ciCommand } from "./github-ci.ts";
import { git, nearestRun, push } from "./github-git.ts";
import { API_URL, checkOptions, EVERY_SECONDS, type GithubOptions, type InstanceOptions, WAKE_ON } from "./github-options.ts";
import { newReviews } from "./github-pulls.ts";
import { readState, type State, writeState } from "./github-state.ts";

// The github plugin (spec/roadmap.md, entries 57 and 58): while `arthur run` runs, every `poll.everySeconds` the newest runs of
// each project's `ci.workflow` are asked of GitHub, and each branch in play (the checkout's own branch and every job's branch
// that still exists) gets its run: the run that built it (github-git.ts `nearestRun`). A finished run is told once per run
// attempt as `ci-finished` (AR0238: a rerun keeps its id), across a restart too (github-state.ts), and wakes the coordinator when
// `wakeOn` names it; with `pull-request-review` in `wakeOn`, the reviews of the open pull requests are told likewise. A refusal
// is said once until GitHub answers again; a rate limit stops the instance's requests for as long as GitHub says. Also `arthur
// ci` (github-ci.ts), and `github.push`, which delivery asks to push a reviewed branch and main. docs/github.md.

export type { GithubOptions };

type Entry = { readonly name: string; readonly path: string; readonly ci?: { readonly workflow: string } };

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
			const { instances, poll, wakeOn = WAKE_ON } = host.options as GithubOptions;
			every = (poll?.everySeconds ?? EVERY_SECONDS) * 1000;
			const accounts = instances.map((each, index) => account(host.env, each, index));
			const [list = []] = host.collect<readonly Entry[]>("projects");
			const watched = list.flatMap((project) => (project.ci === undefined ? [] : [watch(project, project.ci.workflow, accounts)]));
			host.commands.register(ciCommand(host, watched));
			// Asked by delivery after a PASS and a merge: one line, what came of the push.
			host.provide("github.push", ({ project, branch }: { readonly project: string; readonly branch: string }) => {
				const path = list.find((each) => each.name === project)?.path;
				return path === undefined ? Promise.resolve(`github: ${branch} not pushed to origin: no project ${project}`) : push(path, branch);
			});
			let state = readState(host.folder);
			const save = (next: State) => {
				if (JSON.stringify(next) === JSON.stringify(state)) return;
				state = next;
				writeState(host.folder, state);
			};
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
				const key = (run: Run) => `${run.id}/${run.attempt}`;
				const known = state.runs[each.project];
				// A project's first poll tells nothing: what finished before it was watched is taken as told.
				const told = new Set(known ?? runs.flatMap((run) => (run.status === "completed" ? [key(run)] : [])));
				const ended = new Map<Run, string[]>();
				for (const branch of inPlay(each)) {
					// A branch deleted since it was listed has no commits here, so no run.
					const run = nearestRun(each.path, branch, runs)?.run;
					if (run?.status === "completed" && !told.has(key(run))) ended.set(run, [...(ended.get(run) ?? []), branch]);
				}
				for (const [run, branches] of ended) {
					told.add(key(run));
					const { project, repo, workflow } = each;
					host.events.emit("ci-finished", { project, repo, workflow, run: run.id, attempt: run.attempt, sha: run.sha, branch: run.branch, branches, conclusion: run.conclusion, url: run.url });
					if (!wakeOn.includes("ci-finished")) continue;
					const ci = `arthur ci ${branches[0]} --project ${project}`;
					const why = ["failure", "timed_out", "startup_failure", "cancelled"].includes(run.conclusion ?? "") ? `\nWhy: ${ci}; rerun it once: ${ci} --rerun` : "";
					const text = `[github] CI run ${run.id}, attempt ${run.attempt}, of ${workflow} in ${project} ended ${run.conclusion} on ${branches.join(", ")} (${run.sha.slice(0, 7)}): ${run.url}${why}`;
					host.events.emit("coordinator-message", { text });
				}
				// Only the attempts GitHub still lists are kept: an older run, or an attempt before a rerun, never comes back.
				save({ ...state, runs: { ...state.runs, [each.project]: runs.flatMap((run) => (told.has(key(run)) ? [key(run)] : [])) } });
			};
			const paused = new Map<Instance, number>();
			const reviewed = async (each: Watched, signal: AbortSignal) => {
				const answer = await newReviews(each, state.pulls[each.project], signal);
				if (signal.aborted) return;
				if (answer.until !== undefined) paused.set(each.instance, answer.until);
				if (!("reviews" in answer)) return fail(`${each.project} pulls`, answer);
				standing.delete(`${each.project} pulls`);
				for (const review of answer.reviews) {
					host.events.emit("pull-request-review", review);
					const body = review.body.trim() === "" ? "" : `\n${review.body.trim().slice(0, 1000)}`;
					host.events.emit("coordinator-message", { text: `[github] ${review.user} reviewed pull request #${review.pull} of ${review.repo}, ${review.title} (branch ${review.branch}): ${review.state}: ${review.url}${body}` });
				}
				save({ ...state, pulls: { ...state.pulls, [each.project]: answer.pulls } });
			};
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
					if (wakeOn.includes("pull-request-review") && Date.now() >= (paused.get(each.instance) ?? 0)) await reviewed(each, signal);
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
