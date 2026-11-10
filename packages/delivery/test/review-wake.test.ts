import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { temporaryFolder } from "@arthur/core/testing";
import { wake } from "../src/review-wake.ts";

const PROCEDURE = new URL("../roles/coordinator/review-limit.md", import.meta.url);
// A FAIL of review job r on AC0001's branch arthur/w, its place `fails` among the FAILs since the last PASS.
const failed = (fails: number, branch = "arthur/w") => ({
	review: { id: "r", ticket: "AC0001", branch, commit: "9c1d2e3f4a5b" },
	verdict: "FAIL" as const,
	project: "acme",
	autoMerge: false,
	reason: "finished",
	fails: () => fails,
});

test("a FAIL's line is today's text, word for word: below the limit it hands back, at the 4th it stops and the limit's procedure follows", () => {
	const head = (fails: number) => `Review verdict: FAIL on arthur/w at 9c1d2e3, ${fails} since its last PASS; AC0001 moves back to in-progress. Delivery files it as the next review-N.md in AC0001's folder; commit that, then arthur prune r.`;
	const back = " It hands the branch back: w continues with the findings and a new budget, and the next review starts when it ends; arthur stopall cancels it.";
	assert.equal(wake(failed(1), PROCEDURE), `${head(1)}${back}`);
	assert.equal(wake(failed(3), PROCEDURE), `${head(3)}${back}`, "the third FAIL still hands back");
	assert.equal(wake(failed(4), PROCEDURE), `${head(4)} The hand-back stops at the limit.\n\n${readFileSync(PROCEDURE, "utf8").trim()}`);
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
