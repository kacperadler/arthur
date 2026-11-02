import type { Options, Plugin, Requirement } from "./plugin.ts";

// A project's pieces (docs/plugin-api.md, "Project pieces"): each plugin's part of one project's file, `<name>.project(...)`,
// which `projects` serves as `pieces`, by plugin name. A plugin with `piece` reads its own; the host checks them before its setup.

type Pieced = { readonly name?: unknown; readonly folder?: unknown; readonly pieces?: unknown };

// Each project of the one list `projects` answers, with its pieces; none without a list (the board refuses that elsewhere).
function pieced(lists: readonly unknown[]): { readonly name: string; readonly folder?: string; readonly pieces: Readonly<Record<string, unknown>> }[] {
	const [list] = lists;
	if (!Array.isArray(list)) return [];
	return (list as readonly Pieced[]).flatMap(({ name, folder, pieces }) =>
		typeof name === "string" && typeof pieces === "object" && pieces !== null ? [{ name, ...(typeof folder === "string" ? { folder } : {}), pieces: pieces as Readonly<Record<string, unknown>> }] : [],
	);
}

// `plugin`'s check on every project's piece of it, `options` its own; throws each problem, a line each, naming the project and the helper.
export function checkPieces(plugin: Pick<Plugin, "name" | "piece">, options: Options, lists: readonly unknown[]): void {
	const { piece } = plugin;
	if (piece === undefined) return;
	const problems = pieced(lists).flatMap(({ name, pieces }) => {
		const problem = Object.hasOwn(pieces, plugin.name) ? piece(pieces[plugin.name], options) : undefined;
		return problem === undefined ? [] : [`project ${name}: ${plugin.name}.project(...): ${problem}`];
	});
	if (problems.length > 0) throw new Error(problems.join("\n"));
}

// For `arthur doctor`: one line, never critical, per piece no loaded plugin with `piece` reads (a disabled plugin, or a hand-written key).
export function unreadPieces(plugins: readonly Plugin[], lists: readonly unknown[]): Requirement[] {
	const readers = new Set(plugins.filter((plugin) => plugin.piece !== undefined).map((plugin) => plugin.name));
	return pieced(lists).flatMap(({ name, folder, pieces }) =>
		Object.keys(pieces)
			.filter((key) => !readers.has(key))
			.map((key) => ({
				name: `${name} ${key}`,
				check: () => `missing: no enabled plugin reads ${key}.project(...)`,
				costs: `project ${name}'s ${key}.project(...) does nothing`,
				fix: `enable ${key} in arthur.config.ts, or remove the line from ${folder === undefined ? `project ${name}'s file` : `${folder}/project.config.ts`}`,
				critical: false,
			})),
	);
}
