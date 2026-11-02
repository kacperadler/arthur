import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "@arthur/core/testing";
import type { ProjectEntry } from "../src/projects.ts";

// A project as these tests give one: its entry, the folder named after it, and its other pieces by plugin name.
export type Listed = ProjectEntry & { readonly pieces?: Readonly<Record<string, unknown>> };

// Each project of `list` in a folder of its own under `parent`, named as the project, its `project.config.ts` its pieces
// as the helpers make them: `{ projects: <entry> }`, then one `{ <plugin>: <value> }` each. Returns the folders in order.
export function projectFolders(list: readonly Listed[], parent = temporaryFolder()): string[] {
	return list.map(({ name, pieces = {}, ...entry }) => {
		const folder = join(parent, name);
		mkdirSync(folder, { recursive: true });
		const written = [{ projects: entry }, ...Object.entries(pieces).map(([plugin, value]) => ({ [plugin]: value }))];
		writeFileSync(join(folder, "project.config.ts"), `export default ${JSON.stringify(written)};\n`);
		return folder;
	});
}
