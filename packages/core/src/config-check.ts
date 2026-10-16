import { loadConfig } from "./config.ts";
import { checkEnv, type Shell } from "./env.ts";
import { checkPlugins } from "./host.ts";

// `arthur config check`: docs/commands/config.md. `setupProblem` is what the binary's own load refused, printed only when
// nothing before `setup` is refused: such a refusal stops the load before any `setup` and is already in the lines here.
export async function configCheck(
	path: string,
	shell: Shell = process.env,
	setupProblem?: string,
): Promise<{ readonly lines: string[]; readonly ok: boolean }> {
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
	const missing = check.variables.some((variable) => !variable.set);
	const before = refused.length > 0 || check.problems.length > 0 || missing;
	const setup = before || setupProblem === undefined ? [] : setupProblem.split("\n");
	const lines = [...refused, ...setup, ...check.warnings, ...check.problems];
	for (const variable of check.variables) lines.push(`${variable.set ? "set    " : "missing"} ${variable.name} (${variable.option})`);
	if (missing && !check.envFileFound) lines.push(`${config.core.envFile} does not exist; a missing variable must come from the shell`);
	if (check.variables.length === 0 && check.problems.length === 0) lines.push("no enabled plugin names an env variable");
	return { lines, ok: !before && setup.length === 0 };
}
