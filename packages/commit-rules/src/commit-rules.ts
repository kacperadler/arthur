import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";
import type { Plugin } from "@arthur/core/plugin";
import { checkOptions } from "./commit-rules-options.ts";
import { hookStep } from "./hook.ts";

// The commit-rules plugin (spec/roadmap.md, entry 43): each project's piece, `commitRules.project(...)` in its project file. A
// `regex`, refused at load when it does not compile, becomes a `commit-msg` hook in the project's job worktrees (hook.ts);
// `words`, or a `file` read from the project's folder at the spawn, go into the worker's and the reviewer's prompt. docs/commit-rules.md.

export type Rule = { readonly regex: string } | { readonly words: string } | { readonly file: string };
export type Project = { readonly name: string; readonly folder?: string; readonly commitRules?: Rule };
type PromptJob = { readonly project: string };
type Listed = { readonly name: string; readonly folder?: string; readonly pieces?: { readonly "commit-rules"?: Rule } };

const SECTION: Readonly<Record<string, string>> = {
	worker: "This project's rule for every commit message you write",
	reviewer: "This project's rule for commit messages; judge each commit of the branch by it, and a message that breaks it is a finding",
};

export function commitRules(options: { readonly enabled?: boolean } = {}): Plugin {
	return {
		name: "commit-rules",
		module: import.meta.url,
		options,
		requires: ["projects"],
		check: checkOptions,
		// Exactly one of the three, a non-empty string; a regex that compiles, a file inside the project's folder.
		piece(value) {
			const rule = (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}) as Readonly<Record<string, unknown>>;
			const [key, ...more] = Object.keys(rule);
			const text = key === undefined ? undefined : rule[key];
			if (key === undefined || more.length > 0 || !["regex", "words", "file"].includes(key) || typeof text !== "string" || text === "") return "expected exactly one of { regex }, { words }, { file }, a non-empty string";
			if (key === "file" && (isAbsolute(text) || normalize(text).split(sep)[0] === "..")) return `file ${JSON.stringify(text)} is not a path inside the project's folder`;
			if (key !== "regex") return undefined;
			try {
				new RegExp(text);
				return undefined;
			} catch (error) {
				return `regex does not compile: ${(error as Error).message}`;
			}
		},
		setup(host) {
			const projects: Project[] = host.collect<readonly Listed[]>("projects").flat().map(({ name, folder, pieces }) => ({ name, folder, commitRules: pieces?.["commit-rules"] }));
			host.jobs.prepare(hookStep(host, projects));
			host.provide("prompt", (role: string, job: PromptJob) => {
				const project = projects.find((each) => each.name === job.project);
				const rule = project?.commitRules;
				const lead = SECTION[role];
				if (lead === undefined || rule === undefined || "regex" in rule) return undefined;
				if ("words" in rule) return `## Commit messages\n\n${lead} (commitRules.project({ words }) in its project file):\n\n${rule.words.trim()}`;
				// Read at the spawn from the project's folder; a symlink is no file.
				const file = join(project?.folder ?? "", rule.file);
				const text = lstatSync(file, { throwIfNoEntry: false })?.isFile() ? readFileSync(file, "utf8").trim() : undefined;
				if (text === undefined || text === "")
					return { warnings: [`commit-rules: project ${job.project}: rule file ${file} is ${text === undefined ? "missing or not a file" : "empty"}; the ${role} goes without it`] };
				return `## Commit messages\n\n${lead} (${file}):\n\n${text}`;
			});
		},
	};
}

// A project file's piece: `commitRules.project({ regex: "^(feat|fix): .+$" })`, `{ words }` or `{ file }`.
commitRules.project = (rule: Rule) => ({ "commit-rules": rule });
