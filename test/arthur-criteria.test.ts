import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Plugin } from "@arthur/core/plugin";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "@arthur/delivery";
import { manage } from "@arthur/manage";
import { orchestration } from "@arthur/orchestration";
import { projects } from "@arthur/projects";
import { projectFolders } from "./project-folders.ts";

// AR0272: Arthur's own repository, a project of a list without `prompts`, gives every role the plugins that register one
// read each of its criteria files, in `.agents/arthur/criteria/`, none missing, empty, or only headings.

const ROOT = join(import.meta.dirname, "..");

// The real plugins that register a role, set up for `list` on a fake host whose load runs `code`.
async function load(list: readonly { name: string; prefix: string; path: string }[], code: readonly string[] = []) {
	const given = projectFolders(list);
	const fake = fakeHost({ name: "test", code });
	fake.provide("schedule.register", () => undefined);
	const plugins: [Plugin, Readonly<Record<string, unknown>>][] = [[projects(given), given], [delivery(), {}], [manage(), {}], [orchestration(), {}]];
	for (const [plugin, options] of plugins) await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	return fake;
}

test("every role of the plugins that register one reads each of its criteria files in Arthur's own repository", async () => {
	const fake = await load([{ name: "arthur", prefix: "AR", path: ROOT }]);
	const criteria = fake.host.jobs.criteria();
	assert.deepEqual(criteria.toSorted(), ["audit", "autopilot", "report", "retro", "review", "styleguide"], "the criteria the loaded roles read");
	for (const role of ["worker", ...fake.roles.map((each) => each.name)]) assert.deepEqual(fake.host.jobs.prompt(role, "arthur").warnings, [], role);
	for (const name of criteria) {
		const sections = readFileSync(join(ROOT, ".agents/arthur/criteria", `${name}.md`), "utf8").split(/^#+ .*$/m).slice(1);
		assert.ok(sections.every((body) => body.trim() !== ""), `${name}.md has a heading with nothing under it`);
	}
});

// AR0273: `arthur init` of a new project, with the packages of this repository loaded, writes each criteria file a role
// reads as its package ships it; the reviewer's `review.md` is delivery's, never its title alone.
test("arthur init writes the criteria files the loaded packages ship, delivery's review.md included", async (t) => {
	const shop = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: shop });
	const code = ["core", "projects", "delivery", "manage", "orchestration"].map((name) => join(ROOT, "packages", name));
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }], code);
	const log = t.mock.method(console, "log", () => undefined);
	const exit = await fake.commands.find((command) => command.name === "init")?.run({ args: ["shop"], project: undefined });
	log.mock.restore();
	assert.equal(exit, undefined, "init succeeded");
	const read = (path: string) => readFileSync(path, "utf8");
	assert.equal(read(join(shop, ".agents/arthur/criteria/review.md")), read(join(ROOT, "packages/delivery/criteria/review.md")));
	for (const name of fake.host.jobs.criteria()) {
		const text = read(join(shop, ".agents/arthur/criteria", `${name}.md`));
		assert.notEqual(text.trim().split("\n").length, 1, `${name}.md holds its title alone`);
	}
});
