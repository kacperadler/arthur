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
// AR0166 (roadmap 80): `arthur doctor` and its check at every start; core 239 more (5112) for the requirement shape, the checks
// in parallel with their 10 s cut, the core's own requirements, the command, the refusal of `arthur run` and the once-a-day
// record (doctor.ts, requirements.ts); orchestration 16 more (1162) for tmux; session 64 more (755) for the user service and
// linger, and the missing lines that open the start notice; machines 16 more (391) for each tools label checked with
// `command -v` in the machine's check over ssh, named in its doctor line (the owner's decision: a tools label is a command name).
// AR0163 (roadmap 40): registered entries and `arthur schedule`, schedule 220 more (497), for `schedule.register` with its own
// procedure rule (register.ts), the file's entries read and changed under a lock (entry-file.ts) and `arthur schedule
// add|list|remove` (schedule-command.ts); core unchanged but for `@arthur/core/lock` in its exports.
// AR0167 (CI flakes): the fake agent makes each file it notes with its first line, by a link, so a test that reads it while
// the agent runs never sees it empty; core/testing 4 more (344). A record's file removed between the check and the read
// (`hold`, as `arthur stop` polls a job's end) reads empty instead of throwing: core 4 more (4877).
// Merged: core 5112 + 4 (AR0167) = 5116.
// AR0164: the inbox's notice after 3 unanswered turns redacts omp's error as the session plugin does, with a copy of its
// credential.ts (a plugin cannot import another's), orchestration 17 more (1163 alone; 1162 + 17 = 1179 merged with AR0166).
// AR0148: a throw in the session's 500 ms tick no longer ends `arthur run`; session 9 more (700 alone; 755 + 9 = 764 merged
// with AR0166) for the catch around each tick, told once per distinct error, and the fresh start's try noted only once its
// request is written.
// AR0170 (roadmap 93): every option in one table with its meaning and default, which each package's check walks, and each
// package's options file (`./options`: table, summary, tools). Core 66 more for the table's type and walker (option-table.ts)
// and the core's table (core-options.ts); the meanings are most of the rest: orchestration 28 more, projects 5, machines 24,
// resources 57, session 31, schedule 55, the last three each with its check moved into its options file or beside it.
// Merged with main: core 5116 + 66 = 5182, orchestration 1179 + 28 = 1207, projects 325, machines 391 + 24 = 415, resources
// 458, session 764 + 31 = 795, schedule 552.
// AR0160: while a restart is due, `/restart` ends `arthur run` under its service; session 54 more (818 alone; 795 + 54 = 849
// merged with AR0170) for the note at the start whether this `arthur run` is arthur.service's main process with
// `Restart=always`, the reply that says either way, and the end after the coordinator's restart with its
// `Restarted. (arthur run restarted)`.
// AR0173 (CI names each failed test): the wrapper forks the agent with its `oom_score_adj` at 1000 (`oomFirst`, job-memory.ts),
// so a job over its memory cap loses the agent, never the wrapper, to a second kernel kill; core 11 more (5127 alone; 5182 + 11
// = 5193 merged with main).
// AR0179 (roadmap 94): `arthur setup`; core 210 more (5392 alone; 5193 + 210 = 5403 merged with AR0173) for the report
// (setup.ts: its sections, the option paths set and not set, the steps in order and the exit code), the installed plugins'
// options files read by path and each tool's version cut after 5 s (installed.ts), the config's reading shared with `arthur
// config check` (config-check.ts), a missing line's `fix` (doctor.ts), the command (cli.ts) and the core's tool `tailscale`;
// no line cut elsewhere: a scan of the core's exports used by no other file found only public types.
// AR0181 (roadmap 42): `arthur init` and the kind `onboarding`; projects 148 more (473). Cut first: the doctor's `requirement`
// (10 lines) became `requirements`, 8 lines for it and the new board requirement. The rest: init.ts (63: the command, its
// refusals, the skeleton written once per file) and onboarding.ts (83: kind and role, its prompt's paths, the questions cut at
// 10 across runs, `merge.check`).
// AR0187 (roadmap 82): the models plugin, models: 485, for its options and their url checks (model-options.ts), the probes over
// curl on the job's machine with their 30 s reuse (probe.ts), the usage report and its windows (usage.ts), the doctor lines
// (model-doctor.ts), `models.pick`, the job's variables and `arthur usage` (models.ts). Cut first: jobs.ts's sweep, 5 lines to 2,
// and orchestration's refusal of a role's list, which the core now makes. Core 45 more (5448): a spawn's model list and
// `models.pick` with its answer checked (job-model.ts, 24), a prepare's variables checked and carried to the wrapper here and
// on stdin there (jobEnv, launch, launchThere, remote-job launch), `ARTHUR_AGENT_MODEL` in the wrapper, `input` on
// `host.jobs.run`, the record's `model-why`, an awaited `roles.model`, `--model a,b` and the spawn's `model:` line;
// orchestration 6 more (1213) for `models.lists`, every role's model as a list, which the models plugin's doctor lines read.
// AR0189 (roadmap 44): youtrack: 251, set for its instances and their variables checked at load, each project's tracker
// checked against them, the REST reading with its one-line errors and paging, and `arthur youtrack issue|article list|get`;
// a new package, so nothing was cut elsewhere; core unchanged.
// AR0188 (roadmap 43): commit-rules: 168, for the regex checked at load and its commit-msg hook in each job's worktree, the
// project's own hooks forwarded and a shared `core.bare` or `core.worktree` moved into the main one's `config.worktree` first
// (hook.ts, 13 of the 168, after review 1), words or a file in the worker's and reviewer's prompt, and its empty options file.
// AR0197 (roadmap 45): youtrack 110 more (361) for writing: issue and article create and update from a file, the article's
// version check, a custom field set in the shape its type takes, a work item, and the POST in the API call; cut first: the
// usage line to one, and the article's version a word instead of a `--version` flag with its own parsing (7 lines).
// AR0195: youtrack 2 more (363) for `issue list` unresolved by default and `--all`; its query inlined first (1 line).
// AR0196 (roadmap 84): nvm: 84, set for its prepare (the worktree's .nvmrc read and `nvm which` asked on the job's machine, in
// one call, each refusal), its doctor line per machine and its refusal to load after projects; a new package, so nothing was
// cut elsewhere; core unchanged in lines: a prepare's second argument, the variables of the prepares before it, took no new
// line. projects 2 more (475), by the ticket's decision, for its install run with the PATH the prepares before it returned.
// AR0206 (roadmap 46, with AR0204): youtrack 101 more (464) for comment list, add, edit and soft delete (youtrack-comments.ts,
// 38), attachments saved under safe names (youtrack-attachments.ts, 34), a file's bytes from the API (`request`), `issue
// update`'s version, the verbs' wiring, the jobs' rules in the prompt and a write refused inside a job (3); cut first: four
// copies of `field` to one export of youtrack-api.ts (11 lines), and `update`'s article-only branch made the one path for both kinds.
// AR0208 (roadmap 47): telegram: 243, set for its bots checked at load, the long polling with its one-time 409 notice and a 429's wait, the
// owner's text as message-received with its topic's place, the replies and notices sent in slices without a notification in
// quiet hours; a new package. Orchestration 121 more (1334) for the silent mode: `arthur silent` and `/silent`, its state
// file, the summary built from the event log, `coordinator.silent`, the held replies and the `## Silent` context line; cut
// first: the `whole` check onto one line and the state's write inlined (5 lines).
// AR0191, AR0193, AR0198, AR0202 (findings batch): models 21 more (506): probe answers kept in probes.json under a lock per
// provider and machine across processes (probe.ts, 15), omp's models.yml read on each registered machine (model-doctor.ts, 6);
// cut first: the probes' in-process map of running probes, which the lock replaces, and the local models.yml line now read
// through `host.jobs.run` as the others are. Core 6 more (5454): a record whose `pid` is gone ends the wrapper (wrapper.ts, 3),
// a prompt section's `{ text, warnings }` checked and its warnings joined to the spawn's (roles.ts, 3).
const BUDGETS = { core: 5454, "core/testing": 344, projects: 475, orchestration: 1334, machines: 415, resources: 458, session: 849, schedule: 552, models: 506, youtrack: 464, "commit-rules": 168, nvm: 84, telegram: 243 };

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
