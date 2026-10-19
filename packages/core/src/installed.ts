import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { OptionTable, Tool } from "./option-table.ts";

// What is installed, for `arthur setup` (spec/roadmap.md, entry 94): each plugin's options file, and each tool's version.

// A package's options file (option-table.ts), or why it has none, and so no tools.
export type OptionsFile = { readonly tools: readonly Tool[] } & ({ readonly summary: string; readonly table: OptionTable } | { readonly problem: string });

const CUT_SECONDS = 5;

const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).trim().split("\n")[0] ?? "";

// Each `node_modules/@arthur/<name>` in `folder` but the core, by name, each with its `./options` loaded by path, as the
// config is: the core imports no plugin.
export async function installedPlugins(folder: string): Promise<Map<string, OptionsFile>> {
	const scope = join(folder, "node_modules", "@arthur");
	const names = existsSync(scope) ? readdirSync(scope).filter((name) => name !== "core").sort() : [];
	return new Map(await Promise.all(names.map(async (name) => [name, await optionsFile(join(scope, name))] as const)));
}

async function optionsFile(folder: string): Promise<OptionsFile> {
	try {
		const exported: unknown = JSON.parse(readFileSync(join(folder, "package.json"), "utf8")).exports?.["./options"];
		if (typeof exported !== "string") return { problem: "no options table", tools: [] };
		// The path is the install's, known only at run time.
		const file = await import(pathToFileURL(join(folder, exported)).href);
		if (typeof file.table !== "object" || file.table === null) return { problem: "no options table", tools: [] };
		return { summary: String(file.summary), table: file.table, tools: Array.isArray(file.tools) ? file.tools : [] };
	} catch (error) {
		return { problem: `no options table: ${firstLine(error)}`, tools: [] };
	}
}

// The first word with a digit of the first line `tool.version` prints ("git version 2.43.0": "2.43.0"), else that line; `not
// found`; or `no version: <why>`, its last line when it fails, and when it does not end within 5 s.
export function toolVersion(tool: Tool): Promise<string> {
	const [command = "", ...args] = tool.version;
	const { promise, resolve } = Promise.withResolvers<string>();
	const child = execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
		clearTimeout(timer);
		const lines = `${stdout}\n${stderr}`.split("\n").map((line) => line.trim()).filter((line) => line !== "");
		if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return resolve("not found");
		if (error !== null) return resolve(`no version: ${lines.at(-1) ?? firstLine(error)}`);
		const [first] = lines;
		resolve(first === undefined ? "no version: it printed nothing" : (first.split(/\s+/).find((word) => /\d/.test(word))?.replace(/[,;:]+$/, "") ?? first));
	});
	// What the command started may hold its output open after it is killed: the pipes are closed, so `arthur setup` ends.
	const timer = setTimeout(() => {
		child.kill("SIGKILL");
		child.stdout?.destroy();
		child.stderr?.destroy();
		resolve(`no version: cut after ${CUT_SECONDS} s`);
	}, CUT_SECONDS * 1000);
	return promise;
}
