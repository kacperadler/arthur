import { readFileSync } from "node:fs";
import type { Plugin } from "@arthur/core/plugin";
import { findingsCommand } from "./findings-command.ts";
import { checkMode, checkOptions, type FindingsOptions, type Mode } from "./findings-options.ts";
import { type Merged, onMerge } from "./on-merge.ts";

// The findings plugin (spec/roadmap.md, entry 83): the `findings.md` format, its template in every worker's prompt, and its reader;
// `findings.onMerge`, each open entry settled as the project's `findings.project(mode)` says; `/findings` and its context line. docs/findings.md.

const TEMPLATE = new URL("../templates/findings.md", import.meta.url);

export function findings(options: FindingsOptions = {}): Plugin {
	return {
		name: "findings",
		module: import.meta.url,
		options,
		after: ["projects"],
		check: checkOptions,
		piece: checkMode,
		setup(host) {
			const [list = []] = host.collect<readonly { readonly name: string; readonly pieces?: { readonly findings?: Mode } }[]>("projects");
			host.provide("findings.onMerge", (merged: Merged) => onMerge(host, list.find((each) => each.name === merged.project)?.pieces?.findings ?? "ticket", merged));
			const template = readFileSync(TEMPLATE, "utf8").trim();
			host.provide("prompt", (role: string) =>
				role === "worker" ? `## The findings.md format\n\nA ticket's findings.md that does not exist yet starts from this template, {{id}} the ticket's id:\n\n\`\`\`markdown\n${template}\n\`\`\`` : undefined,
			);
			host.provide("coordinator.context", () => "`arthur findings <id>` shows a ticket's findings.md, from its worker's branch before the merge.");
			host.commands.register(findingsCommand(host));
		},
	};
}

// A project file's piece: `findings.project("summary")`, what a merge makes of its open findings.
findings.project = (mode: Mode) => ({ findings: mode });
