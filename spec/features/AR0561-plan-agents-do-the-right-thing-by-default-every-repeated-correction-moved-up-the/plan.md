# AR0561 - Plan

- Job: 2026-10-29-plan-2bf6c90c
- Planned at: 7d9fb8398f69fff6bc9e46f94992b01ae85bb140

## Approach

The plan breaks P1–P22 into 16 tickets, T1–T16. Each is a code change, a check, or one sentence in one place, and each deletes the prose it replaces. The names T1–T16 are only for this plan. Once the plan is approved, the coordinator creates the real tickets with `arthur ticket new` and sets their order with `arthur ticket after`, as listed in the table at the end of this section. Nothing is installed, and no dependency is added.

Main as it is now, checked for each proposal (AR0555 is merged):
- `arthur merge` now prunes the ticket's jobs (`merge-command.ts:45`, `pruneTicket`). It still prints `nothing committed but the merge`. `after-merge.md` steps 1, 2 and 4 are still done by hand.
- Job sessions now live in each job's record (`wrapper.ts`, `--session-dir`), so a merge's prune deletes them. That changes how the five steers can be counted (see Not available directly).
- `arthur.config.ts` is in `.gitignore` and lives only at `/home/kacper/arthur/arthur.config.ts`, with `autoMerge: false`. No worker can change it: the P7 and P17 config edits are made by the owner, or by the coordinator on his word.
- Every package is at its line budget (core 6470, core/testing 349, delivery 1734, orchestration 2434, session 879/880). `wrapper.ts`, `merge-command.ts` and `testing.ts` are each at the 200-line cap.
- Two audit claims did not hold:
  - `plan-file.ts:30` already reads the verdict exactly as `wrapper.ts:184` does. P2 only registers `verdicts`.
  - `testing.ts:38` already puts a failing fake `omp` first on `PATH`, so the "stub omp" part of P11 already exists.
- Confirmed:
  - omp 18.3.0 applies an `input` returned by a `tool_call` handler. Its changelog in the binary says so ("A `tool_call` handler … can now return `input` to revise the arguments"), and the code has `w?.input !== undefined`. Not yet run end to end.
  - `tsc` with the three P20 flags gives exactly 2 errors (`merge-checks.test.ts:280`, `youtrack.test.ts:859`).
  - 386 source lines are over 200 characters; 34 test files declare their own `until`.

Left alone:
- the guard's parser (not shrunk);
- the merge's checks on main, and the merge steps' sandbox;
- the findings mode `summary` (AR-D233);
- the plan and plan-review formats;
- the BUDGETS numbers as such;
- the coordinator's `--unreviewed`/`--no-ci` decision rule;
- `arthur repeats` (AR0562) and `arthur pyramid` (AR0563);
- the macOS `sandbox-exec` profile.

Each proposal: in, out, or changed. "Test" means the test that fails before the change and passes after it.

- **P1 in**, codebase, T1.
  - Change: the `tool_call` handler in `checks-extension.ts` returns `{ input: { ...input, timeout: max(given, 1800) } }` for a check call. `fake-agent.ts` applies the last returned `input`, as omp does.
  - Test: in `checks.test.ts`, a check call with no timeout runs with 1800, one at 2400 keeps 2400, and any other command is unchanged.
  - Deletes `worker.md:19`, the 1800 s line in `spawn.md`, and the steer clause.
- **P2 in, changed**: plan-file stays as it is. Codebase, T3.
  - Change: `job-omp.yml` gets `retry.maxRetries: 20`. The worker reads omp's back-off in the binary and states the window this gives.
  - The wrapper resumes once with `--continue`, through the budget-resume path, when the run stopped on a transient provider error (connection error, overloaded, 5xx) or a kind with `verdicts` ended without one. A second failure ends the run as today. A cyber refusal is not resumed.
  - The `reason` ladder moves out of `wrapper.ts` (200 lines) into a new `job-ending.ts`.
  - `plans.ts:29` gets `verdicts: ["PASS","FAIL"]`.
  - Test: `wrapper.test.ts`, with an agent script that plays run A first and run B on `--continue`.
  - Deletes the last clause of `reviewer.md:26` and the steer's verdict sentence. The `delivery.ts:170` wake says the review was resumed once already.
- **P3 in, changed**: the Landlock signal scope is out of this plan (see Not available directly). Codebase, T1.
  - Change: a `KILLS` refusal in `worktree-guard.ts` for the verbs `pkill` and `killall`, wherever the guard finds a verb (`bash -c`, `eval` and `sudo` included).
  - Test: new rows in `worktree-guard.test.ts`; `kill <pid>` still passes.
  - Deletes the steer clause.
- **P4 in**, codebase, T2. Folds in AR0501, which the coordinator drops as folded.
  - Change: the guard refuses any write to `spec/features/*/ticket.md` in the job's worktree; `findings.md` stays writable.
  - Orchestration's new `paper-check.ts` provides `merge.check`. It refuses a worker branch whose `main...tip` diff changes a `ticket.md`, `spec/decisions.jsonl` or `spec/build.json`, naming the file. The check goes by path only, with no Markdown parsing.
  - `review-needed` asks `merge.check` first, so no review is paid for a branch the merge will refuse.
  - Tests: guard rows; a new `paper-check.test.ts`; a `review-needed.test.ts` row.
  - Deletes the steer clause.
- **P5 changed**: the raise shows in `outcome.md` through T5's "What went in" line for `test/structure.test.ts`, not by parsing BUDGETS. Codebase plus a styleguide sentence, T5.
  - `styleguide.md:13` becomes: "a raise of an existing package's budget shows in the merge's outcome.md; a new package's first budget is the owner's decision".
  - Deletes the `structure.test.ts:8` comment clause and the last sentence of `coordinator.md:49`.
- **P6 in**, codebase, T7.
  - Change: the `restarts()` tick in `restart.ts` writes the `/restart` request itself, with slot `due`, `run: true` and a 120 s wait. It does so only when a restart is due, no job runs, no request is pending, and `servicePid === process.pid`.
  - `settle` treats `due` like `/restart`, not like a night try. The existing path then sends `Restarted.`.
  - Test: `restart.test.ts`.
  - Deletes the restart sentence of `coordinator.md:73`, and the `restart-guard.ts:78` context line becomes "restarts itself once no job runs".
- **P7 in**, codebase, T8, with an owner config edit.
  - Change: a new `pass-forward.ts` in delivery. On a review PASS (or a `no review` answer) in an `autoMerge` project, it runs `arthur merge --auto <job>` as a child process (see Not available directly) and wakes the coordinator once with the merge's output.
  - Test: `review.test.ts`.
  - Deletes the `--auto` sentence of the PASS wake (`delivery.ts:163`) and the merge-ask step.
- **P8 in, split** into T5 and T6. Codebase plus fixed final-message sections.
  - T5: the worker's final message gets `## What went in`, one `- <path>: <what it does now>` line per file of the branch. `settleTicket` keeps those lines and adds `- <path>: not described` for any changed file left out; with no such section it falls back to the commit subjects. Then it commits the ticket folder, the tickets made, `spec/build.json` and `CHANGELOG.md` as `spec: <id> merged` before `github.push`.
  - T6: `reviewer.md:24` fixes the notes as `## Notes` with `- (<kind>) <file:line>: <title>. <what>` lines. `settleTicket` passes the PASS review's notes in the `findings.onMerge` request. The findings plugin appends those of kind security, bug or risk as entries and settles them in the project's mode.
  - Tests: `merge.test.ts` and `on-merge.test.ts`.
  - Deletes `after-merge.md` steps 1, 2 and 4, and `merge-outcome.ts:62` "rewrite What went in…".
- **P9 in**, codebase, T7.
  - Change: `github.ts:93` sends no `coordinator-message` for `conclusion === "success"`; `ci-finished` is still emitted.
  - Test: `github.test.ts`.
  - The success half of `coordinator.md:15` goes.
- **P10 in**, codebase plus one criteria line, T4.
  - Change: when `sandboxed()` reports `no sandbox:`, the job ends `failed: no sandbox: <why>; set core.jobs.unsandboxed: true …`, unless the new core option `core.jobs.unsandboxed` is on. The spawn passes the option to the wrapper as a record field. The test kit's runner turns it on, so tests on a bare host behave as today.
  - `review.md` gets one line: "a guard bypass whose write the sandbox refuses is a note; a plain command the base refused and the tip lets through is a FAIL".
  - Test: `sandbox.test.ts:161` changes to "refuses unless opted in".
  - `spawn.md:126` is rewritten.
- **P11 changed**: the kit's root stays in `tmpdir()`. The stub `omp` already exists. Codebase, T9.
  - Change: `testing.ts` sets `HOME` and `TMPDIR` under its root, and `GIT_CONFIG_GLOBAL` to a kit file holding `user.name` and `user.email`. On SIGTERM, SIGINT and SIGHUP it runs its exit cleanup.
  - The environment setup moves into a new `test-env.ts`, imported by `testing.ts`, because `testing.ts` is at 200 lines.
  - Test: `testing.test.ts` (a SIGTERMed child leaves no root and no slice).
- **P12 changed**: in = a job question answered by policy continues the job by itself. Out = matching on facts (see Not available directly). Codebase, T15.
  - Change: `decision-hooks` calls `host.jobs.continue` with the decided line, and the wake says "continued by policy (<class>)".
  - Test: `decisions.test.ts`.
  - Deletes the "Act on it … arthur continue" wake line.
- **P13 in**, codebase, T15.
  - Change: `arthur silent on '<work>' [--until <time>] [--usage <pct>] [--tickets <ids>] --recommend` records a grant. While the grant is in force, an `ask` with `--recommend` is answered `by recommendation: <grant id>`. It never answers a `--what --unreviewed|--no-ci` ask, a `--budget 0` ask or a class proposal.
  - The models plugin provides `models.usage` for the `--usage` bound.
  - Tests: `silent.test.ts` and `decisions.test.ts`.
  - Deletes the grant memory in the handoff.
- **P14 changed**: `LIMIT` in `review-records.ts:14` goes from 2 to 4, so rounds 3 and 4 hand back by themselves and the owner is asked at the fourth FAIL. There is no "tests only" or "same finding" detection (see Not available directly). Codebase, T8.
  - Test: the hand-back rows in `review.test.ts`.
  - The `review-limit.md` trigger text changes.
- **P15 in**, static analysis, T11.
  - Change: a new `test/mutate.ts` (no budget; at most 200 lines) and `"mutate": "node test/mutate.ts"` in `package.json`.
    - Mutants: one hunk reverted to the base; one statement deleted; one `&&`/`||` operand dropped; `===`/`!==`, `<`/`<=` and `>`/`>=` flipped; a number ±1; `true`↔`false`; `.some`↔`.every`; one array element or regex alternative or class member dropped.
    - Test files run per mutant: the same-name test, then the tests that import the file, then the package's `test/` folder.
    - It restores the bytes it keeps in memory, on exit and on a signal, and refuses a dirty tree.
  - `checks-extension.ts` records `mutate pass|fail` and gives it the 1800 s timeout.
  - Test: `test/mutate.test.ts`.
  - Deletes `worker.md:20-21`, which become one line, and turns `reviewer.md:18` into "start from mutate's survivors".
- **P16 in**, codebase, T12.
  - Change: `tipChecks()` is extracted from `review-needed.ts:79-85`. `arthur review` and the hand-back start a review only when the tip's clean tree has `check pass`, `test pass` and any `mutate` record (named survivors are allowed). Otherwise the hand-back continues the worker once with a fixed instruction, and a second miss goes to the coordinator.
  - Test: `review.test.ts`.
- **P17 in**, static analysis plus an owner config value, T10.
  - Change: the kit exports one `until(what, predicate, { deadlineMs })`. `structure.test.ts` fails on a test file that declares its own `until` or poll loop, and on fixed waits per file growing past a recorded baseline. The 34 copies are migrated.
  - The `limits.test.ts` time-limit tests respawn at double the limit (3, 6, 12, 24 s) when the job ended before the state they test.
  - Per-job CPU cap: `resources({ perJob: { cpu: N } })` in the owner's config.
  - Tests: `structure.test.ts`, and `limits.test.ts` itself.
  - Deletes the steer clause.
- **P18 in**, static analysis, T13.
  - Change: committed key lists `github-shapes.json`, YouTrack and Telegram, each with its source URL and date, and one `fake-shapes.test.ts` per plugin comparing the fake's keys recursively.
  - The fake line in `review.md` becomes "the shape test passes".
- **P19 in**, static analysis, T14, after AR0495.
  - Change: a line counts `max(1, ceil(length/160))` toward the 200-line cap and the package budget, with one re-baseline decision.
  - Test: `structure.test.ts`.
- **P20 in**, static analysis, T13: the three flags in `tsconfig.json` and the 2 fixes; `npm run check` proves it.
- **P21 in**, prose plus registration, T16.
  - Change: a new `.agents/arthur/criteria/verify.md` (the roles audit's appendix, with `npm run mutate`) and a generic skeleton `packages/core/criteria/verify.md` that `arthur init` copies.
  - The worker's criteria become `["styleguide","verify"]` (`jobs.ts:198`) and the reviewer's `["styleguide","review","verify"]`. Delivery's `prompt` provider adds the project's `review.md` for the worker.
  - Tests: `roles.test.ts`, the init test.
  - Deletes `worker.md:17` and `reviewer.md:17`, and `npm ci` from `review.md:12`.
- **P22 in, changed**:
  - The `job-steered` event (`{ id, kind, text, via: steer|continue }`) moves to T1, so the counts of later tickets can read it.
  - The "outside text is data" rule moves into one core `## Every job` section. It also carries "wait for every command you start" and "never end with an offer to continue". The 7 job-role copies go; the coordinator, which is not a job, keeps its own.
  - The retro's context lists the period's corrections grouped by their first sentence, and `retro.md:54` lets a proposal be code or a check. This goes after AR0562, which already lets it propose a code default.
  - Deletes the 5 `proc://` paragraphs, `coordinator.md:27/30/51` restated refusals and `coordinator.md:73`.
  - Tests: `outside-text.test.ts` becomes "every job's assembled prompt holds the rule once; no job role file does"; `retro.test.ts`.

The other agents: the planner and plan reviewer get the enforced verdict and resume (T3). The retro gets the corrections (T16, after AR0562). Onboarding drafts `verify.md` through the skeleton (T16).

The five recurring steers:

| Steer | Retired by | Counted after the merge |
|---|---|---|
| 1800 s timeout | T1 | steers carrying "1800", target 0; reviews naming a run killed at 300 s or exit 143 |
| Flaky test (`limits.test.ts`) | T10 | steers naming `limits.test`; reviews and findings naming it |
| `pkill` | T1 | steers naming `pkill`; FAILs or findings about a killed suite |
| Verdict line | T3 | steers carrying "PASS or FAIL"; `job-ended` events with `failed: no verdict`, target 0 |
| Decisions line | T2 | steers naming "Decisions"; merged branches whose diff changes a `ticket.md`, target 0 |

Each steer is counted over the 7 days after its ticket merges, against the 2026-10-29 baseline (41 / 27 / 28 / 28 / 8). The coordinator also drops that clause from its standing steer (`handoff.md:24`) at that merge.

Ticket order, with the `arthur ticket after` lines the coordinator sets:

| Ticket | Proposals | After |
|---|---|---|
| T1 | P1, P3, P22's `job-steered` event | none |
| T2 | P4 | T1 |
| T3 | P2 | T1 |
| T4 | P10 | T3 |
| T5 | P8 (What went in, commit), P5 | T1 |
| T6 | P8 (review notes to findings) | T5 |
| T7 | P9, P6 | none |
| T8 | P7, P14 | T6, T7 |
| T9 | P11 | none |
| T10 | P17 | T9 |
| T11 | P15 | T1 |
| T12 | P16 | T8, T10, T11 |
| T13 | P18, P20 | none; AR0558 after T13 |
| T14 | P19 | AR0495 |
| T15 | P13, P12 | T2 |
| T16 | P21, P22 (prose, retro) | T2, T3, T4, T6, T7, T8, T11, T12, AR0562 |

Estimated line budgets, which the worker measures; `+N` adds N lines:

| Ticket | Budget change |
|---|---|
| T1 | core +4, core/testing +3, delivery +3 |
| T2 | core +3, orchestration +25, delivery +3 |
| T3 | core +20, orchestration +1 |
| T4 | core +10 |
| T5 | delivery +25 |
| T6 | delivery +8, findings +25 |
| T7 | session +10, github +0 |
| T8 | delivery +60 |
| T9 | core/testing +6 |
| T10 | core/testing +12 |
| T11 | delivery +2 (`test/` has no budget) |
| T12 | delivery +20 |
| T13 | none (tests and `tsconfig.json` only) |
| T14 | every budget re-baselined, one decision |
| T15 | orchestration +60, models +5 |
| T16 | core +10, delivery +8, manage +15 |

## Not available directly

- **P7, merge inside `arthur run`.** The merge's checks on main run through `spawnSync` (`merge-checks.ts:37`). Called in process, they would block `arthur run` (inbox, channels, sweeps) for the length of `npm test`, 193 to 972 s. Checked in `merge-checks.ts` and `merge-command.ts`.
  - Option 1: run the CLI as a child process, `[process.execPath, fileURLToPath(import.meta.resolve("@arthur/core/cli")), "merge", "--auto", job]`, the pattern of `orchestration/src/coordinator.ts:17` - cost about 15 lines, risk: the child runs under arthur run's environment and config [INFERENCE: the CLI finds the same config from that cwd]; the merge lock already covers a second process.
  - Option 2: make the merge steps async - cost: a rewrite of `merge-checks.ts`, risk: regressions in the most-reviewed path.
  - Option 3: only set `autoMerge: true` and let the coordinator run `merge --auto` on the wake, as today - cost 0, risk: one coordinator turn per PASS stays.
  - Recommendation: Option 1.
- **Counting the steers "from the job sessions after the merge".** Since AR0555 a merge prunes the ticket's jobs, and with them their records, their `session/` folders and delivery's `checks`. Checked in `wrapper.ts` (`--session-dir` in the record), `merge-command.ts:45` and `delivery.ts` (`jobs.keep`).
  - Option 1: count from the coordinator's own session (`~/.omp/agent/sessions/-arthur/*.jsonl`, the `arthur steer`/`continue` calls), the `job-steered` events from T1, and the filed reviews and git history - cost 0, risk: job-side behaviour shows only through reviews and events.
  - Option 2: keep a merged job's `session/` for `prune.keepJobsDays` - cost: a core prune change, risk: disk use and reversing part of AR0555.
  - Recommendation: Option 1.
- **P3, Landlock signal scope.** It needs Landlock ABI 6 (Linux 6.12). This host runs 6.8 with ABI 4 (the tooling audit's probe). A PID namespace is ruled out by `apparmor_restrict_unprivileged_userns=1`.
  - Option 1: the guard refusal now; a planning ticket for the scope once a host runs 6.12 - cost 0, risk: `kill $(pgrep …)` still gets through.
  - Option 2: add an `abi >= 6` branch to `job-sandbox.ts` now - cost about 5 lines, risk: code no test here can run, which a reviewer FAILs.
  - Recommendation: Option 1.
- **P11, moving the kit's root out of `/tmp`.** The sandbox walk (`job-sandbox.ts:47-56`) scans every folder from `/` to each hidden path, so a root anywhere under `/tmp` still scans `/tmp`. The places outside `/tmp` that a job lets its tests write are its worktree, where long paths approach the 108-byte limit on a Unix socket path (tmux sockets), and `/dev/shm` [INFERENCE: writable under the `/dev` grant; untested].
  - Option 1: keep the root in `tmpdir()`, keep leftovers inside it (`TMPDIR`, SIGTERM cleanup), and let P17's retries absorb the walk - cost 0, risk: about 0.35 s per sandbox start stays.
  - Option 2: `/dev/shm/arthur-test-*` where writable, else `tmpdir()` - cost about 3 lines, risk: Linux-only, needs a proof under the sandbox.
  - Option 3: `.arthur-test/` in the checkout - risk: socket paths over 108 bytes.
  - Recommendation: Option 1.
- **P5, "shown by the merge".** Delivery merges any project; BUDGETS is Arthur's own `test/structure.test.ts`. Parsing it there would tie a plugin to one repository.
  - Option 1: show it through T5's per-file "What went in" line for `test/structure.test.ts` (the `not described` fallback guarantees the file appears) - cost 0 extra, risk: the line is the worker's words, checked by the reviewer.
  - Option 2: a delivery option naming a budget file and its pattern - cost about 15 lines plus an option, risk: an option nobody else uses.
  - Recommendation: Option 1.
- **P14, "a FAIL about tests only" and "the same finding twice".** FAIL findings carry no kind or identity in code; reviews are free text. Checked in `review-records.ts` and `review-file.ts`.
  - Option 1: `LIMIT` 2 → 4 - cost: one constant plus docs, risk: up to two more paid rounds on a hopeless branch.
  - Option 2: classify findings after T6's fixed format - cost about 40 lines, risk: matching on free text.
  - Recommendation: Option 1.
- **P12, matching on the review verdict and the package.** Neither fact is on an `ask`. The asks that missed or matched wrongly (merge after PASS, budget raise, AR-D205's docs-only merge) disappear with P7 (which auto-merges `no review` too) and P5. Ticket kind and the `--what` flags already match.
  - Option 1: drop the fact-matching rewrite; keep "a policy answer continues the job" - cost 0, risk: word matching stays for the classes AR0562 will propose.
  - Option 2: structured `--fact key=value` on asks and classes - cost about 50 lines in orchestration, risk: a second matching rule beside the words.
  - Recommendation: Option 1.

## Files

- `packages/delivery/src/checks-extension.ts`: return the input with the timeout (T1); the `mutate` script recorded, with its timeout (T11).
- `packages/core/src/fake-agent.ts`: apply a returned `input` (T1).
- `packages/core/src/worktree-guard.ts`: `KILLS` (T1); ticket.md writes refused (T2).
- `packages/core/src/jobs.ts` or `job-commands.ts`: emit `job-steered` (T1); worker criteria `["styleguide","verify"]` (T16).
- `packages/orchestration/src/paper-check.ts` (new) and `orchestration.ts`: `merge.check` (T2).
- `packages/delivery/src/review-needed.ts`: ask `merge.check` (T2); `tipChecks()` (T12).
- `packages/core/src/wrapper.ts`, `job-ending.ts` (new), `job-omp.yml`: resume once (T3); refuse without a sandbox (T4).
- `packages/orchestration/src/plans.ts`: plan-review `verdicts` (T3).
- `packages/core/src/job-sandbox.ts`, `core-options.ts`, the job record writer: `core.jobs.unsandboxed` (T4).
- `packages/delivery/src/merge-outcome.ts`: What went in, the `spec:` commit (T5); notes to `findings.onMerge` (T6).
- `packages/delivery/src/merge-command.ts`: the `nothing committed` line (T5).
- `packages/findings/src/on-merge.ts`, `packages/findings/docs/findings.md`: notes as entries (T6).
- `packages/github/src/github.ts`, `packages/github/docs/github.md`: no success wake (T7).
- `packages/session/src/restart.ts`, `restart-guard.ts`, `docs/session.md`: restart when due (T7).
- `packages/delivery/src/pass-forward.ts` (new), `delivery.ts`, `review-records.ts`, `docs/commands/review.md`, `docs/commands/merge.md`, `roles/coordinator/review-limit.md`: T8.
- `packages/delivery/src/review-command.ts`, `hand-back.ts`, `docs/commands/review-needed.md`: the review gate (T12).
- `packages/core/src/testing.ts`, `test-env.ts` (new): T9; `until` exported (T10).
- `test/structure.test.ts`: the budget comment (T5); `until` copies and fixed-wait ratchet (T10); width (T14).
- `packages/core/test/limits.test.ts` and the 34 test files with their own `until`: T10.
- `test/mutate.ts`, `test/mutate.test.ts` (new), root `package.json`: T11.
- `packages/{github,youtrack,telegram}/test/*-shapes.json`, `fake-shapes.test.ts` (new): T13.
- `tsconfig.json`, `packages/delivery/test/merge-checks.test.ts`, `packages/youtrack/test/youtrack.test.ts`: T13.
- `packages/orchestration/src/silent.ts`, `decision-log.ts` ask path, `decision-hooks.ts`, `docs/commands/silent.md`, `decision.md`; `packages/models/src/models.ts` (`models.usage`): T15.
- `packages/core/src/roles.ts`: the `## Every job` section (T16).
- `packages/delivery/src/delivery.ts`: worker `prompt` provider with `review.md` (T16).
- `packages/manage/src/retro.ts`: corrections (T16).
- `.agents/arthur/criteria/verify.md`, `packages/core/criteria/verify.md` (new): T16.
- `.agents/arthur/criteria/styleguide.md`: line 13 (T5), the width clause (T14).
- `.agents/arthur/criteria/review.md`: the sandbox note line (T4), the fake line (T13), `npm ci` and the mutation lines (T16).
- `packages/core/roles/worker.md`: :19 (T1); final message `## What went in` (T5); :20-21 (T11); :17 and the shared rule (T16).
- `packages/delivery/roles/reviewer.md`: :26 (T3), :24 notes format (T6), :18 (T11), :17, :34 and the shared rule (T16).
- `packages/delivery/roles/coordinator/after-merge.md`: steps 1, 2 and 4 go (T5, T6).
- `packages/orchestration/roles/coordinator.md`: :15 (T7), :49 (T5), :73 (T7), :27/30/51 (T16).
- `packages/orchestration/roles/planner.md`, `plan-reviewer.md`, `packages/manage/roles/auditor.md`, `retro.md`, `packages/projects/roles/onboarding.md`: the rule and `proc://` paragraphs removed (T16).
- `test/outside-text.test.ts`: reworked (T16).
- `packages/core/docs/commands/spawn.md`: the timeout line (T1), the guard list (T1, T2), resume (T3), the sandbox (T4).
- `docs/deploy.md`: T4.
- `packages/delivery/evals/{merge,review-pass,check-failed}/scenario.json` and `packages/session/evals/*`: merge output and wake text (T5, T8).
- `arthur.config.example.ts`: `core.jobs.unsandboxed` (T4); `resources` per-job CPU (T10).

## Risks

- **The returned `input` is honoured by the fake agent but not by real omp.** T1 runs one real-omp job and shows the 1800 s value took effect, as AR0113 did.
- **A resume loop.**
  - The resume happens at most once per run, with a fixed message.
  - A cyber refusal or a user abort is never resumed.
  - T3's tests cover a second failure ending the run as today.
- **The guard refuses legitimate work.**
  - The history shows no wanted `ticket.md` edit by a branch (34 of 417 merges added only dated lines).
  - `findings.md` stays writable.
  - The refusal text says what to do instead.
- **T5's commit picks up the coordinator's uncommitted board moves.** That is intended, since they are the coordinator's own moves. The commit runs with `core.hooksPath=/dev/null` like the merge, and only after the identity check.
- **An unattended restart cuts a coordinator turn.** It uses the same 120 s handoff wait as `/restart`. It only fires under the service, with no job running and no request pending.
- **Merges with nobody watching (T8).** `auto-merge.ts` still holds the always-review paths and waits for CI. Every refusal and every success wakes the coordinator once. P7 changes nothing for a project with `autoMerge: false`.
- **Fail-closed sandbox (T4) breaks a host without Landlock.** `arthur doctor` and the refusal name the opt-in. The kit turns it on, so tests stay as they are. macOS and remote machines need the opt-in.
- **`HOME` and `TMPDIR` changes (T9) break tests that read the real ones.** The first full run lists them, and each is fixed by naming its path explicitly [INFERENCE: the count is not known yet].
- **`npm run mutate` (T11) takes too long.** It runs only related test files and stops at a `--max` cap. It always restores the file from memory.
- **Raising `LIMIT` to 4 (T8) costs more rounds.** Each round keeps its job budget, and the coordinator still sees every FAIL.
- **Prose deleted before its code lands.** T16 is ordered after every ticket whose code replaces the prose it deletes.

## How to test

- **Done means: a plan the owner approves, with P1–P22 each in, out or changed, and for each in its layer, files, test, prose deleted, budget and tickets.** Proof: the owner's answer recorded with `arthur decision answer` on this plan. Each ticket then merges only once:
  - its named test fails on the base and passes on the tip, as the reviewer shows by reverting the code;
  - `npm run check && npm test` pass.
- **Every owner decision is named.** Open questions below lists P5, P7, P10, P17 and P19, plus P13, P14, the budgets and AR0501. Each is recorded with `arthur decision ask`/`answer` before the ticket it gates is spawned.
- **Each of the five steers names its retiring ticket and a count.** The table in Approach gives both. The coordinator runs each count over the 7 days after the ticket's merge, from its session's `arthur steer|continue` calls, the `job-steered` events, `job-ended` reasons in `.arthur/events.jsonl` and `git diff $(git merge-base M^1 M^2) M^2 -- 'spec/features/*/ticket.md'` over the merges. The target is 0 steers carrying the clause, against the 2026-10-29 baseline.
- **Nothing is installed; no dependency is added.** `test/structure.test.ts` already fails on any runtime dependency or non-toolchain dev dependency. The lockfile is unchanged in every ticket except T13 (`tsconfig.json` only), which the merge's `npm ci` shows.

## Open questions

- Do you approve the in/out/changed call for each proposal? Most of all: P11 keeps the test folder in `/tmp`; P12 keeps only "a policy answer continues the job"; P14 becomes "rounds 3 and 4 start by themselves"; P3's kernel-level guard waits for a host on Linux 6.12 or later.
- P5: may `styleguide.md:13` read "a raise of an existing package's budget shows in the merge's outcome.md; a new package's first budget is the owner's decision"?
- P7: set `autoMerge: true` for the arthur project in your `arthur.config.ts`? It is outside the repository. Will you edit it, or may the coordinator?
- P10: should a job with no sandbox refuse to start unless `core.jobs.unsandboxed` is on? And should a guard bypass that the sandbox refuses be a review note, not a FAIL?
- P14: raise the automatic hand-back from 2 FAILs to 4 before you are asked?
- P17: which per-job CPU cap, via `resources({ perJob: { cpu: N } })` in your config? The recommendation is 3, chosen after the worker times one suite at that cap.
- P19: count a line over 160 characters as more than one, with every budget re-baselined once, landed after AR0495?
- P13: which bounds may a "go with my recommendation" grant carry (time, usage %, tickets)? Should it be kept from ever answering an unreviewed or no-CI merge, an unlimited budget, or a class proposal?
- Until T5 merges, may the workers raise budgets by the numbers in this plan, as they measure them (as in AR-D328)?
- May AR0501 be dropped as folded into T2?