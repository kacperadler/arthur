import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "@arthur/core/testing";

// The projects plugin's options for `list`: each project in a folder of its own, named as the project, its
// `project.config.ts` its pieces as the helpers make them, `{ projects: <entry> }` then one `{ <plugin>: <value> }` each.
export function projectFolders(list: readonly (Readonly<Record<string, unknown>> & { readonly name: string; readonly pieces?: Readonly<Record<string, unknown>> })[]): { readonly folders: readonly string[] } {
	const parent = temporaryFolder();
	const folders = list.map(({ name, pieces = {}, ...entry }) => {
		const folder = join(parent, name);
		mkdirSync(folder, { recursive: true });
		const written = [{ projects: entry }, ...Object.entries(pieces).map(([plugin, value]) => ({ [plugin]: value }))];
		writeFileSync(join(folder, "project.config.ts"), `export default ${JSON.stringify(written)};\n`);
		return folder;
	});
	return { folders };
}
