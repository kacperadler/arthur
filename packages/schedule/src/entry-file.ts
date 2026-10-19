import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe } from "@arthur/core";
import { withLock } from "@arthur/core/lock";
import type { Entry } from "./entry.ts";
import type { Registered } from "./register.ts";
import { entryProblems } from "./schedule-options.ts";

// The `file` option's entries (spec/roadmap.md, entries 39 and 40): a JSON list a human edits, read anew at every sweep and
// changed by `arthur schedule add|remove`. `file` is as the option has it, read from `root`, the folder `arthur run` runs in.

// Whose each id of the config and of the plugins is, as a refusal names it.
export function owners(configured: readonly Entry[], registered: readonly Registered[]): Map<string, string> {
	return new Map([...configured.map((entry) => [entry.id, "an entry of the config"] as const), ...registered.map((entry) => [entry.id, `plugin ${entry.plugin}'s option ${entry.option}`] as const)]);
}

// The file's entries that run; each one that does not, and a file that holds none, named. `taken`: the ids of `owners`.
export function readEntries(file: string | undefined, root: string, taken: ReadonlyMap<string, string>): { entries: Entry[]; problems: string[] } {
	const entries: Entry[] = [];
	const problems: string[] = [];
	if (file === undefined) return { entries, problems };
	const list = parse(file, root);
	if (typeof list === "string") return { entries, problems: [`${file}: none of its entries run: ${list}`] };
	const ids = new Map(taken);
	for (const [index, entry] of list.entries()) {
		const id = (entry as { readonly id?: unknown } | null)?.id;
		const name = `${file}[${index}]${typeof id === "string" ? ` ${JSON.stringify(id)}` : ""}: skipped`;
		const wrong = entryProblems(entry, "");
		if (wrong.length > 0) problems.push(`${name}, ${wrong.map(({ path, problem }) => (path === "" ? problem : `${path}: ${problem}`)).join("; ")}`);
		else if (ids.has(id as string)) problems.push(`${name}, its id is taken by ${ids.get(id as string)}`);
		else {
			ids.set(id as string, "an earlier entry of the file");
			entries.push(entry as Entry);
		}
	}
	return { entries, problems };
}

// Writes what `change` makes of the file's list as it reads now, under a lock in `folder` (the plugin's own), so of two
// `add` or `remove` at once neither loses the other's change; the rename lets a sweep read the old list or the new, never
// half of one. A file that is not a JSON list is never written over: a human's text is not lost.
export function changeEntries(file: string, root: string, folder: string, change: (list: readonly unknown[]) => unknown[]): void {
	withLock(join(folder, ".file.lock"), () => {
		const list = parse(file, root);
		if (typeof list === "string") throw new Error(`${file}: ${list}; fix it by hand first, nothing was changed`);
		const path = resolve(root, file);
		const temporary = `${path}.${process.pid}.tmp`;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(temporary, `${JSON.stringify(change(list), null, 2)}\n`);
		renameSync(temporary, path);
	});
}

// The list as the file reads now, a missing file an empty one; else why it is not a list.
function parse(file: string, root: string): unknown[] | string {
	let list: unknown;
	try {
		list = JSON.parse(readFileSync(resolve(root, file), "utf8"));
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "ENOENT" ? [] : (error as Error).message;
	}
	return Array.isArray(list) ? list : `expected a JSON list of entries, got ${describe(list)}`;
}
