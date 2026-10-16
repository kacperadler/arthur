import { loadConfig } from "./config.ts";
import { checkEnv, type Shell } from "./env.ts";
import { checkPlugins } from "./host.ts";

// `arthur config check` (spec/roadmap.md, entry 3): the host's refusals, then every variable the enabled plugins name, `set` or
// `missing`, never a value. Fine when the config loads, the host refuses nothing before `setup` (none runs here), no name or
// env-file line is refused, and every variable is set; warnings do not count.
export async function configCheck(path: string, shell: Shell = process.env): Promise<{ readonly lines: string[]; readonly ok: boolean }> {
	let config;
	try {
		config = await loadConfig(path);
	} catch (error) {
		return { lines: [error instanceof Error ? error.message : String(error)], ok: false };
	}
	let refused: string[] = [];
	try {
		await checkPlugins(config);
	} catch (error) {
		refused = (error instanceof Error ? error.message : String(error)).split("\n");
	}
	const check = checkEnv(config, shell);
	const lines = [...refused, ...check.warnings, ...check.problems];
	for (const variable of check.variables) lines.push(`${variable.set ? "set    " : "missing"} ${variable.name} (${variable.option})`);
	const missing = check.variables.some((variable) => !variable.set);
	if (missing && !check.envFileFound) lines.push(`${config.core.envFile} does not exist; a missing variable must come from the shell`);
	if (check.variables.length === 0 && check.problems.length === 0) lines.push("no enabled plugin names an env variable");
	return { lines, ok: refused.length === 0 && check.problems.length === 0 && !missing };
}
