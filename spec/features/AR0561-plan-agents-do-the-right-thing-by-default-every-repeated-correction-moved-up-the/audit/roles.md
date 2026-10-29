# Roles audit: the prose layer against the inverse pyramid (prefix R)

Scope: the role files, the coordinator procedures, `.agents/arthur/criteria/*.md`, the job wrapper's run-end parsing (`packages/core/src/wrapper.ts`, `job-state.ts`) and delivery's review, hand-back, merge outcome and findings code. Read-only audit. The repository has no `AGENTS.md`/`CLAUDE.md` files; AR0549 (planning) plans a root `AGENTS.md`.

## Data used

- **Job sessions:** 430 omp sessions in `~/.omp/agent/sessions/-.arthur-worktrees-*` (156 worker, 266 review, 8 other; 2026-10-16..29). From them I took every bash call running `npm test`/`npm run check`, every `pkill`/`killall`, and every follow-up user message: a steer, continue or hand-back, i.e. any message after the task.
- **Run ends:** the event log `.arthur/events.jsonl`, 4473 events from 2026-10-25 to 10-29, 606 `job-ended`.
- **Reviews:** 607 filed `review-*.md` (496 PASS, 110 FAIL, 1 none).
- **Other inputs:** the coordinator's handoff, 35 `/tmp/settle*.py` scripts, and `npx arthur roles` together with the assembled `prompt` file of live jobs.

### What recurs, measured

| Correction (context) | Evidence |
|---|---|
| a) checks: 1800 s, one call, wait | 1210 check calls in job sessions; **799 (66%)** have no `timeout` or one < 1800. **332 of 409** jobs that ran checks did so at least once. 158 of 436 follow-up messages to jobs carry "1800". The suite takes **249 s** (worker b17e611d session), close to omp's default 300 s (`gA = { bash: { default: 300, min: 1, max: 3600 } }` in the omp binary). worker.md:19 already says 1800 s. |
| b) flaky `limits.test.ts` | 52 follow-ups name limits.test; 37 reviews mention it; 10 tickets on flaky tests (AR0136, 0137, 0159, 0167, 0293, 0301, 0423, 0448, 0464, 0544). |
| c) no `pkill -f` | **63** pkill/killall calls in 43 job sessions. 16 use a pattern that matches other jobs (`pkill -f "npm test"`, `pkill -f "node.*--test"`, review-eb9a2e1b, review-0484756b). 61 follow-ups say it. AR0484 F2 was settled "deferred (client summary)". No role says it. |
| d) verdict last line | 154 follow-ups carry "PASS or FAIL". 3 review runs ended `failed: no verdict` in 5 days of events. |
| e) no hand-written Decisions | 26 follow-ups; reviews flag a branch-written Decisions line in AR0285, AR0288, AR0374, AR0379 ("Worker: github's line budget 635 to 647"), AR0437, AR0498 and AR0557 (review-1.md:23). |
| f) a test per behavior | **82 of 110** FAIL reviews name, in their findings part, an uncaught mutation or a test that would still pass; 30 follow-ups say it. |
| g) Connection error | 7 runs `failed: the agent stopped on error: Connection error.` (5 review, 2 worker) on 10-28/29, 3 of them at 08:40 on 10-29. omp already retries 10× (`retry.maxRetries` default 10, base 500 ms, max 5 min). |
| h) outcome by hand | 35 `/tmp/settle<ticket>.py` scripts. `after-merge.md:5-7`. Eval `delivery/review-pass` is at **0/3** in `evals/baseline.json`. |
| i) memory in handoff | handoff.md lines 9, 22, 25-29: restart unit 47, merge→restart→spawn order, policy ids AR-D218/AR-D63/AR-D233, line budgets of 6 packages. |

### Prompt sizes (lines/words)

| Role | Role file | + criteria and sections as assembled |
|---|---|---|
| worker | 46 / 1184 | **115 / 2216** (live `prompt`: worker + styleguide + findings format). **No review criteria.** |
| reviewer | 34 / 753 | **138 / 2331** (live `prompt`: reviewer + styleguide + review) |
| coordinator | 91 / 2753 (line 30 alone is 963 chars) | + styleguide 787 + autopilot 296, + the per-turn context, + a procedure per wake (after-merge 297, review-limit 275, plan-ended 554, morning-report 431, audit-ended 409, retro-ended 293, onboarding-ended 383) |
| planner / plan-reviewer | 53 / 811, 27 / 552 | + styleguide 787 |
| auditor | 47 / 883 | + audit 413 + styleguide 787 |
| retro | 55 / 986 | + retro 402 |
| onboarding | 51 / 1029 | + styleguide 787 |

The job prompts are small. The problem is not prose volume. Rules that sit in prose are ignored (a, c, d, f), and prose disagrees with code (below).

### Contradictions and stale prose found

- **Styleguide vs coordinator, on budget raises.**
  - `styleguide.md:13`: "a raise is a decision recorded in the ticket". Workers read it as "write it in the ticket" (AR0379 Decisions line "Worker: github's line budget…"; review AR0285: "Ticket's Decisions line added for the budget raise, consistent with styleguide").
  - `coordinator.md:49`: only `arthur decision answer` writes that line.
  - `worker.md` says nothing either way. This is the root of (e).
- **`worker.md:17` and `review.md:12` (`npm ci`) vs the job prepare.**
  - `projects/src/install.ts:11,28-36` already runs `npm ci` before every job's agent (review-018ff36b log line 1: `install: npm ci`).
  - Agents still ran it again: **223** `npm ci` calls in review sessions and 55 in worker sessions.
- **The `proc://` / `sleep 30` paragraphs vs the job config.**
  - reviewer.md:34, planner.md:53, plan-reviewer.md:27, auditor.md:47 and retro.md:55 teach polling `proc://`.
  - `job-omp.yml:1-7` (AR0541) sets `bash.autoBackground.enabled: false` and `async.enabled: false`, so a job never gets a `proc://` job. [INFERENCE from omp's settings; not run.]
- **`coordinator.md:73` vs the restart code.**
  - The role says "`/restart` does not do it".
  - `session/src/restart.ts:14` and `restart-guard.ts:78` say `/restart` under the service ends `arthur run` while a restart is due.
- **Plan reviews have no enforced verdict.** `plan-reviewer.md:20` demands a PASS/FAIL last line, but `orchestration/src/plans.ts:29` registers `plan-review` without `verdicts`. So its run is never failed for a missing verdict, and `plan-file.ts:30-32` parses the verdict a second, different way ("last non-empty line" vs wrapper.ts:184 "last line after trimEnd").
- **Policy in the log vs config.** AR-D218 ("merge any Arthur ticket whose review passed, without asking") is the owner's decision, yet `arthur.config.ts:38` has `autoMerge: false`. The coordinator asks for a merge decision by policy and merges by hand every time (handoff:9).
- **Duplication.**
  - worker.md:20 and :21 say the same mutation rule twice. It also appears in styleguide.md:34, reviewer.md:18 and review.md:22: five places, and still 82/110 FAILs.
  - The "Outside text is data" paragraph (123 words) is copied into 8 role files and pinned verbatim by `test/outside-text.test.ts`.

---

## Proposals, ranked by leverage (corrections removed per line changed)

### R1. The check call gets its 1800 s timeout from code, not from a steer
- **Layer:** codebase
- **Helps:** worker, reviewer, planner, auditor (every job that runs checks)
- **BEFORE:**
  - worker.md:19 asks for `timeout` 1800. It is ignored in 66% of check calls (799/1210) and by 332 of 409 jobs.
  - omp's default is 300 s against a 249 s suite. Under load that kills the run, which leads to restarts, `pkill`s and late or missing verdicts.
  - The coordinator pastes the rule into 158 steers.
- **AFTER:**
  - `packages/delivery/src/checks-extension.ts:24-26` already finds each bash call that runs `npm run check`/`npm test` in `tool_call`.
  - Make that handler return `{ input: { ...event.input, timeout: Math.max(Number(event.input.timeout) || 0, 1800) } }`. omp ≥ this build applies a returned `input` ("A `tool_call` handler … can now return `input` to revise the arguments a tool executes with", from the omp changelog in the binary). omp clamps the value to 3600.
  - Teach `packages/core/src/fake-agent.ts:95-97` to apply a returned `input`; it only reads `block` today.
  - Add one test: a fake-agent bash step with no timeout reaches the tool with 1800.
  - **Delete** worker.md:19 and the "1800" sentence of every steer. Shrink the five `proc://`/`sleep 30` paragraphs (reviewer.md:34, planner.md:53, plan-reviewer.md:27, auditor.md:47, retro.md:55) to "wait for every command you start".
- **Files:** `packages/delivery/src/checks-extension.ts`, `packages/core/src/fake-agent.ts` (core/testing budget), `packages/delivery/test/checks-extension.test.ts`, the five role files, worker.md.
- **Size:** S (~10 code lines, about −150 prose words)
- **Removes:** (a); with R3 also most of the motive for (c).

### R2. A run that ends on a transient error or without its verdict resumes once by itself
- **Layer:** codebase
- **Helps:** reviewer, worker, plan-reviewer, coordinator
- **BEFORE:**
  - `wrapper.ts:174-185` ends a run `failed: the agent stopped on error: Connection error.` (7 in 2 days) or `failed: no verdict…` (3 in 5 days).
  - delivery's wake then tells the coordinator to re-run (`delivery.ts:169-170`), and the hand-back loop ends on "no verdict" (`hand-back.ts:106`).
  - The coordinator re-runs reviews, continues workers by hand (handoff:26) and pastes the verdict rule into 154 steers.
- **AFTER:**
  - Reuse the budget-resume pattern of `wrapper.ts:149-156`.
  - When `record.stopped()` is `error: Connection error.` (or the run is `aborted`), or the kind has `verdicts` and the last line is not one of them, wait 60 s and run `play(args(<message>))` once with `--continue`.
  - The message for a missing verdict: `Your final message must end with one line, exactly ${verdicts.join(" or ")}, alone. Write your final message again.`
  - Note it in the log; a second failure ends as today.
  - Register `verdicts: ["PASS", "FAIL"]` on `plan-review` (`plans.ts:29`) and let `plan-file.ts` read the verdict as the wrapper does, so there is one verdict rule.
  - **Delete** the steer's verdict sentence. Cut reviewer.md:26 to its first sentence and drop "and a review without one failed and is spawned again".
- **Files:** `packages/core/src/wrapper.ts` (200 lines today: the resume moves into a new `run-resume.ts`), `packages/core/test/limits.test.ts` (verdict cases at :254-271 gain a "resumed once" row), `packages/orchestration/src/plans.ts`, `plan-file.ts`, reviewer.md.
- **Size:** S–M; core budget raise (owner decision).
- **Removes:** (d), (g).

### R3. A job cannot stop another job's processes
- **Layer:** static analysis (a tool-time check)
- **Helps:** worker, reviewer, every job
- **BEFORE:**
  - 63 pkill/killall calls in job sessions. Examples: `pkill -f "node.*--test" ; pkill -f "npm test"; pkill -f "tsc"` (review-eb9a2e1b) and `pkill -f "packages/\*/test/\*\*/\*.test.ts"` (review-0484756b).
  - Jobs run as one user, so these kill other jobs' suites, which then fail and get re-run.
  - AR0484 F2 was deferred. 61 steers carry "never stop another job process", and no role states it.
- **AFTER:**
  - A new core extension `process-guard.ts`, loaded like `env-guard.ts` (`wrapper.ts:84`), refuses a bash call whose command words include `pkill`, `killall`, or `kill` with a `-<pattern>`/`%` operand.
  - Reason given: `refused: a job stops only what it started; kill <pid> of your own process (echo $! when you start it)`.
  - It is a separate file because `worktree-guard.ts` is 186 lines.
  - A stronger, later variant is a PID namespace per job in `job-sandbox.ts`. Landlock signal scoping needs Linux 6.12, and this host runs 6.8.
- **Files:** new `packages/core/src/process-guard.ts`, `wrapper.ts:84` (one word), a test beside `env-guard`'s.
- **Size:** S
- **Removes:** (c).

### R4. Only `arthur decision` writes a Decisions line; a branch that does is refused
- **Layer:** static analysis, plus one prose fix
- **Helps:** worker, reviewer, coordinator
- **BEFORE:**
  - Workers hand-write Decisions lines: 7 reviews flag it, AR0557 this week, 26 steers.
  - `styleguide.md:13` tells them a raise is "recorded in the ticket".
  - Of the 6 runs in the event window that ended blocked on the user, 4 are line limits: 3 package line-budget raises and 1 file over 200 lines. 57 of 335 logged decisions are `kind: budget`.
  - AR0501 (planning) found that a branch can also rewrite `spec/decisions.jsonl` and `spec/build.json` unreviewed.
- **AFTER:**
  - orchestration provides `merge.check` (the hook exists: `merge-command.ts:132-133`, used by onboarding). It refuses a worker branch whose `base..tip` diff touches `spec/decisions.jsonl` or `spec/build.json`, or changes a line under `## Decisions` of any `spec/features/*/ticket.md`.
  - Refusal: `<file>: only arthur decision writes the owner's decisions; name what you need in the final message`.
  - The same function answers in `review-needed` so no review is paid for first.
  - Rewrite styleguide.md:13: "…a raise is the owner's decision: the worker names the package and the exact number in its final message; `arthur decision` records it."
  - Add to worker.md's Never list: "Never write a Decisions line; name the decision you need."
  - This folds in AR0501.
- **Files:** `packages/orchestration/src/` (new `decision-guard.ts`), its test, `.agents/arthur/criteria/styleguide.md`, worker.md.
- **Size:** S
- **Removes:** (e); the "budget decision id" lines of review steers.

### R5. One verification skill, read by worker and reviewer, and the worker sees the FAIL list
- **Layer:** prose (the verification skill), plus a 2-line registration
- **Helps:** worker, reviewer
- **BEFORE:**
  - How to prove a change is spread over worker.md:17-23 (7 bullets, :20/:21 duplicates), reviewer.md:17-19, review.md:12,22, styleguide.md:34-35.
  - Nowhere does it say how to run one test file, what to do with a failing timing test, or what to report.
  - The worker is judged by review.md's "FAIL when any one holds", but its assembled prompt holds only worker + styleguide + the findings format.
  - 82/110 FAILs are uncaught mutations.
- **AFTER:**
  - Add `.agents/arthur/criteria/verify.md` (text in the Appendix).
  - The core registers the worker with `criteria: ["styleguide", "verify"]` (`jobs.ts:198`) and delivery the reviewer with `["styleguide", "review", "verify"]` (`delivery.ts:51`).
  - delivery adds review.md to the worker through its `prompt` provider (the pattern of `findings.ts:26`).
  - **Delete** worker.md:17, :19, :20-21 (one bullet left: "Prove the change with verify.md"), reviewer.md:17-18 and review.md:12's `npm ci`.
- **Files:** new `.agents/arthur/criteria/verify.md`, `packages/core/src/jobs.ts`, `packages/delivery/src/delivery.ts`, worker.md, reviewer.md, review.md; `arthur init`'s criteria skeleton (projects) gets a `verify.md` heading.
- **Size:** S
- **Removes:** (b) at the prose layer until R9 lands, part of (f), and the rest of the steer boilerplate.

### R6. The coordinator's standing memory moves into config and code
- **Layer:** codebase/config
- **Helps:** coordinator
- **BEFORE:**
  - The handoff carries policy ids (AR-D218 merge-on-PASS, AR-D63, AR-D233), the restart unit counter (`arthur-day-restart-47`) and the merge → restart → spawn order (handoff:9, 22, 29).
  - The coordinator runs `systemd-run … restart arthur.service` by hand after every code merge.
  - coordinator.md:73 contradicts the code on `/restart`.
- **AFTER:**
  - (1) `arthur.config.ts:38` `autoMerge: true` for the arthur project. That is AR-D218's content, already the owner's word. The PASS wake then says `arthur merge --auto` (`delivery.ts:163`), with held paths and CI still enforced by `auto-merge.ts`.
  - (2) The session plugin restarts `arthur run` itself when `restartDue()` (`restart-guard.ts:40`) is due and no job runs, through the existing restart path (`restart.ts`, the one `/restart` uses), on `job-ended` and after `arthur merge`. Not at night, which the fresh start covers.
  - (3) coordinator.md:73 becomes one line: "A due restart happens by itself once no job runs; spawns wait for it."
- **Files:** `arthur.config.ts` (owner), `packages/session/src/restart.ts`, `restart-guard.ts`, a session test, coordinator.md.
- **Size:** S (config) + S–M (restart)
- **Removes:** (i); the per-merge policy decision.

### R7. `arthur mutate`: the diff's conditions mutated and run against their tests
- **Layer:** static analysis
- **Helps:** worker (before it ends), reviewer (instead of hand mutations)
- **BEFORE:**
  - Five prose places ask for "a test that fails when the behavior is removed".
  - 82 of 110 FAIL reviews still name a surviving mutation, and each FAIL costs a hand-back round (AR0557: 2 rounds, $9.29 + $2.38).
  - The reviewer finds mutations by hand, which is slow and uneven.
- **AFTER:**
  - Add a dev command in the develop plugin, `arthur mutate [<base>]`.
  - For each added or changed line in `git diff -U0 <base>..HEAD -- 'packages/*/src/*.ts'` holding a condition, it applies one mutation at a time in the job's worktree:
    - `if (x)` → `if (!(x))`
    - `<` ↔ `<=`
    - `===` ↔ `!==`
    - a `throw`/refusal `return` line removed
  - After each mutation it runs only the test files of that package that import the file (`node --import @arthur/core/testing --test <files>`), restores the file with `git checkout -- <file>`, and prints `<file>:<line> <mutation>: survived|caught`. It exits 1 on any survivor.
  - Plain functions, no dependency.
  - verify.md (R5) runs it, and the worker's final message pastes its survivors.
- **Files:** new `packages/develop/src/mutate-command.ts` (+ doc page, test). The develop line budget needs a raise (owner decision).
- **Size:** M (~150–190 lines)
- **Removes:** (f), and most of the 82/110 FAIL cause.
- **Styleguide:** within it (no runtime dep, one file, plain functions). Not "abstraction before the second example": the need is shown by 82 FAILs.

### R8. Outcome and review notes are written by code from fixed final-message sections
- **Layer:** codebase
- **Helps:** coordinator, worker, reviewer
- **BEFORE:**
  - `merge-outcome.ts:55` writes commit subjects. after-merge.md:5-7 has the coordinator rewrite "What went in" per file and copy the reviews' notes into findings.md by hand: 35 settle scripts in /tmp.
  - Eval `delivery/review-pass` scores 0/3.
  - Reviewers' sections vary: of 607 reviews, 264 have a "findings" heading and only 126 a "notes" heading.
- **AFTER:**
  - The worker's final message gets a fixed `## What went in` block: one `- <path>: <what it does now>` line per file of `git diff --name-only <base>..HEAD`, covering the whole branch.
  - The reviewer's gets fixed `## Findings` / `## Notes` / `## Checks run` headings, as the planner already has fixed sections (planner.md:24-46; all 12 plans comply).
  - `settleTicket` copies the worker's block (`host.jobs.result(job.id)`) and lists any changed file the block does not name as `- <path>: not described`.
  - `review-file.ts` appends each `## Notes` item of a PASS review as an open `F<n>` entry, which `findings.onMerge` already settles (`findings/src/on-merge.ts`).
  - after-merge.md drops steps 1-2.
  - These messages are agent-written, so this is no "parser for Markdown the human owns" (styleguide.md:42).
- **Files:** `packages/delivery/src/merge-outcome.ts`, `review-file.ts`, worker.md (Final message), reviewer.md (Final message), `packages/delivery/roles/coordinator/after-merge.md`, the `review-pass` eval stub.
- **Size:** M
- **Removes:** (h).

### R9. One `until` in the test kit; local copies refused by the structure test
- **Layer:** codebase + static analysis
- **Helps:** worker, reviewer (and CI)
- **BEFORE:**
  - **33** test files define their own `async function until`. 15 wait `20_000` ms and 2 wait `10_000`, each against a real clock (`limits.test.ts:37-43`).
  - Under parallel jobs these time out: "timed out waiting for the tool's process" (limits.test.ts:135), and ":153 and :200" in reviews.
  - The result: 10 flaky-test tickets, 52 steers, and reviewers re-running files by hand.
- **AFTER:**
  - `@arthur/core/testing` exports `until(what, predicate, { deadlineMs })`. The default deadline is generous (for example 120 s), because a test that passes returns at once.
  - `test/structure.test.ts` fails on a test file that declares its own `until`/poll loop (`Date.now() - start <`).
  - Migrate the 33 copies; agents copy what exists.
  - The flake rule moves from the steer to verify.md: rerun a failing file the diff does not touch, alone.
- **Files:** `packages/core/src/testing.ts` (core/testing budget), `test/structure.test.ts`, 33 test files.
- **Size:** M (mostly deletion)
- **Removes:** (b).

### R10. Corrections become data, and the retro proposes the highest layer that holds
- **Layer:** codebase (event) + prose (retro)
- **Helps:** retro, coordinator, owner
- **BEFORE:**
  - `arthur steer`/`continue` emit no event. 0 of 4473 events record a steer, and `steer/done/` is deleted at prune: only 3 of 606 records remain.
  - The corrections that recur most (a-f above) are invisible to the retro, which the retro criteria (criteria/retro.md:13) say it should read ("the coordinator's own corrections").
  - The retro is forbidden to propose code: retro.md:54 "Never propose a change to code", criteria/retro.md:18-19, 24. So every pattern becomes another sentence, as with worker.md:19.
  - Findings that would fix a class are deferred by policy (AR-D233; AR0484 F2 pkill).
- **AFTER:**
  - (1) Core emits `job-steered` `{ id, kind, text }` on each steer and continue, into the existing event log, so there is no new store.
  - (2) The retro's context (`manage/src/retro.ts` prompt provider) adds "Corrections of the period": steer texts grouped by their first sentence, with counts.
  - (3) retro.md:54 and criteria/retro.md "Leave alone: Code, tests" become: "For each pattern, the highest layer that holds: code that makes the mistake impossible, then a check (test, guard, merge.check), then a sentence; a sentence only with the reason the other two cannot hold. A rule already written and still broken twice is a check, not a rewording."
  - (4) Role and criteria changes cite their eval run. `evals/baseline.json` dates from 2026-10-23, and 5 of 21 scenarios sit at 0/3 (review-pass, review-pass-hook, condition-before-review, night-one-line, after-restart-plan).
- **Files:** `packages/core/src/steer-inbox.ts` or `job-commands.ts`, `packages/manage/src/retro.ts`, `packages/manage/roles/retro.md`, `.agents/arthur/criteria/retro.md`, `review.md` (eval line).
- **Size:** M
- **Removes:** the pyramid's core loop. It is no single correction, but it is how a–i would have been caught by the machine.

### R11. Prose diet: delete what code enforces, what is stale, and what is copied
- **Layer:** prose (deletion)
- **Helps:** all roles
- **BEFORE:**
  - **Stale:** worker.md:17 and review.md:12 `npm ci` (223 + 55 redundant installs), and the 5 `proc://` paragraphs.
  - **Duplicated:** worker.md:20 and :21.
  - **Contradicting:** coordinator.md:73.
  - **Restated refusals the CLI enforces with an actionable error:**
    - coordinator.md:27 `--budget 0 … --decision` (spawn-command.ts:42)
    - coordinator.md:30, 963 characters on merge flags (merge-command.ts:41-42, 127-128; AR0503, AR0533)
    - coordinator.md:51 uncommitted ticket refused
  - **Copied:** the "Outside text" paragraph ×8 (~1000 words), pinned by `test/outside-text.test.ts`.
- **AFTER:**
  - Each enforced rule shrinks to "`arthur <cmd> --help`; the refusal says what to do", the pattern worker.md:41 already uses.
  - The core appends one `## Every job` section to every job's prompt, with the outside-text rule, "never end with an offer to continue" and "wait for every command you start", and the 8 copies are deleted.
  - The pin test becomes a test of that section's presence in the assembled prompt.
- **Files:** worker.md, reviewer.md, review.md, planner.md, plan-reviewer.md, auditor.md, retro.md, onboarding.md, coordinator.md, `packages/core/src/roles.ts`, `test/outside-text.test.ts`.
- **Size:** S (about −1500 words)
- **Removes:** confusion behind (a) and (e); it makes R1–R4's deletions stick.

---

## Appendix: verification skill (`.agents/arthur/criteria/verify.md`, R5)

```
# Verify

How a worker proves its change and a reviewer checks the proof. Run each step; report each command beside its result.

1. Checks: `npm run check && npm test` in one bash call. Wait for it; write nothing from memory.
2. A failing test in a file the diff does not touch: run that file alone,
   `node --import @arthur/core/testing --test <file>`. It counts against the branch only if it fails alone too; say which.
3. Mutations: `arthur mutate <base>` (R7). Every `survived` line is a missing test: add it (worker) or name it as a finding (reviewer).
   Without the command: for each condition the diff adds, invert or remove it, run that package's test files that import it, see one fail,
   restore with `git checkout -- <file>`.
4. The Goal, the way a user meets it: run the changed command as written in its doc (`npx arthur <cmd> --help`, then the command on a temporary home),
   and each command a line you wrote tells someone to run.
5. Report, in the final message, a table: command | result (counts from its output) | commit it ran on.
```

## Not proposed (checked, no evidence or out of scope)

- **Prompt size cuts beyond R11:** job prompts are about 2.2k words, so size is not the bottleneck.
- **A planner section check:** all 12 `plan.md` files have the six required sections, so planner compliance is fine.
- **`Blocked:` parsing:** `job-state.ts:49-52` is consistent with worker.md:35 and tested (`job-state.test.ts:58-60`).
