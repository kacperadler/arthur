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
