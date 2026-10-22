import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { type OrchestrationOptions, orchestration } from "../src/orchestration.ts";

// The morning report (spec/roadmap.md, entry 65) against the fake host, the test providing `schedule.register` as the schedule
// plugin would, and `host.package` as a real load sets it: orchestration's own package folder.

const PACKAGE = join(import.meta.dirname, "..");
const PROCEDURE = join(PACKAGE, "roles", "coordinator", "morning-report.md");

async function load(options: OrchestrationOptions, schedule = true): Promise<unknown[][]> {
	const fake = fakeHost({ name: "orchestration", options });
	const registered: unknown[][] = [];
	if (schedule) fake.provide("schedule.register", (...args: unknown[]) => void registered.push(args));
	await fake.setup({ setup: (host) => orchestration(options).setup({ ...host, package: PACKAGE }) });
	return registered;
}

// The procedure the registered action carries, as the schedule plugin reads it when the entry runs.
async function procedure(): Promise<string> {
	const entries = (await load({ morningReport: { at: "08:00" } }))[0]?.[1] as readonly { readonly action: { readonly procedure: string } }[] | undefined;
	return readFileSync(entries?.[0]?.action.procedure ?? "", "utf8");
}

test("morningReport.at registers one action through schedule.register, its procedure in orchestration's package folder", async () => {
	const action = { message: "Write the morning report.", procedure: PROCEDURE };
	assert.deepEqual(await load({ morningReport: { at: "08:00" } }), [["orchestration", [{ id: "report", at: "08:00", option: "morningReport.at", action }], PACKAGE]]);
	assert.match(readFileSync(PROCEDURE, "utf8"), /^# The morning report\n/);
});

test("without morningReport.at nothing is registered, and no schedule plugin is needed", async () => {
	assert.deepEqual(await load({}), []);
	assert.deepEqual(await load({ morningReport: {} }, false), []);
});

test("morningReport.at without the schedule plugin (not loaded, or disabled) is refused at load, naming the option", async () => {
	await assert.rejects(load({ morningReport: { at: "08:00" } }, false), {
		message: "morningReport.at needs the schedule plugin, which sends the morning report; add schedule() to the config's plugins, or leave morningReport out",
	});
});

test("the procedure carries the role file's rule: a plain sentence for each item, never an id alone, self-contained questions, above any length limit", async () => {
	const text = (await procedure()).replace(/\s+/g, " ");
	for (const rule of [
		"every ticket, finding, job or project the report names gets at least one plain sentence on what it is and what the owner will see change (never file names); an id never stands alone.",
		"Every decision it waits for is a question that says what is being decided, why it came up, the options with what each means in practice, and your recommendation, so the report alone answers it.",
		"This outranks any limit on the report's length: a report that needs it runs longer, short per item.",
	])
		assert.ok(text.includes(rule), `the procedure says: ${rule}`);
});

test("a night with nothing done says so in one line, the whole report when nothing waits either", async () => {
	const text = await procedure();
	assert.match(text, /With all five sections empty, the whole report is that one line: `Nothing was done overnight and nothing waits for you\.`/);
	assert.match(text, /With the first two empty and something waiting, its first line is `Nothing was built or merged overnight\.`/);
});

for (const [section, empty] of [
	["Built overnight", "no job built anything"],
	["Merged without the owner", "you merged nothing"],
	["Waiting for approval", "nothing waits for his ok"],
	["Waiting for a decision", "no decision waits"],
	["Needs attention", "it says all is well"],
])
	test(`the section ${section} is left out when empty`, async () => {
		const text = await procedure();
		assert.match(text, /An empty section is left out whole, its name too, never written as `none`/);
		assert.match(text, new RegExp(`^\\d\\. ${section}: .* Left out when ${empty}[,.]`, "m"));
	});
