import type { Command } from "./commands.ts";
import type { JobRunner } from "./jobs.ts";
import type { RoleView, Source } from "./roles.ts";

// `arthur roles` (spec/roadmap.md, entry 10): each role, its model, and the files its prompt reads, in the prompt's order.
// `jobs` throws when the config did not load, since the roles are what the plugins registered.

export function rolesCommand(jobs: () => JobRunner): Command {
	return {
		name: "roles",
		doc: new URL("../docs/commands/roles.md", import.meta.url),
		run({ args, project }) {
			if (args.length > 0) {
				console.error("usage: arthur roles [--project <name>]");
				return 2;
			}
			for (const role of jobs().roles(project)) console.log(describe(role));
			return 0;
		},
	};
}

function describe(role: RoleView): string {
	const kinds = role.kinds.length > 0 ? role.kinds.join(", ") : "none";
	const model = `model ${role.model ?? "the agent's default"}, thinking ${role.thinking ?? "the agent's default"}, quick model ${role.quick ?? "the agent's default"}`;
	return [`${role.name}: ${model}; kinds ${kinds}; from ${role.owner}`, ...role.sources.map((source) => `  ${source.what.padEnd(8)} ${source.path}${state(source)}`)].join("\n");
}

// Nothing when the file is read as it is.
function state({ what, text, problem }: Source): string {
	if (problem === "missing" && what === "role") return "  missing: a spawn is refused";
	if (problem === "missing") return what === "override" ? "  none" : "  missing: a spawn warns and starts without it";
	if (problem !== undefined) return `  ${problem}: never read, a spawn is refused`;
	return text?.trim() === "" ? "  empty: adds nothing" : "";
}
