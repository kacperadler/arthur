import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Plugin } from "@arthur/core/plugin";
import { fakeHost } from "@arthur/core/testing";
import { delivery } from "@arthur/delivery";
import { manage } from "@arthur/manage";
import { orchestration } from "@arthur/orchestration";
import { projects } from "@arthur/projects";

// AR0272: Arthur's own repository, a project of a list without `prompts`, gives every role the plugins that register one
// read each of its criteria files, in `.agents/arthur/criteria/`, none missing, empty, or only headings.

const ROOT = join(import.meta.dirname, "..");

test("every role of the plugins that register one reads each of its criteria files in Arthur's own repository", async () => {
	const list = [{ name: "arthur", prefix: "AR", path: ROOT }];
	const fake = fakeHost({ name: "test" });
	fake.provide("schedule.register", () => undefined);
	const plugins: [Plugin, Readonly<Record<string, unknown>>][] = [[projects({ list }), { list }], [delivery(), {}], [manage(), {}], [orchestration(), {}]];
	for (const [plugin, options] of plugins) await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	const criteria = fake.host.jobs.criteria();
	assert.deepEqual(criteria.toSorted(), ["audit", "autopilot", "retro", "review", "styleguide"], "the criteria the loaded roles read");
	for (const role of ["worker", ...fake.roles.map((each) => each.name)]) assert.deepEqual(fake.host.jobs.prompt(role, "arthur").warnings, [], role);
	for (const name of criteria) {
		const sections = readFileSync(join(ROOT, ".agents/arthur/criteria", `${name}.md`), "utf8").split(/^#+ .*$/m).slice(1);
		assert.ok(sections.every((body) => body.trim() !== ""), `${name}.md has a heading with nothing under it`);
	}
});

// AR0297: until the switch the harness reads its own copies; the switch removes `.agents/harness/` and deletes this test.
const HARNESS = join(ROOT, ".agents/harness/criteria");
test("the styleguide and review criteria are the same in .agents/arthur/criteria and .agents/harness/criteria", { skip: !existsSync(HARNESS) && "no .agents/harness/criteria" }, () => {
	for (const name of ["styleguide.md", "review.md"]) {
		const arthur = readFileSync(join(ROOT, ".agents/arthur/criteria", name), "utf8");
		assert.equal(readFileSync(join(HARNESS, name), "utf8"), arthur, `${name}: make the same edit in both copies`);
	}
});
