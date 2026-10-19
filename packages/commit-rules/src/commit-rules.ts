import { spawnSync } from "node:child_process";
import type { Plugin } from "@arthur/core/plugin";
import { checkOptions } from "./commit-rules-options.ts";
import { hookStep } from "./hook.ts";

// The commit-rules plugin (spec/roadmap.md, entry 43): each project's `commitRules` from the projects plugin's list. A `regex`,
// refused at load when it does not compile, becomes a `commit-msg` hook in the project's job worktrees (hook.ts); `words`, or a
// `file` read from the project's repository at the job's commit, go into the worker's and the reviewer's prompt. docs/commit-rules.md.

export type Rule = { readonly regex: string } | { readonly words: string } | { readonly file: string };
export type Project = { readonly name: string; readonly commitRules?: Rule };
type PromptJob = { readonly project: string; readonly root: string; readonly base: string };

const SECTION: Readonly<Record<string, string>> = {
	worker: "This project's rule for every commit message you write",
	reviewer: "This project's rule for commit messages; judge each commit of the branch by it, and a message that breaks it is a finding",
};

export function commitRules(options: { readonly enabled?: boolean } = {}): Plugin {
	return {
		name: "commit-rules",
		options,
		requires: ["projects"],
		check: checkOptions,
		setup(host) {
			const projects = host.collect<readonly Project[]>("projects").flat();
			for (const { name, commitRules: rule } of projects) {
				if (rule === undefined || !("regex" in rule)) continue;
				try {
					new RegExp(rule.regex);
				} catch (error) {
					throw new Error(`project ${name}: commitRules.regex does not compile: ${(error as Error).message}`);
				}
			}
			host.jobs.prepare(hookStep(host, projects));
			host.provide("prompt", (role: string, job: PromptJob) => {
				const rule = projects.find((project) => project.name === job.project)?.commitRules;
				const lead = SECTION[role];
				if (lead === undefined || rule === undefined || "regex" in rule) return undefined;
				if ("words" in rule) return `## Commit messages\n\n${lead} (commitRules.words in arthur.config.ts):\n\n${rule.words.trim()}`;
				const at = `${rule.file} at ${job.base.slice(0, 7)}`;
				const read = spawnSync("git", ["-C", job.root, "cat-file", "blob", `${job.base}:${rule.file}`], { encoding: "utf8" });
				const text = read.status === 0 ? read.stdout.trim() : undefined;
				if (text === undefined || text === "") {
					console.error(`warning: commit-rules: project ${job.project}: rule file ${at} is ${text === undefined ? "missing or not a file" : "empty"}; the ${role} goes without it`);
					return undefined;
				}
				return `## Commit messages\n\n${lead} (${at}):\n\n${text}`;
			});
		},
	};
}
