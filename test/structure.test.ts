import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkStructure } from "./structure.ts";

// The line budget of each package: the number of lines its src/ may hold. They live here only; a raise is a decision recorded in its ticket.
// core: 4372 after AR0018. The core line review (AR0069, spec/quality/core-lines-2026-10-16.md) set one budget for entries 1 to
// 22: 5080 lines for the core and its test kit together. 4189 after the cuts AR0073 to AR0078 and the bug tickets AR0068, AR0070
// and AR0071; the allotment per entry on top: 16 (job state): 250, 21 (another machine: spawn and run): 350, 22 (another machine:
// stop and offline): 200, the open core bug tickets: 95, of which those three took 9. An entry that needs more than its allotment
// cuts elsewhere, or its ticket records the overrun as a decision. The test kit (testing.ts, fake-agent.ts: 268 lines) has a budget
// of its own, so production growth shows on its own: an entry that grows the kit moves lines from core to core/testing.
// projects: 320, set by AR0087 (roadmap 41) for the project list, its context lines, `arthur projects`, the clone and the install.
// AR0094 (roadmap 23): 8 lines from core to core/testing, the fake agent asking `tool_call` handlers as omp does; orchestration:
// 300 for the plugin's options, the coordinator's process, `arthur attach` and `arthur coordinator stop` (276 at the merge).
// AR0080 (proposal B3 of the line review): `/board`, `/task` and `/findings` move from core to orchestration, with
// `host.jobs.list()` and `host.board.full()` in the core; core: 91 lines less (4713), orchestration: 98 more (398).
// AR0084 (roadmap 24): the coordinator's inbox, its OMP extension and the wake, orchestration 260 more (658); the fake agent's
// interactive session moves 64 lines from core to core/testing (4649 and 340), with `host.jobs.result(id)` in the core.
// AR0110 (roadmap 26): `maxAgents`, each role's model and the quick model, orchestration 32 more (690).
// AR0112: the wait before a failed turn's messages go again, its notice, and a new owner message ending it, orchestration 7 more (697).
// AR0111: the inbox's watchdog for a hand-over omp takes and loses, and for a turn that says it goes on and does not, orchestration 21 more (718).
// machines: 280, set by AR0124 (roadmap 30) for the machine list, labels, the SSH checks, `arthur machines` and the doctor lines.
// AR0120 (roadmap 25): the coordinator's context on every turn, its OMP extension, `arthur coordinator context` and the coordinator's
// role registered, orchestration 87 more (805); core within its budget (`host.jobs.prompt`/`vision`, `collectEach`, `prompts`).
// AR0121 (roadmap 27): the jobs not ended in the coordinator's context, the wake's question, the blocked notice and the footer's
// counts by state, orchestration 70 more (875); core within its budget (`since` in `host.jobs.list()`).
// AR0126 (roadmap 32): each job's own CPU and memory caps on its scope, `jobs.limits`, the memory watch of the wrapper (cgroup
// `oom` events, or `ps` samples without a scope) and the once-per-machine notice: core 102 more (4751); resources: 42.
// AR0125 (roadmap 31): placing a job by labels (`--requires`, a ticket's, a project's), machines 95 more (375); core 13 more
// (4764) for `arthur spawn --requires` and `jobs.place` asked about every spawn, main's core being at its 4751 after AR0126.
// AR0123 (roadmap 28): planning of large tickets, the kinds plan and plan-review with their filing, the plan guard on a worker
// and `/plan`, orchestration 132 more; core 64 more for `arthur ticket file`, `host.jobs.file` and a kind's `file`
// (ticket-file.ts), and the kinds' registry moved out of jobs.ts (job-kinds.ts) to keep that file under 200 lines.
// AR0143 (roadmap 35): compaction during the day; orchestration 17 more (892) to load another plugin's OMP extension into the
// coordinator's agent (`coordinator.extension`), which the session plugin needs and cannot add itself; session: 213; the fake
// agent's `ctx.compact` and `hasPendingMessages`, core/testing within its budget (335).
// AR0141 (roadmap 33): caps per feature; core 22 more (4786) for the ticket's slice, `ran`, `cost`/`budget`/`seconds` in
// `host.jobs.list()` and `block(..., stop)`; resources 189 more (231) for `perFeature`, a ticket's `caps`, the sweep and `arthur resources`.
// Merged: core 4786 + 64 (AR0123) = 4850, orchestration 892 + 132 (AR0123) = 1024.
// AR0140 (roadmap 29): autopilot, `ticket.autopilot` with its rules, its record and the move, and the option check of its cap,
// orchestration 111 more (1135); core 14 more (4864) for `arthur ticket status <id> planned --autopilot [--budget]` asking it.
// AR0144 (roadmap 36): the fresh start at `freshAt`, `/restart` and `/restart fresh`, the handoff read at every start and the
// `Restarted.` notice, session 240 more (453); orchestration 11 more (903 alone; 1024 + 11 = 1035 merged with AR0123) for `coordinator.restart` and the start without
// `--continue` after it, which the session plugin needs and cannot do itself.
// AR0142 (roadmap 34): how many jobs run from each machine's free CPU and memory; core 2 more (4852 merged) for `host.jobs.machines()`,
// the list of registered machines a plugin had no way to read; resources 170 more (401) for `keepFree`, the check of each
// machine kept per machine, the room, `resources.free`, the spawn check, the context lines and `arthur resources`/`/resources`.
// Merged with AR0140: core 4852 + 14 = 4866, orchestration 1035 + 111 = 1146.
// AR0153 (roadmap 37): the restart guard; core 7 more (4859 alone; 4866 + 7 = 4873 merged with AR0140) for `host.code`, the
// package folders of the code a load runs, which the session plugin has no other way to know, and `--ignore-restart` reaching
// the `beforeSpawn` checks; session 86 more (539) for the note at the start, the comparison with HEAD, the spawn check, the
// context line and `restartGuard`.
// AR0158 (roadmap 39): schedule entries and the sweep, schedule: 277, for the entries' checks and slots, the claims of the run
// state and the sweep; core unchanged.
// AR0157 (roadmap 38): the start notice and the LLM probe; session 152 more (691) for the probe of the coordinator's model,
// the notice at every start, the turn extension that leaves each coordinator turn failed before any text, its notice, and the
// redaction of a credential in either.
// AR0163 (roadmap 40): registered entries and `arthur schedule`, schedule 220 more (497), for `schedule.register` with its own
// procedure rule (register.ts), the file's entries read and changed under a lock (entry-file.ts) and `arthur schedule
// add|list|remove` (schedule-command.ts); core unchanged but for `@arthur/core/lock` in its exports.
// AR0148: a throw in the session's 500 ms tick no longer ends `arthur run`; session 9 more (700) for the catch around each tick,
// told once per distinct error, and the fresh start's try noted only once its request is written.
const BUDGETS = { core: 4873, "core/testing": 340, projects: 320, orchestration: 1146, machines: 375, resources: 401, session: 700, schedule: 497 };

const lines = (count: number) => "export const a = 1;\n".repeat(count);

// A tree that keeps every rule: the core publishes "." and "./testing", one plugin uses both.
const BASE: Readonly<Record<string, string>> = {
	"package.json": JSON.stringify({ name: "arthur", devDependencies: { typescript: "^7.0.2" } }),
	"packages/core/package.json": JSON.stringify({
		name: "@arthur/core",
		dependencies: {},
		exports: { ".": "./src/host.ts", "./testing": "./src/testing.ts" },
	}),
	"packages/core/src/host.ts": "export type Host = { name: string };\n",
	"packages/core/src/testing.ts": 'import type { Host } from "./host.ts";\nexport const fakeHost: Host = { name: "fake" };\n',
	"packages/core/test/host.test.ts": 'import { fakeHost } from "../src/testing.ts";\n',
	"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram" }),
	"packages/telegram/src/telegram.ts": 'import type { Host } from "@arthur/core";\nimport { readFileSync } from "node:fs";\n',
	"packages/telegram/test/telegram.test.ts": 'import { fakeHost } from "@arthur/core/testing";\nimport "../src/telegram.ts";\n',
};

function check(
	files: Readonly<Record<string, string | undefined>>,
	budgets: Readonly<Record<string, number>> = { core: 100, "core/testing": 100, telegram: 300 },
): string[] {
	const root = mkdtempSync(join(tmpdir(), "arthur-structure-test-"));
	try {
		for (const [path, text] of Object.entries({ ...BASE, ...files })) {
			if (text === undefined) continue;
			mkdirSync(dirname(join(root, path)), { recursive: true });
			writeFileSync(join(root, path), text);
		}
		return checkStructure(root, budgets);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("the repository keeps every rule", () => {
	assert.deepEqual(checkStructure(join(import.meta.dirname, ".."), BUDGETS), []);
});

// GitHub draws the README's ```mermaid block on the repository page; arthur.mmd is its source, so the two must not drift apart.
test("the README's mermaid block is arthur.mmd, unchanged", () => {
	const root = join(import.meta.dirname, "..");
	const block = readFileSync(join(root, "README.md"), "utf8").match(/^```mermaid\n([\s\S]*?)^```$/m)?.[1];
	assert.equal(block, readFileSync(join(root, "arthur.mmd"), "utf8"), "copy arthur.mmd into the README's ```mermaid block");
});

test("a tree that keeps every rule passes, @arthur/core/testing and a type import of the core included", () => {
	assert.deepEqual(check({}), []);
});

test("a runtime dependency in any package.json fails", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({ name: "arthur", dependencies: { leftpad: "1.0.0" } }),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", peerDependencies: { grammy: "1" } }),
			"packages/core/package.json": JSON.stringify({ name: "@arthur/core", optionalDependencies: { fsevents: "2" } }),
		}).filter((problem) => problem.includes("runtime dependency")),
		[
			"package.json: has dependencies; Arthur has no runtime dependency",
			"packages/core/package.json: has optionalDependencies; Arthur has no runtime dependency",
			"packages/telegram/package.json: has peerDependencies; Arthur has no runtime dependency",
		],
	);
});

test("a dev dependency beyond typescript and @types/node fails, in any package.json", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({
				name: "arthur",
				devDependencies: { typescript: "^7.0.2", "@types/node": "^24.19.2", vitest: "3" },
			}),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", devDependencies: { "@types/node": "24", sinon: "1" } }),
		}),
		[
			"package.json: has devDependency vitest; dev dependencies are the toolchain only (typescript, @types/node)",
			"packages/telegram/package.json: has devDependency sinon; dev dependencies are the toolchain only (typescript, @types/node)",
		],
	);
});

test("an index.ts, types.ts or utils.ts fails, in src/ and test/ alike", () => {
	assert.deepEqual(
		check({
			"packages/core/src/index.ts": "",
			"packages/telegram/src/bot/types.ts": "",
			"packages/telegram/test/utils.ts": "",
		}),
		[
			"packages/core/src/index.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
			"packages/telegram/src/bot/types.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
			"packages/telegram/test/utils.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
		],
	);
});

test("a class or an enum fails, in src/ and test/ alike", () => {
	assert.deepEqual(
		check({
			"packages/telegram/src/bot.ts": "export class Bot {}\n",
			"packages/telegram/src/anonymous.ts": "export const Bot = class {};\n",
			"packages/telegram/test/fake.ts": "const enum Kind { Text }\n",
		}),
		[
			"packages/telegram/src/anonymous.ts: declares a class; Arthur uses plain functions",
			"packages/telegram/src/bot.ts: declares a class; Arthur uses plain functions",
			"packages/telegram/test/fake.ts: declares an enum; use a union type",
		],
	);
});

test("the words class, enum and an import in a comment or a string pass", () => {
	const text = [
		"// a class Bot would be wrong here, and so would enum Kind",
		'const words = "class Bot { enum Kind }";',
		"const template = `class ${words} {}`;",
		"/* import { bot } from \"@arthur/youtrack\"; */",
		'const quoted = "import \\"@arthur/youtrack\\"";',
		"const className = { class: 1, enum: 2 };",
		"",
	].join("\n");
	assert.deepEqual(check({ "packages/telegram/src/words.ts": text }), []);
});

test("a source file of exactly 200 lines passes, 201 lines fails", () => {
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(200) }), []);
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(200).trimEnd() }), []);
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(201) }), [
		"packages/telegram/src/long.ts: has 201 lines; a source file has at most 200",
	]);
});

test("a package over its line budget, or without one, fails; tests do not count", () => {
	const telegram = { "packages/telegram/src/bot.ts": lines(8), "packages/telegram/test/long.test.ts": lines(50) };
	assert.deepEqual(check(telegram, { core: 1, "core/testing": 2, telegram: 10 }), []);
	assert.deepEqual(check({ ...telegram, "packages/core/src/extra.ts": lines(2) }, { core: 2, "core/testing": 2, telegram: 9 }), [
		"packages/core: has 3 source lines, over its line budget of 2",
		"packages/telegram: has 10 source lines, over its line budget of 9",
	]);
	assert.deepEqual(check({}, { core: 3, "core/testing": 2 }), ["packages/telegram: has no line budget; add one to test/structure.test.ts"]);
});

test("the core's test kit, testing.ts and fake-agent.ts, counts against core/testing alone, and needs that budget", () => {
	const kit = { "packages/core/src/fake-agent.ts": lines(5) };
	assert.deepEqual(check(kit, { core: 1, "core/testing": 7, telegram: 300 }), []);
	assert.deepEqual(check(kit, { core: 1, "core/testing": 6, telegram: 300 }), [
		"packages/core: its test kit (src/testing.ts, src/fake-agent.ts) has 7 lines, over its line budget of 6",
	]);
	assert.deepEqual(check({ "packages/core/src/extra.ts": lines(6) }, { core: 7, "core/testing": 1, telegram: 300 }), [
		"packages/core: its test kit (src/testing.ts, src/fake-agent.ts) has 2 lines, over its line budget of 1",
	]);
	assert.deepEqual(check({}, { core: 1, telegram: 300 }), [
		"packages/core: has no line budget for its test kit; add core/testing to test/structure.test.ts",
	]);
	assert.deepEqual(check({ "packages/telegram/src/testing.ts": lines(5) }, { core: 1, "core/testing": 2, telegram: 6 }), [
		"packages/telegram: has 7 source lines, over its line budget of 6",
	]);
});

test("a plugin imports no other plugin, no core internal and no path outside its package", () => {
	const text = [
		'import { bot } from "@arthur/youtrack";',
		'import type { Issue } from "@arthur/youtrack";',
		'import type { Host } from "@arthur/core/src/host.ts";',
		'export * from "@arthur/core/testing/extra";',
		'import { host } from "../../core/src/host.ts";',
		'const lazy = await import("@arthur/schedule");',
		'import { self } from "@arthur/telegram";',
		'import { own } from "./telegram.ts";',
		"",
	].join("\n");
	assert.deepEqual(check({ "packages/telegram/src/bot.ts": text }), [
		"packages/telegram/src/bot.ts: imports @arthur/youtrack; a plugin imports no other plugin",
		"packages/telegram/src/bot.ts: imports @arthur/youtrack; a plugin imports no other plugin",
		"packages/telegram/src/bot.ts: imports @arthur/core/src/host.ts; a plugin imports only @arthur/core and its published subpaths",
		"packages/telegram/src/bot.ts: imports @arthur/core/testing/extra; a plugin imports only @arthur/core and its published subpaths",
		"packages/telegram/src/bot.ts: imports ../../core/src/host.ts, a path outside its package",
		"packages/telegram/src/bot.ts: imports @arthur/schedule; a plugin imports no other plugin",
	]);
});

test("the core imports no plugin", () => {
	const text = 'import type { Bot } from "@arthur/telegram";\nimport "../../telegram/src/telegram.ts";\n';
	assert.deepEqual(check({ "packages/core/src/run.ts": text }), [
		"packages/core/src/run.ts: imports @arthur/telegram; the core imports no plugin",
		"packages/core/src/run.ts: imports ../../telegram/src/telegram.ts, a path outside its package",
	]);
});

test("a package without a test fails", () => {
	assert.deepEqual(
		check({ "packages/telegram/test/telegram.test.ts": undefined, "packages/telegram/test/helper.ts": "" }),
		["packages/telegram: has no test; a package has at least one test/*.test.ts"],
	);
});
