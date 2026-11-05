import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { LoadedConfig } from "./config.ts";
import { asPlugin } from "./plugin-host.ts";

// `tsc` from the install beside the config, on it and each listed project file: docs/commands/config.md. The list is the
// enabled `projects` plugin's `folders`, read here because its own load stops at the first refused file (AR0605).
export function typeCheck(config: LoadedConfig): { readonly lines: string[]; readonly ok: boolean } {
	let tsc: string;
	try {
		tsc = join(dirname(createRequire(config.path).resolve("typescript/package.json")), "bin", "tsc");
	} catch {
		return { lines: [`types not checked: typescript is not installed beside ${config.path}; npm ci installs it with the dev dependencies`], ok: true };
	}
	const projects = config.plugins.map(asPlugin).filter((plugin) => typeof plugin !== "string").find((plugin) => plugin.name === "projects");
	const options = projects?.options?.enabled === false ? undefined : projects?.options;
	const folders = Array.isArray(options?.folders) ? options.folders.filter((folder) => typeof folder === "string") : [];
	const files = [config.path, ...folders.map((folder) => join(resolve(folder), "project.config.ts")).filter((file) => existsSync(file))];
	const flags = "--ignoreConfig --noEmit --pretty false --strict --target esnext --module nodenext --types node --allowImportingTsExtensions --skipLibCheck";
	const run = spawnSync(process.execPath, [tsc, ...flags.split(" "), ...files], { cwd: dirname(config.path), encoding: "utf8" });
	const lines = `${run.stdout}\n${run.stderr}`.split("\n").filter((line) => line.trim() !== "");
	if (run.status !== 0 && lines.length === 0) lines.push(`types not checked: tsc exited with ${run.status ?? run.signal ?? run.error?.message}`);
	return { lines, ok: run.status === 0 };
}
