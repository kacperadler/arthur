# Core line review, 2026-10-16 (AR0069)

`packages/core/src` holds 4371 lines against a budget of 4372: 3464 code, 563 comment, 344 blank, in 46 files. Three files sit at the 200-line cap: `jobs.ts`, `shell-words.ts` and `testing.ts`. Entries 16 and 21 change `jobs.ts` and `testing.ts`, so each must split a file or cut lines first.

What this review proposes:

- Six cut tickets before entry 16 save about 189 lines, which brings the core to about 4182.
- A seventh ticket, applied with entry 23, saves about 105 more.
- With the six applied, entries 16, 21, 22 and the five open core bug tickets need an estimated 895 lines.
- Recommended core budget for entries 1 to 22: **5080**, decided once, with an allotment per entry (see Budget).

No code was changed here.

How this was measured:

- Every file in `packages/core/src` was read in full.
- Line counts follow `test/structure.ts` (`lineCount`): every line counts, comments and blanks included. The code, comment and blank split comes from a throwaway `node -e` count.
- Growth per ticket comes from `git diff --numstat <merge>^1 <merge> -- packages/core/src` for each merge on main.
- No plugin package exists yet (`packages/` holds only `core`). So no built plugin relies on anything today. "Contract" below means what `spec/roadmap.md` promises plugins: the host API, the job record's files, events, and the published exports `.`, `./clock`, `./env-guard`, `./plugin` and `./testing`.

## Where the lines came from

| Source | Net lines |
| --- | --- |
| Roadmap entries 2 to 15, 17 to 20 (18 merges) | 4017, a mean of 223 per entry |
| Largest entries | 11: 383, 14: 374, 20: 307, 9: 305, 17: 301 |
| Bug and risk tickets (19 merges) | 354, a mean of about 19 each |
| Total | 4371 |

Per area:

| Area | Files | Lines |
| --- | --- | --- |
| Job runner, prompt loader, steer | `jobs`, `job-*`, `wrapper`, `run-record`, `agent-stream`, `checks`, `steer*`, `process-table`, `git`, `node-modules`, `roles*`, `spawn-command` | 1509 |
| Host, CLI, `arthur run`, lock | `host`, `plugin`, `commands`, `cli`, `run`, `lock` | 711 |
| Ticket board and its commands | `board*`, `ticket-*` | 564 |
| Guards and the shell parser | `env-guard`, `worktree-guard`, `git-writes`, `shell-words` | 561 |
| Config and env | `config`, `env`, `config-check` | 399 |
| Test kit (never runs in production) | `testing`, `fake-agent` | 268 |
| Event stream | `events`, `event-log` | 253 |
| Clock | `clock` | 106 |

## Every file

| File | Lines | Comment | Job |
| --- | --- | --- | --- |
| `jobs.ts` | 200 | 25 | The job runner: kinds, roles, `beforeSpawn` and `prepare` hooks, spawn (checks, worktree, record, launch), and the wiring for `continue` and `roles`. |
| `shell-words.ts` | 200 | 23 | The bash command-line parser that both guards share. |
| `testing.ts` | 200 | 39 | `@arthur/core/testing`: the safety net, temporary folders, the fake agent's `omp` script, the fake host. |
| `env.ts` | 195 | 14 | Finds `...Env` options, checks variable names and owners, parses `.env`, resolves the values. |
| `board.ts` | 192 | 21 | The ticket board: the project list, `create`, `move`, `after`, `digest` under the board's lock. |
| `worktree-guard.ts` | 191 | 29 | OMP extension: refuses a tool call that writes outside the job's own worktree. |
| `config.ts` | 168 | 8 | `defineConfig` and `loadConfig`: the core options' shape, defaults and systemd `MemoryMax` syntax. |
| `wrapper.ts` | 158 | 19 | The per-job background process: runs the agent, keeps the record current, enforces limits, resumes once at the budget, writes the end and emits `job-ended`. |
| `cli.ts` | 152 | 8 | The `arthur` binary: `--project`, the load, the core's commands, `help` and doc printing. |
| `host.ts` | 147 | 13 | The plugin host: checks the plugin list, works out the setup order, resolves env, builds each plugin's host, wires the core's board to the jobs. |
| `roles.ts` | 139 | 19 | The role registry and the prompt builder; `roles.model`; refuses symlinked project files. |
| `events.ts` | 137 | 21 | The event bus: subscribers, delivery order, and the daemon's follow and replay from `events.delivered`. |
| `env-guard.ts` | 128 | 29 | OMP extension: refuses a tool call that names a `.env` file. |
| `lock.ts` | 127 | 12 | The cross-process pid lock, with takeover from a dead holder or an earlier boot. |
| `job-records.ts` | 126 | 18 | Short-id lookup, the `arthur jobs` text, prune, stop-all, and the dead-job sweep. |
| `job-scope.ts` | 123 | 23 | Starts the wrapper in a systemd scope inside the joint slice, ends a job whose wrapper never started, kills what is left in the scope. |
| `plugin.ts` | 118 | 18 | The `Plugin` and `Host` types, the `provide`/`call`/`collect` registry, and the per-plugin host object. |
| `event-log.ts` | 116 | 11 | `events.jsonl`: appends under the lock, handles a torn last line, reads. |
| `board-commands.ts` | 109 | 12 | `/board`, `/task` and `/findings`, the last one including findings on a job's branch. |
| `clock.ts` | 106 | 15 | The wall clock in `timeZone`, quiet hours, the `next` slot across daylight-saving changes. |
| `agent-stream.ts` | 96 | 8 | Parses `omp --mode json` stdout into agent events. |
| `job-control.ts` | 93 | 16 | Stop, steer and continue, each from the job's record. |
| `board-file.ts` | 85 | 8 | `spec/build.json`: the statuses, the transition table, read and validate, write whole. |
| `commands.ts` | 85 | 13 | The command registry, phone-command routing, the menu. |
| `run.ts` | 82 | 12 | `arthur run`: the pid lock, plugin start and stop, follow, the sweep timer. |
| `job-commands.ts` | 74 | 5 | CLI and phone wrappers for `stop`, `continue`, `steer`, `jobs`, `prune`, `stopall`. |
| `run-record.ts` | 69 | 8 | Turns agent events into record files: `log`, `cost`, `activity`, `tool-calls`, `checks`, `result`. |
| `fake-agent.ts` | 68 | 9 | The fake `omp` player for tests. |
| `steer-inbox.ts` | 67 | 12 | The steer queue on disk: numbering, linking in, closing at the job's end. |
| `spawn-command.ts` | 54 | 4 | `arthur spawn` argument parsing. |
| `git.ts` | 53 | 10 | The job runner's `git` calls. |
| `board-jobs.ts` | 48 | 9 | Parses `Ticket:` paths; the board follows workers (refusal at spawn, move to in-progress on `job-started`). |
| `job-limits.ts` | 46 | 10 | Limit checks and defaults, the budget-reached rounding, a timer longer than 24.8 days. |
| `job-stop.ts` | 43 | 8 | The one stop: SIGTERM to the group, SIGKILL, processes that left the group, the scope. |
| `git-writes.ts` | 42 | 7 | Classifies `git` subcommands as writes, for the worktree guard. |
| `ticket-command.ts` | 41 | 2 | `arthur ticket new\|status\|after\|all`. |
| `ticket-template.ts` | 37 | 6 | The ticket template, slugs, title checks, detecting template guidance left in a ticket. |
| `checks.ts` | 36 | 8 | `npm run check` and `npm test` result lines, read from bash output. |
| `config-check.ts` | 36 | 5 | The lines of `arthur config check`. |
| `roles-command.ts` | 35 | 3 | The output of `arthur roles`. |
| `steer.ts` | 35 | 5 | OMP extension: hands the agent waiting steers after each tool call. |
| `board-after.ts` | 28 | 4 | Checks `after` (unknown, dropped, cycles); lists the afters still open. |
| `process-table.ts` | 26 | 4 | The `ps` table and a process's descendants. |
| `board-text.ts` | 24 | 3 | The board as text, and its digest. |
| `job-record.ts` | 21 | 4 | Writes the spawn's record whole. |
| `node-modules.ts` | 15 | 3 | Copies `node_modules` when the lockfiles match. |

## Proposals

Saved lines come from the line ranges named. Where a count is an estimate, it says so.

### In place: no contract changes

| # | What | Saves | Where it goes | Risk |
| --- | --- | --- | --- | --- |
| A1 | `checkEnv` stops validating plugin entries itself and skips what `checkPlugins` refuses. Removes `env.ts:85-95` (`asPlugin`) and `env.ts:27`, and shortens `env.ts:46-50`. This also fixes F1, which prints one refusal twice. | about 12 | Stays in core | Low. `resolveEnv` runs only after `checkPlugins` passed (`host.ts:30-31`). `config check` prints the host's line already (`config-check.ts:22-26`). |
| A2 | One `describe`: `host.ts:140-147` imports `config.ts:125-133`, which gives the same text for every input (both read). | 9 | Core | Low. |
| A3 | One plugin-step guard: `host.ts:131-138` `guard` and `jobs.ts:193-200` `step` build the same message, `plugin <name>: <step> failed: <message>`. One copy goes into `plugin.ts`, keeping `cause`. | about 8 | Core | Low. `jobs.ts` loses 8 lines below its cap. |
| A4 | One job-record reader. `job-control.ts:21-26` `record` and `job-records.ts:17-21` `field` both read record files. `job-control.ts:28-31` `wrapperRuns` is repeated inline at `job-records.ts:67`. Moving `ID`, the reader and `wrapperRuns` to one file removes the import cycle `job-records` → `job-control`. | about 5 | Core | Low. Missing files read as `""` instead of `undefined` in `job-control.ts:36,51,72`. |
| A5 | `appendEvent` (`event-log.ts:17-19`) is used only by `events.test.ts:92-94`, which can call `eventBus(home).emit`. | 4 | Core | Low (a test change). |
| A6 | `arthur ticket all` (`ticket-command.ts:31-36`, and in `USAGE`) prints the same tickets as `arthur board all`, which entry 18 added. The digest's last line (`board-text.ts:22`) names `/board all` only. | about 6 | Core | Low. User-visible: one command less. `ticket.md`, `board.md` and the tests at `cli.test.ts:150` and `board-commands.test.ts:59,71` change. |
| A7 | One flag parser for the three that exist: `cli.ts:28-38` (`--project`), `spawn-command.ts:36-49` and `job-commands.ts:58-64`. `AMOUNT` is repeated at `spawn-command.ts:10` and `job-commands.ts:19`. Entries 16 (`--state`), 21 (`--machine`) and 31 (`--requires`) add more flags. | about 10 (estimate) | Core | Low. Every usage line and refusal text has to stay the same. |

### Comments that repeat the docs

| # | What | Saves | Where it goes | Risk |
| --- | --- | --- | --- | --- |
| C1 | Each comment in the table under "Comments that repeat the docs" shrinks to the lines the doc does not hold, plus a pointer to the doc page. | about 73; 66 if B1 and B2 come first | The docs, which already hold the text | Low. The doc page becomes the only copy. A reviewer reads it beside the code. |

### Moves to a plugin

| # | What | Saves in core | Where it goes | Risk |
| --- | --- | --- | --- | --- |
| B1 | The `node_modules` copy (`node-modules.ts`, 15 lines, and `jobs.ts:11,138`) is npm-specific. It becomes a `prepare` hook. | 17 | The `projects` plugin (entry 41), as part of a project's setup | Low to medium. It moves a step that roadmap 9 and 21 and `spawn.md:15` promise. The `prepare` contract (`jobs.ts:72`) already exists. Until 41, a job installs from the lockfile itself, as `packages/core/roles/worker.md` already tells a worker. [INFERENCE: Arthur's own jobs still run under the predecessor harness, so its workers are unaffected until the switch.] |
| B2 | The `checks` record file is npm and `node --test` specific. Remove `checks.ts` (36 lines), the check lines of `run-record.ts` (`:2,28-29,40-47,66`, about 11), and the `tool-end` command and output fields of `agent-stream.ts` (`:7-8,34-35,68,73-75`, about 5). The `delivery` plugin ships its own OMP extension that reads `tool_result`, as `steer.ts` does, and writes `.arthur/delivery/<id>/checks`. | about 52 now; the extension hook adds about 7 at entry 53 | The `delivery` plugin (entry 53, review-needed reads checks). The core needs `host.jobs.registerExtension(url)` | Medium. **It moves a contract**: the record file `checks` (roadmap 11, `spawn.md:47`, `continue.md:9`) changes writer and location. Nothing reads it today (no `src` file reads `checks`; checked with grep). [INFERENCE: the extension writes while the agent runs, before the wrapper writes `state`, so "state last" holds (`wrapper.ts:120-156`).] |
| B3 | Move `/board`, `/task` and `/findings` (`board-commands.ts`, 109 lines, plus `cli.ts:10,81`). Their reads go through `host.board`. `/findings` from a branch reads job records (`board-commands.ts:97-102`), so the core publishes a read of finished jobs as `host.jobs.list()`. | about 110, minus about 5 for `list()`: net about 105 | The `orchestration` plugin (required, so the commands are always there), with entry 23 | Medium. **It moves a contract**: roadmap 18 assigns these commands to the core. Vision line 173 ("each plugin registers its own") allows the move. Their doc pages move to the plugin. [INFERENCE: entry 27 needs the same `host.jobs.list()` to show job states.] It cannot land before entry 23 exists. |

### Considered and kept

- **`resumeOnBudget`** (`wrapper.ts:79-92,121-128`, `job-limits.ts:15`, `jobs.ts:27,30`; about 15 lines). A plugin could resume a job through `continue`, but `continue` refuses a read-only kind (`job-control.ts:74`), and the kind that needs the resume (audit) is read-only. Moving it would widen `continue`.
- **`deadline`'s loop for timers longer than 24.8 days** (`job-limits.ts:33-46`). It saves 6 lines at the cost of a new config refusal.
- **Steer** (`steer.ts`, `steer-inbox.ts`, `job-control.ts:47-58`, part of `job-commands.ts`, `wrapper.ts:131-135`; about 130 lines), **the guards and the shell parser** (561), **the systemd scope and the stop** (192), and **the dead-job sweep**. `spec/vision.md:52,57-58,172,177` place all of them in the core.
- **`lock.ts` takeover** (127). AR0036 and AR0040 rest on it.
- **The event log's follow and replay**. AR0035, AR0044, AR0045 and AR0051 rest on it.
- **`agent-stream.ts`'s `Raw` type**. It types the agent's output at a trust boundary.
- **The test kit** (`testing.ts` and `fake-agent.ts`, 268 lines). The vision puts it in the core (`spec/vision.md:59`). Its internal imports (`board`, `jobRunner`, `pluginHost`, `registry`) rule out a separate package unless those are published. Accounting option for the human: a separate `core/testing` line in `BUDGETS`, so production growth shows on its own. That cuts nothing, so it is not counted below.

## Duplicated code across files

| What | Where | Proposal |
| --- | --- | --- |
| Plugin-entry validation | `host.ts:116-129` and `env.ts:85-94`; `PLUGIN_NAME` at `host.ts:25` and `env.ts:27` | A1 |
| Describing a value in an error | `host.ts:140-147` and `config.ts:125-133` give the same text; `env.ts:134-139` (`kind`) and `board-file.ts:83-85` differ | A2 for the first two |
| A plugin's step that throws | `host.ts:131-138` and `jobs.ts:193-200` | A3 |
| Reading a record file | `job-control.ts:21-26`, `job-records.ts:17-21`, `wrapper.ts:64` (wrapped in its own guard), `worktree-guard.ts:177` | A4 for the first two |
| Is the job's wrapper alive | `job-control.ts:28-31` and `job-records.ts:67` | A4 |
| Flag parsing | `cli.ts:28-38`, `spawn-command.ts:36-49`, `job-commands.ts:58-64`; `AMOUNT` at `spawn-command.ts:10` and `job-commands.ts:19` | A7 |
| A job's end files | `job-scope.ts:84-89` (a wrapper that never started) and `wrapper.ts:153-156` with `run-record.ts:61-67` | Keep. Risk: entry 16's `reason` and `since` must be written in both places. |
| Write whole (temporary name, then rename) | `job-control.ts:90-93`, `job-records.ts:72-73`, `job-scope.ts:85-88`, `wrapper.ts:58-63`, `events.ts:121-125`, `board.ts:158-161`, `board-file.ts:65-68`, `job-record.ts:12-20` | Keep. Each is 2 to 5 lines with its own temporary name; the board's fixed name relies on its lock. The styleguide prefers this duplication to a helper file. |
| Running `git` | `git.ts:6-16`, `job-records.ts:109-112`, `board-commands.ts:85` | Keep. Each has its own error contract (throw, return the refusal, read the status). |
| Print usage, exit 2 | `cli.ts:91-92,104-105,129-132`, `job-commands.ts:71-74`, `spawn-command.ts:19-20`, `roles-command.ts:14-15`, `ticket-command.ts:37-38`, `board-commands.ts:37-38` | Keep (1 to 2 lines each). |
| Name pattern `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` | `commands.ts:43`, `jobs.ts:90`, `roles.ts:39`; inside `job-control.ts:17` | Keep (one line each). |
| Short sleep through `Atomics.wait` | `lock.ts:16,35`, `job-scope.ts:110,121` | Keep (one line each). |
| The board follows the jobs | `host.ts:44-46` and `testing.ts:131,169-173`, already shared through `board-jobs.ts` | Keep. A change to one must reach the other (AR0047, AR0060, AR0061). |

## Comments that repeat the docs

Each line range below is code-comment text that the named doc page already says. "Keep" is what the comment still needs: a pointer, or a code-level detail the doc lacks.

| Comment | Repeats | Lines | Keep | Saves |
| --- | --- | --- | --- | --- |
| `wrapper.ts:13-25` | `docs/commands/spawn.md:42-60` | 13 | 2 | 11 |
| `job-scope.ts:8-13` | `spawn.md:38-40` | 6 | 1 | 5 |
| `job-scope.ts:26-28` | `spawn.md:40` | 3 | 1 | 2 |
| `job-stop.ts:5-9` | `stop.md:5-10` | 5 | 1 | 4 |
| `run.ts:6-10` | `run.md:5-15` | 5 | 1 | 4 |
| `events.ts:5-8` | `run.md:11-15` | 4 | 1 | 3 |
| `steer.ts:5-8` | `steer.md:7` | 4 | 1 | 3 |
| `job-control.ts:12-14` | `stop.md:5`, `steer.md:7`, `continue.md:5` | 3 | 1 | 2 |
| `job-control.ts:60-65` | `continue.md:5-10,17` | 6 | 2 (the `continuing` race) | 4 |
| `job-records.ts:10-12,41-44,81-82` | `jobs.md:5-16`, `prune.md:5-12`, `stopall.md` | 9 | 2 | 7 |
| `board-commands.ts:10-12,54-55,79-81` | `board.md`, `task.md`, `findings.md:5-9` | 8 | 2 | 6 |
| `roles.ts:5-8,95-97` | `roles.md:9-25` | 7 | 2 | 5 |
| `checks.ts:4-6,20-23` | `spawn.md:47` | 7 | 2 | 5 |
| `config-check.ts:5-9` | `config.md:5,29-31` | 5 | 2 | 3 |
| `env.ts:4-7` | `config.md:12-17` | 4 | 1 | 3 |
| `job-limits.ts:1-3` | `spawn.md:9` | 3 | 1 | 2 |
| `node-modules.ts:6-8` | `spawn.md:15` | 3 | 1 | 2 |
| `board-text.ts:4-6` | `ticket.md:30` | 3 | 1 | 2 |
| Total | | 98 | | 73 |

`env-guard.ts`, `worktree-guard.ts`, `shell-words.ts`, `git-writes.ts`, `lock.ts`, `clock.ts`, `plugin.ts`, `commands.ts` and `testing.ts` have no doc page; their comments are the only doc and stay. The API comments in `testing.ts` and `plugin.ts` will repeat `docs/plugin-api.md` once entry 51 writes it; trim them then.

## Budget

| Step | Lines | Basis |
| --- | --- | --- |
| Now | 4371 | `lineCount` over `packages/core/src` |
| After T1 to T6 (A1 to A7, C1, B1, B2) | about 4182 | 4371 − 38 − 10 − 6 − 66 − 17 − 52 |
| Entry 16, job state | +250 (range 200 to 300) | It rewrites the wrapper's end state, adds `reason`/`since`, idle, `Blocked:`, `block`/`unblock`, `job-state`, `--state`. Compare entry 14 (374) and entry 12 (102). |
| Entry 21, another machine: spawn and run | +350 (range 300 to 450) | `registerMachine`, `--machine`, `jobs.place`, the remote repository and push, running remotely through that machine's `arthur`, copying the record back, fetching the branch. The largest so far was entry 11 (383). B1 takes the `node_modules` part out of it. |
| Entry 22, another machine: stop and offline | +200 (range 150 to 250) | Remote stop, steer, continue and prune; offline jobs held `blocked`, then the grace. |
| Open core bug tickets AR0033, AR0059, AR0068, AR0070, AR0071 | +95 | 5 × the mean of 19 per bug ticket. AR0068, AR0070 and AR0071 each say "no core budget raise", and A1 to A5 alone free 38 lines for them. |
| End of entry 22 | about 5077 | |

Recommended: **core budget 5080 for entries 1 to 22**, written once in `test/structure.test.ts`. The comment beside it records the allotments above: 16: 250, 21: 350, 22: 200, bug tickets: 95, after the cuts. An entry that needs more than its allotment cuts elsewhere, or its ticket records the overrun as a decision.

Without the cuts, the same entries end near 5266. B3 lowers the budget by about 105 when entry 23 lands. B2's hook (+7) belongs to entry 53.

Entry 21 is the least certain estimate. If its plan comes out over 450, it should be split before it starts.

## Tickets to create

1. **Core: one plugin-entry check, one describe, one plugin-step guard, one record reader.** A1 to A5: about 38 lines out, and `arthur config check` stops printing one refusal twice (F1).
2. **Core: one flag parser for the CLI, `spawn` and `continue`.** A7: about 10 lines out, with every usage line and refusal text unchanged; it gives entries 16, 21 and 31 a place for their flags.
3. **`arthur ticket all` goes; `arthur board all` is the full board.** A6: about 6 lines out, plus the doc and test edits named above.
4. **Code comments that repeat the command docs become pointers.** C1: about 66 to 73 lines out, using the table above.
5. **The `node_modules` copy moves to a `prepare` hook of the `projects` plugin.** B1: 17 lines out of the core; roadmap 9, 21 and 41 and `spawn.md` edited.
6. **The `checks` record file moves out of the wrapper into a `delivery` extension.** B2: about 52 lines out now. Roadmap 11 and 53, `spawn.md` and `continue.md` edited; `host.jobs.registerExtension` lands with entry 53.
7. **`/board`, `/task` and `/findings` move into `orchestration`, with `host.jobs.list()`.** B3, at or after entry 23: net about 105 lines out of the core; roadmap 18 and 23 edited.
8. **Core budget set to 5080 for entries 1 to 22, with the allotment per entry.** Lands after 1 to 6, in `test/structure.test.ts` alone.
