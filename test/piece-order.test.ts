import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";

// AR0589: a plugin with a piece sets up after projects, whatever the config's order, so the host checks its pieces before
// its setup. Each listed alone before projects here, delivery and machines still refuse a bad piece of theirs. A plugin's own tests
// never load another plugin; this one, outside every package, loads them together through the real CLI.

const PACKAGES = join(import.meta.dirname, "..", "packages");
const CLI = join(PACKAGES, "core", "src", "cli.ts");
const imports = ["delivery", "machines", "projects"].map((name) => `import { ${name} } from ${JSON.stringify(join(PACKAGES, name, "src", `${name}.ts`))};`).join("\n");
// The config with only `plugin` before projects, so nothing else makes projects set up earlier.
const config = (plugin: string) => `${imports}
export default { plugins: [{ name: "orchestration", setup() {} }, ${plugin}({}), projects({ folders: ["projects/shop"] })] };
`;

// `arthur projects` in a folder holding the config of `plugin` and project shop, whose file holds `pieces` after its projects piece.
function projectsWith(plugin: string, pieces: string): { readonly status: number | null; readonly out: string } {
	const folder = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: folder });
	mkdirSync(join(folder, "projects", "shop"), { recursive: true });
	writeFileSync(join(folder, "arthur.config.ts"), config(plugin));
	writeFileSync(join(folder, "projects", "shop", "project.config.ts"), `export default [{ projects: { prefix: "SH", path: "../.." } }, ${pieces}];\n`);
	const env = { PATH: process.env.PATH ?? "", HOME: folder, XDG_CONFIG_HOME: join(folder, ".config"), ARTHUR_JOB: "" };
	const run = spawnSync(process.execPath, [CLI, "projects"], { cwd: folder, encoding: "utf8", env });
	return { status: run.status, out: run.stdout + run.stderr };
}

test("delivery and machines, listed before projects, set up after it: a bad piece of either is refused, naming the project and the helper", () => {
	const delivery = projectsWith("delivery", '{ delivery: { autoMerge: "yes" } }');
	assert.match(delivery.out, /plugin delivery: setup failed: project shop: delivery\.project\(\.\.\.\): expected \{ autoMerge \}, true or false/, delivery.out);
	const machines = projectsWith("machines", '{ machines: ["macos"] }');
	assert.match(machines.out, /plugin machines: setup failed: project shop: machines\.project\(\.\.\.\): requires must be \{ os\?, arch\?, tools\? \}/, machines.out);
	for (const [plugin, piece] of [["delivery", "{ delivery: { autoMerge: false } }"], ["machines", '{ machines: { os: "linux" } }']] as const) {
		const fine = projectsWith(plugin, piece);
		assert.deepEqual([fine.status, /^SH shop\n/.test(fine.out)], [0, true], fine.out);
	}
});
