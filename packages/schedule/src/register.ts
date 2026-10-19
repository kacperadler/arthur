import { basename, isAbsolute, normalize, sep } from "node:path";
import { describe } from "@arthur/core";
import { type Entry, isObject } from "./entry.ts";
import { entryProblems } from "./schedule-options.ts";

// The entries another plugin registers from its options (spec/roadmap.md, entry 40), through
// `host.call("schedule.register", host.name, entries)`: each in the config's shape plus `option`, the path of the plugin's option
// that makes it; its id becomes `<plugin>.<id>`. They live in memory for one load, so a plugin turned off leaves none behind.
// A procedure is the absolute path of a .md file in the registering plugin's own package folder (`Host.code`), never the
// relative path the config and the file take, so neither check widens the other: docs/commands/schedule.md.
export type Registered = Entry & { readonly plugin: string; readonly option: string; readonly code: string };

const PLUGIN = /^[a-z]+(-[a-z]+)*$/;

// Adds the `entries` of `plugin` to `registered`, or throws every problem and adds none; `code` is `Host.code`.
export function register(registered: Registered[], configured: readonly Entry[], code: readonly string[], plugin: unknown, entries: unknown): void {
	if (typeof plugin !== "string" || !PLUGIN.test(plugin)) throw new Error(`schedule.register: expected the registering plugin's name, then its entries, got ${describe(plugin)}`);
	const refused = (problems: readonly string[]) => new Error(`schedule.register from plugin ${plugin}: ${problems.join("; ")}`);
	if (!Array.isArray(entries)) throw refused([`expected a list of entries, got ${describe(entries)}`]);
	// The core's package folder comes first, then each plugin's, named after it.
	const folder = code.slice(1).find((each) => basename(each) === plugin);
	const problems: string[] = [];
	const added: Registered[] = [];
	for (const [index, entry] of entries.entries()) {
		const path = `entries[${index}]`;
		const { option, ...fields } = isObject(entry) ? entry : {};
		const { procedure, ...action } = isObject(fields.action) ? fields.action : {};
		const wrong = entryProblems(!isObject(entry) ? entry : isObject(fields.action) ? { ...fields, action } : fields, path).map((each) => `${each.path}: ${each.problem}`);
		if (isObject(entry) && !(typeof option === "string" && option.trim() !== "")) wrong.push(`${path}.option: expected the path of the plugin's option that makes the entry, got ${describe(option)}`);
		const ours = typeof procedure === "string" && isAbsolute(procedure) && normalize(procedure) === procedure && procedure.startsWith(`${folder}${sep}`) && procedure.endsWith(".md");
		if (procedure !== undefined && !(folder !== undefined && ours)) {
			const expected = folder === undefined ? `plugin ${plugin} has no package folder, so its entries take no procedure` : `expected the absolute path of a .md file in the package folder of plugin ${plugin}, ${folder}, got ${describe(procedure)}`;
			wrong.push(`${path}.action.procedure: ${expected}`);
		}
		const id = `${plugin}.${String(fields.id)}`;
		const before = [...registered, ...added].find((each) => each.id === id);
		if (wrong.length === 0 && configured.some((each) => each.id === id)) wrong.push(`${path}.id: ${id} is the id of an entry of the config too`);
		else if (wrong.length === 0 && before !== undefined) wrong.push(`${path}.id: ${id} is registered already, from option ${before.option}`);
		if (wrong.length > 0) problems.push(...wrong);
		else added.push({ ...(fields as Entry), id, plugin, option: option as string, code: folder ?? "" });
	}
	if (problems.length > 0) throw refused(problems);
	registered.push(...added);
}
