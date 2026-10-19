import { type LoadedConfig, loadConfig } from "./config.ts";
import { checkEnv, type EnvCheck, type EnvVariable, type Shell } from "./env.ts";
import { checkPlugins } from "./host.ts";

// One variable as the check prints it, never its value; `arthur setup` prints the same.
export const envLine = (variable: EnvVariable) => `${variable.set ? "set    " : "missing"} ${variable.name} (${variable.option})`;

// What `arthur config check` and `arthur setup` read: the config, else why it does not load; the host's refusals before any
// `setup`, else what the binary's own load refused (`setupProblem`), which such a refusal stops before any `setup`, so it is
// one of the refusals already; and the env check, whose problems refuse the start too.
export async function readConfig(path: string, shell: Shell, setupProblem?: string): Promise<{ readonly config: LoadedConfig; readonly refused: string[]; readonly env: EnvCheck } | { readonly config?: undefined; readonly refused: string[]; readonly env?: undefined }> {
	let config;
	try {
		config = await loadConfig(path);
	} catch (error) {
		return { refused: [error instanceof Error ? error.message : String(error)] };
	}
	let refused: string[] = [];
	try {
		await checkPlugins(config);
	} catch (error) {
		refused = (error instanceof Error ? error.message : String(error)).split("\n");
	}
	const env = checkEnv(config, shell);
	const before = refused.length > 0 || env.problems.length > 0 || env.variables.some((variable) => !variable.set);
	return { config, refused: before || setupProblem === undefined ? refused : setupProblem.split("\n"), env };
}

// `arthur config check`: docs/commands/config.md.
export async function configCheck(
	path: string,
	shell: Shell = process.env,
	setupProblem?: string,
): Promise<{ readonly lines: string[]; readonly ok: boolean }> {
	const { config, refused, env } = await readConfig(path, shell, setupProblem);
	if (config === undefined) return { lines: refused, ok: false };
	const missing = env.variables.some((variable) => !variable.set);
	const lines = [...refused, ...env.warnings, ...env.problems, ...env.variables.map(envLine)];
	if (missing && !env.envFileFound) lines.push(`${config.core.envFile} does not exist; a missing variable must come from the shell`);
	if (env.variables.length === 0 && env.problems.length === 0) lines.push("no enabled plugin names an env variable");
	return { lines, ok: refused.length === 0 && env.problems.length === 0 && !missing };
}
