import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// AR0378: every ticket of this repository, and of each eval's fixture, has a Kind of the template's list under its Goal, or
// none; no ticket keeps an old Kind (bug, risk, cleanup, improvement, feature). The templates list exactly the kinds.

const ROOT = join(import.meta.dirname, "..");
const KINDS = ["feat", "fix", "security", "perf", "refactor", "test", "docs", "build", "ci", "chore", "ux"];

test("every ticket's Kind under its Goal is one of the template's, merged and dropped ones included", () => {
	const files = globSync(["spec/features/*/ticket.md", "packages/*/evals/*/fixture/spec/features/*/ticket.md"], { cwd: ROOT }).filter((path) => !path.includes("/_template/"));
	assert.ok(files.length > 380, `${files.length} tickets read`);
	const wrong = files.flatMap((path) => {
		const goal = readFileSync(join(ROOT, path), "utf8").split(/^## Goal$/m)[1]?.split(/^## /m)[0] ?? "";
		const kind = /^- Kind:(.*)$/m.exec(goal)?.[1]?.trim();
		return kind === undefined || KINDS.includes(kind) ? [] : [`${path}: ${kind}`];
	});
	assert.deepEqual(wrong, []);
});

test("the ticket and findings templates list exactly the kinds", () => {
	const line = `- Kind: ${KINDS.join(" | ")}`;
	for (const path of ["spec/features/_template/ticket.md", "spec/features/_template/findings.md", "packages/findings/templates/findings.md"]) {
		assert.ok(readFileSync(join(ROOT, path), "utf8").includes(`\n${line}\n`), path);
	}
	assert.ok(readFileSync(join(ROOT, "packages/core/templates/ticket.md"), "utf8").includes(`\n- Kind: <!-- ${KINDS.join(" | ")} -->\n`));
});
