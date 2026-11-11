import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { temporaryFolder } from "@arthur/core/testing";
import { wake } from "../src/review-wake.ts";

// A FAIL of review job r on AC0001's branch arthur/w, its place `fails` among the FAILs since the last PASS.
const failed = (fails: number, branch = "arthur/w") => ({
	review: { id: "r", ticket: "AC0001", branch, commit: "9c1d2e3f4a5b" },
	verdict: "FAIL" as const,
	project: "acme",
	autoMerge: false,
	reason: "finished",
	fails: () => fails,
});

test("a FAIL's line is the wording beside the limit's procedure, each placeholder filled in, an unknown one and a $ pattern in a value kept as written", () => {
	const folder = join(temporaryFolder(), "coordinator");
	mkdirSync(folder);
	writeFileSync(join(folder, "review-limit.md"), "Ask the owner.\n");
	writeFileSync(join(folder, "review-failed.md"), "{branch} {commit} {fails} {ticket} {review} {worker}; {branch} again; {other}\n");
	writeFileSync(join(folder, "review-failed-limit.md"), "Stop {worker} at {fails}.\n");
	const procedure = pathToFileURL(join(folder, "review-limit.md"));
	assert.equal(wake(failed(2, "arthur/w$&"), procedure), "arthur/w$& 9c1d2e3 2 AC0001 r w$&; arthur/w$& again; {other}");
	assert.equal(wake(failed(4), procedure), "Stop w at 4.\n\nAsk the owner.");
});
