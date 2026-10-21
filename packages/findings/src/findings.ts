import { readFileSync } from "node:fs";
import type { Plugin } from "@arthur/core/plugin";
import { findingsCommand } from "./findings-command.ts";
import { checkOptions, type FindingsOptions, type Mode } from "./findings-options.ts";
import { type Merged, onMerge } from "./on-merge.ts";

// The findings plugin (spec/roadmap.md, entry 83): the `findings.md` format, its template given to every worker, and its reader,
// out of the core; `findings.onMerge`, which `arthur merge` asks with the merged ticket's file, each open entry settled as the
// project's `mode` says; `/findings`, moved here from orchestration. docs/findings.md.

const TEMPLATE = new URL("../templates/findings.md", import.meta.url);

export function findings(options: FindingsOptions = {}): Plugin {
	return {
		name: "findings",
		module: import.meta.url,
		options,
		after: ["projects"],
		check: checkOptions,
		setup(host) {
			const modes = (host.options.mode ?? {}) as Readonly<Record<string, Mode>>;
			const projects = host.board.projects().map((project) => project.name);
			const strangers = Object.keys(modes).filter((name) => !projects.includes(name));
			if (strangers.length > 0) throw new Error(`mode names ${strangers.join(", ")}, not a project of the projects list; each key of mode is a project's name`);
			host.provide("findings.onMerge", (merged: Merged) => onMerge(host, modes[merged.project] ?? "ticket", merged));
			const template = readFileSync(TEMPLATE, "utf8").trim();
			host.provide("prompt", (role: string) =>
				role === "worker" ? `## The findings.md format\n\nA ticket's findings.md that does not exist yet starts from this template, {{id}} the ticket's id:\n\n\`\`\`markdown\n${template}\n\`\`\`` : undefined,
			);
			host.commands.register(findingsCommand(host));
		},
	};
}
