import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Requirement } from "./plugin.ts";

// The plugin check at load (spec/roadmap.md, entry 104): a plugin's package.json may name the core releases it was built for in
// npm's own field, `peerDependencies["@arthur/core"]`; a core outside them is one `arthur doctor` line that never stops the start.
// Only `^x.y.z`, `~x.y.z` and an exact `x.y.z` are read. docs/commands/doctor.md.

const RANGE = /^([~^]?)(\d+)\.(\d+)\.(\d+)$/;

// Whether the release `version` (`x.y.z`) is within `range`, as npm reads it; undefined for a range not read.
export function inRange(range: unknown, version: string): boolean | undefined {
	const parts = typeof range === "string" ? RANGE.exec(range) : null;
	if (parts === null) return undefined;
	const [low, have] = [parts.slice(2).map(Number), version.split(".").map(Number)];
	// The leading parts that must equal the range's: `^` up to the first that is not 0, `~` the major and minor, exact all three.
	const fixed = parts[1] === "^" ? (low[0] !== 0 ? 1 : low[1] !== 0 ? 2 : 3) : parts[1] === "~" ? 2 : 3;
	const at = [0, 1, 2].find((index) => have[index] !== low[index]);
	return at === undefined || (at >= fixed && (have[at] ?? 0) > (low[at] ?? 0));
}

// `plugins`: each enabled plugin's name and package folder, read now; `version`: this core's release. A line for each that names the field.
export function rangeRequirements(plugins: readonly (readonly [string, string | undefined])[], version: string): Requirement[] {
	return plugins.flatMap(([name, folder]) => {
		if (folder === undefined) return [];
		const file = join(folder, "package.json");
		// Node imported the plugin under this file, which it refuses unless it parses (ERR_INVALID_PACKAGE_CONFIG).
		const range: unknown = JSON.parse(readFileSync(file, "utf8"))?.peerDependencies?.["@arthur/core"];
		if (range === undefined) return [];
		const within = inRange(range, version);
		const text = within === undefined ? `missing: its range of @arthur/core, ${JSON.stringify(range)}, is not read: only ^x.y.z, ~x.y.z and x.y.z are` : within ? `ok (built for @arthur/core ${range})` : `missing: built for @arthur/core ${range}, this core is ${version}`;
		const fix = within === undefined ? `write peerDependencies["@arthur/core"] in ${file} as ^x.y.z, ~x.y.z or x.y.z` : `install the release of ${name} built for @arthur/core ${version}, or the core its range names`;
		return [{ name: `plugin ${name}`, check: () => text, costs: `${name} may use what this core does not have`, fix }];
	});
}
