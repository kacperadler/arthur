# Audit: the coordinator's manual work after a job ends (prefix C)

Scope: packages/orchestration, delivery, session, manage, github (CI wake), core wrapper (job endings), the handoff `.arthur/session/handoff.md` and `spec/decisions.jsonl`. Read-only. Counts come from `spec/decisions.jsonl`, `.arthur/events.jsonl`, the coordinator's omp session logs (`~/.omp/agent/sessions/-arthur/*.jsonl`, bash tool calls), `git log` on main, and the job records still on disk.

## What the coordinator did by hand on 2026-10-29

| Manual step | Today | All-time / note | Source |
|---|---|---|---|
| Merge decision asked, then answered by policy AR-D218 in the same second | 20 of 20 merge asks | 104 merge asks; 68 by policy (45 AR-D218, 23 AR-D74) | decisions.jsonl (ask and answer timestamps equal, e.g. AR-D334 17:51:36) |
| `spec:` commits on main (review filed, merge decision, settled, budget…) | 114, for 17 merges (6.7 per merge) | — | `git log --first-parent --since=2026-10-29 main` |
| `git push` / `git commit` in coordinator bash calls | 74 / 89 | 333 / 722 since 10-25 | session logs |
| `arthur ticket file` / `arthur prune` / `arthur merge` | 18 / 50 / 22 | 166 / 417 / 212 | session logs |
| Outcome "What went in" rewritten by a python script | 14 runs | 418 of 418 outcome.md rewritten; 35 `/tmp/settle*.py` scripts | outcome.md scan, `/tmp` |
| Restart scheduled with `systemd-run … arthur-day-restart-N` | 13 | 61 since 10-26; next unit 47 (handoff.md:29) | session logs |
| CI-finished wakes handled | 39, all `success` (36 on main) | 206 | events.jsonl `github/coordinator-message` |
| Runs killed by "Connection error", re-run or continued by hand | 6 (4 reviews, 2 workers) | 7; lost review spend $3.30 | events.jsonl, `.arthur/delivery/reviews/*.json` |
| Steers and continues sent | 44 steers, 16 continues | 218 steers since 10-25 | session logs |
| …of which carry the "1800 seconds" clause | 41 | 36 sent after AR0541 merged (01:18Z), 34 to workers | session logs |
| …"limits.test.ts alone" / "no pkill" / "PASS or FAIL alone" / "Decisions" | 27 / 28 / 28 / 8 | — | session logs |
| Budget decisions asked | 13 (2 by policy AR-D63) | 55 | decisions.jsonl |

Decision shapes overall (335 asks): merge 104, question 94, budget 55, review 38, job 30, plan 10, class 4. Answers: 219 owner words, 85 by policy (all merge or budget), 17 by recommendation (AR-D271).

Note for every code proposal: each target package sits at its line budget (`test/structure.test.ts`: delivery 1686/1686, orchestration 2434/2434, session 879/880). So each change needs a recorded budget raise. `wrapper.ts`, `merge-command.ts` and `decision-log.ts` are at the 200-line cap, so a change there needs a split. No proposal adds a dependency, an option pack or a class hierarchy.

---

## C1. A CI run that passed wakes nobody
- **Layer:** codebase. **Helps:** coordinator.
- **BEFORE:** `packages/github/src/github.ts:92-99` sends a `coordinator-message` for every finished run, success included. Today brought 39 such wakes, all `success`, 36 of them on main. Each one costs a coordinator turn on the most expensive model, to read and drop a line that asks for nothing. A plain merge asks CI itself (`auto-merge.ts:49-77`, `ciRefusal`). An `--auto` wait has its own wake (`delivery.ciEnded`, github.ts:89). So no step uses the success wake.
- **AFTER:** in github.ts:92, also `continue` when `run.conclusion === "success"`. The `ci-finished` event is still emitted for the log. The coordinator.md:15 sentence on `[Arthur: github]` then covers failures only. Update `packages/github/docs/github.md`.
- **Files:** `packages/github/src/github.ts`, its test, `docs/github.md`, `packages/orchestration/roles/coordinator.md:15`.
- **Size:** S (1 condition, 1 test row).
- **Removes:** about 39 wakes a day (206 so far). Part of (h)/(i): less noise between job ends.

## C2. A run survives a provider drop or a missing verdict without the coordinator
- **Layer:** codebase. **Helps:** worker, reviewer, coordinator.
- **BEFORE:** 7 runs ended `failed: the agent stopped on error: Connection error.`, 6 of them today. Three died within 15 s at 08:40Z, so this was an outage. The coordinator's own turn reported "Retry budget exhausted after 10 retries: Connection error" at 08:50 and 13:07. The coordinator then re-runs reviews or continues workers by hand (handoff.md:26), and pays for the work again (the five lost reviews cost $3.30). A review whose last line is not `PASS`/`FAIL` alone ends `failed: no verdict` (wrapper.ts:184; 3 so far), and delivery's wake asks for a full new review (`delivery.ts:170`). To prevent that, the coordinator adds "the last line of your final message must be PASS or FAIL alone" to reviews by hand: 28 times today, 37 on 10-28. The wrapper already has the right shape for a one-time resume: `resumeOnBudget` at wrapper.ts:149-156 continues the same session once with `--continue`.
- **AFTER:** (1) In `packages/core/src/job-omp.yml` (already the per-job omp settings, AR0541), raise omp's retry window for jobs. The omp binary has `retry.maxRetries`, `retry.baseDelayMs` and `retry.maxDelayMs` [INFERENCE: key names from the binary's strings; their meaning is not verified]. Example: `retry: { maxRetries: 30, maxDelayMs: 120000 }`, so a blip of tens of minutes is absorbed inside the run. (2) In the wrapper, resume once, as for the budget, when the run's ending is recoverable. That means `record.stopped()` is a transient provider error (`Connection error`, overloaded, 5xx), or a kind with `verdicts` finished without one. The resume message is "The provider connection dropped; go on where you stopped." or "Your final message's last line must be exactly one of PASS/FAIL, alone; restate it." Only a second failure reaches `job-ended`. Move the reason ladder (wrapper.ts:174-185) into its own file to stay under 200 lines.
- **Files:** `packages/core/src/job-omp.yml`, `packages/core/src/wrapper.ts` plus a new `wrapper-ending.ts` (split), `packages/core/test/wrapper.test.ts` (the fake agent already has `stopReason: "error"`, wrapper.test.ts:180), `docs/commands/spawn.md:85`, `delivery.ts:170` wording.
- **Size:** S (config) + M (resume and split). Core budget raise of about 15 lines.
- **Removes:** (g) and (d); handoff.md:26.

## C3. Arthur restarts itself once a restart is due and no job runs
- **Layer:** codebase. **Helps:** coordinator.
- **BEFORE:** after any merge that changes code, `restart-guard.ts:69-73` refuses every spawn and continue, and its context line (`:78`) tells the coordinator to run `systemctl --user restart arthur` "once no job runs". The coordinator cannot restart its own service in the middle of a turn. So it schedules `systemd-run --user --on-active=10 --unit=arthur-day-restart-N …`, keeps the unit number and the merge→restart→spawn order in its handoff (handoff.md:9, :29), and did this 13 times today (61 since 10-26). This bypasses the request path, which has a side effect. `restart.ts:145-170` sends the `Restarted.` notice, with the after-restart steps and the Health lines, only after `restart()` wrote `restarted.json`. Since 10-28 there has been no `Restarted.` notice at all (14 on 10-25..27), although the coordinator came up 32 times. So `.arthur/session/after-restart.md` and the health lines silently stopped reaching anyone.
- **AFTER:** in the `restarts()` tick (`restart.ts:172-190`), when `due(host)` names commits, `host.jobs.running()` is empty, no request is pending and `servicePid(host.folder) === process.pid`, write the same `Request` that `/restart` writes (`restart.ts:67`): `{ then: "restart", slot: "due", run: true, waitSeconds: 120 }`. The coordinator writes its handoff, `arthur run` ends, and the service starts it on the new code, using the existing path. Change the context line (`restart-guard.ts:78`) to "arthur run restarts itself once no job runs". Delete the restart sentence of coordinator.md:73 that asks the owner.
- **Files:** `packages/session/src/restart.ts`, `restart-guard.ts:78`, `packages/session/test/restart.test.ts`, `docs/session.md`, coordinator.md:73.
- **Size:** S (about 8 lines). Session budget raise of about 10 lines.
- **Removes:** (i): the unit counter, systemd-run and the restart order in the handoff. Also brings back the lost `Restarted.`/Health notice.

## C4. The worker writes "What went in"; the merge keeps it
- **Layer:** codebase (plus one prose line each for worker and reviewer). **Helps:** coordinator, worker, reviewer.
- **BEFORE:** `merge-outcome.ts:55` fills `## What went in` with commit subjects and prints "rewrite What went in from the commit subjects listed there" (`:62`). after-merge.md:5 makes that the coordinator's job. All 418 outcome.md files were rewritten by hand, through 35 throwaway scripts such as `/tmp/settle557.py` (per-file lines written from memory of the diff). The worker, who knows each file, writes nothing usable: 4 non-empty commit-body lines in 230 commits since 10-28. The template exists already (`packages/core/templates/outcome.md:8-10`: "- `path/to/file.ts`: what it does now.").
- **AFTER:** the worker role asks for one more ticket file, as it already does for `findings.md`: `outcome.md` holding only `## What went in`, one line per changed file, updated in every round. `settleTicket` reads the branch's `## What went in` section (written by the worker, not the human, so styleguide:42 does not apply) and keeps it in place of the subjects. With none, it falls back to today's subjects and line. One review-criteria line: "What went in names every changed file and matches the diff."
- **Files:** `packages/delivery/src/merge-outcome.ts`, `packages/delivery/test/merge.test.ts:137-152`, `packages/core/roles/worker.md`, `.agents/arthur/criteria/review.md`, after-merge.md:5, `docs/commands/merge.md:51`.
- **Size:** S/M (about 10 lines of code).
- **Removes:** (h), first half: 14 script runs today, one per merge.

## C5. `arthur merge` commits, pushes and prunes its own paperwork
- **Layer:** codebase. **Helps:** coordinator.
- **BEFORE:** the merge "commits nothing past the merge and prunes nothing" (`merge-command.ts:16-21`, eval stub "nothing committed but the merge, nothing pushed or pruned"). It writes outcome.md, findings.md, the board and CHANGELOG.md and leaves them for the coordinator (after-merge.md:9: commit together, `git push`, `arthur prune`). Today that came to 114 `spec:` commits for 17 merges and 74 pushes. github.push already pushes main right after the merge, so the coordinator pushes a second time.
- **AFTER:** at the end of `settleTicket`, after the changelog, commit the ticket folder, `spec/build.json` and `CHANGELOG.md` as `spec: <id> merged` before `github.push` runs, so one push carries both. The prune of the merged job and its reviews is landing in AR0555 (in review now, review-2 018ff36b). After-merge step 4 then shrinks to "tell the owner". This depends on C4 and C7: until they land, the coordinator still edits outcome.md and findings.md after the commit.
- **Files:** `packages/delivery/src/merge-outcome.ts` (81 lines, has room; merge-command.ts is at 200), `merge.test.ts`, the merge eval stubs (`packages/delivery/evals/merge/scenario.json`, `review-pass`, `packages/session/evals/*`), after-merge.md:9, `docs/commands/merge.md`.
- **Size:** S/M.
- **Removes:** (h), second half: about 5 spec commits and 1 push per merge.

## C6. A PASS merges by itself under the owner's recorded merge policy
- **Layer:** codebase. **Helps:** coordinator.
- **BEFORE:** the owner said on 2026-10-28 (AR-D218): "IN THE FUTURE IF THERE IS SOMETHING TO MERGE AND YOU CAN MERGE IT, JUST MERGE IT, DO NOT ASK (in arthur project)". Yet `arthur.config.ts` keeps `autoMerge: false`. For every PASS the coordinator still files the review (`delivery.ts:161` tells it to, while the merge files unfiled reviews anyway, `merge-outcome.ts:32-38`), commits, prunes the review, runs `decision ask --kind merge` (answered by policy in the same second: 20 of 20 today), commits the log and runs `arthur merge`. That is 6-8 tool calls per PASS. The code for a merge without the coordinator already exists: `--auto` (`auto-merge.ts`) with CI waits (`ci-wait.ts`). A FAIL already runs on its own inside `arthur run` (hand-back.ts). Of the 87 merges since 10-26, 69 (79%) touch no held path, so `--auto` would have let them in. The other 18 hit `merge-command.ts` 6, `package-lock.json` 3, roles 3, `auto-merge.ts` 2, and others.
- **AFTER:** (1) With the owner's word recorded, `autoMerge: true` for project arthur. (2) In delivery's `job-ended` for a review PASS on a project with `autoMerge`, queue `merge --auto` inside `arthur run`, as the hand-back queues its steps. A refusal (held path, CI not passed yet, a conflict) wakes the coordinator with the refusal, as today. A success wakes it once with "merged <id>". The PASS wake drops its "File it…" sentence. Cutover: a merge question no longer gets asked for the 79% path, and AR-D218 stays the owner's word for the held 21%.
- **Files:** new `packages/delivery/src/pass-forward.ts` (hand-back's shape), `delivery.ts` (wake text `:160-164`), `arthur.config.ts` (owner's decision), `docs/commands/review.md`, `docs/commands/merge.md`, coordinator.md:29-30.
- **Size:** M (about 60 lines). Delivery budget raise.
- **Removes:** (h) and (i): about 15 manual merges a day, their decision rows and spec commits, and the policy id in the handoff.

## C7. The reviews' notes reach findings.md through the merge, not by hand
- **Layer:** codebase (plus one reviewer prose line). **Helps:** coordinator, reviewer.
- **BEFORE:** after-merge.md:6-7 has the coordinator copy every non-blocking note from the reviews into findings.md and settle it in the project's mode. For arthur that is `summary`, since AR-D233 (`arthur.config.ts`: `findings({ mode: { arthur: "summary" } })`). The coordinator then adds `- Deferred (client summary):` lines under Left open. `/tmp/settle554.py` appends F2/F3 by hand. The findings plugin already settles open entries at the merge (`findings/src/on-merge.ts:23-24`), but it never sees the notes. Parsing them today would be fragile: 186 filed reviews use five headings (`## Notes` 88, `## Notes (not blocking)` 70, `(non-blocking)` 21, `(do not block)` 4, `(do not block the merge)` 3), because reviewer.md:24 only says "Then notes that do not block the merge."
- **AFTER:** reviewer.md:24 fixes the format: `## Notes`, one `- <file:line>: <title>. <what>` bullet each. `settleTicket` takes the notes of the PASS review on the merged tip and passes them in the `findings.onMerge` request (`{ project, ticket, path, root, notes }`). The findings plugin, which owns the format, appends them as entries (`Found by: <review id>`) and settles them in the mode, so summary gives `deferred (client summary)` and its Left open lines. Delivery never writes findings.md.
- **Files:** `packages/delivery/roles/reviewer.md:24`, `packages/delivery/src/merge-outcome.ts:72-81`, `packages/findings/src/on-merge.ts`, `packages/findings/test/on-merge.test.ts`, `packages/findings/docs/findings.md:27-33`, after-merge.md:6-8.
- **Size:** M (delivery about 15 lines, findings about 25).
- **Removes:** (h), the settling half: every finding the coordinator settles by hand under AR-D233.

## C8. A branch cannot write the ticket's paperwork
- **Layer:** codebase. **Helps:** worker, reviewer, coordinator.
- **BEFORE:** 18 of the 261 branches merged since 10-20 changed a `ticket.md`. Almost every added line is a Decisions line, mostly a budget raise: "Worker (the task asks to record any raise): core line budget 6073->6081" (AR0394), "Worker: github's line budget 635 to 647" (AR0379). AR0557 did it again this week: its review-1.md:23 says "The branch adds two lines under the ticket's Decisions… `ticket.md` will conflict". Only `arthur decision answer` may write those lines (coordinator.md:49). So the coordinator steers "Never write a line under the ticket Decisions yourself" (8 times today). AR0501 (planning) already found that a branch can also rewrite `spec/decisions.jsonl` and `spec/build.json`, and proposed a `merge.check`.
- **AFTER:** one `merge.check` provider (orchestration, which owns the decision log). It refuses a worker branch whose diff against main changes `spec/features/*/ticket.md`, `spec/decisions.jsonl` or `spec/build.json`, with the message "only arthur decision and arthur ticket write these on main; name the decision you need in your final message". The check is by path only, with no Markdown parsing, so styleguide:42 holds. Put the same paths on the always-review list (`delivery-options.ts:17`). Worker role: one sentence on where a needed decision goes. Closes AR0501 too.
- **Files:** `packages/orchestration/src/` (new small `paper-check.ts`, `orchestration.ts` wiring), `delivery-options.ts:17`, `packages/core/roles/worker.md`, tests.
- **Size:** S (about 25 lines).
- **Removes:** (e), plus AR0501's forged-decision path.

## C9. A job question answered by policy continues the job itself; budget raises go through it
- **Layer:** codebase. **Helps:** coordinator, worker.
- **BEFORE:** a blocked job's question is recorded by itself and can be answered by a class (`decision-hooks.ts:22-30`, `blocked-notice.ts:61`). But even then the wake tells the coordinator to "Act on it… arthur continue <job> '<that decision>'" (`decision-hooks.ts:64`), so a policy answer still costs a coordinator turn. Budget raises are the main such question: 55 budget asks so far (13 today), and 4 workers blocked on "May the core line budget go from 6414 to 6440…". The coordinator also keeps the current budgets by hand (handoff.md:28) and tells reviewers the budget decision id by steer (handoff.md:9). The owner made it a standing rule on 2026-10-25 (AR-D29: "in the future if this is necessary… do it by yourself"), yet coordinator.md:49 still makes every raise "his decision too".
- **AFTER:** when `askOfJob` returns a policy answer, orchestration continues the job with the decided line (`host.jobs.continue`, as `hand-back.ts:145`), and the wake says "continued by policy (<class>)". Worker role: "a line-budget raise you need: end with `Blocked:` naming the package and both numbers" (this is also C8's route). With the owner's approval of a `job` class matching "line budget" (backed by AR-D29 and AR-D287/AR-D291/…), a raise becomes recorded, answered and resumed without the coordinator, and the reviewer finds the id in the log.
- **Files:** `packages/orchestration/src/blocked-notice.ts` and `decision-hooks.ts:64`, their tests, coordinator.md:49, `packages/core/roles/worker.md`, `docs/commands/decision.md`.
- **Size:** S/M (about 15 lines).
- **Removes:** the 13 budget asks a day and handoff.md:28. Part of (i) and (e).

## C10. Retire the standing steers: the role is the default steer
- **Layer:** prose (deletion), with each clause moved to its higher layer. **Helps:** worker, reviewer, coordinator.
- **BEFORE:** handoff.md:24 holds a fixed review steer, and the coordinator sent 44 steers today. Clause by clause:
  - (a) "1800 seconds, wait": the code already holds it. `job-omp.yml` sets `bash.autoBackground.enabled: false` (AR0541, merged 01:18Z), and worker.md:19 says so. Yet 36 steers with that clause went out after the merge, 34 of them to workers. reviewer.md and `.agents/arthur/criteria/review.md` do not say it.
  - (b) limits.test.ts flake: 27 today. Belongs in static analysis: make the timing tests deterministic (ToolingAudit's area).
  - (c) "no pkill -f": 28 today. Code: the bash command guard that already parses each job command (`worktree-guard.ts`/shell words) refuses `pkill`/`killall` naming no pid of the job's own. Landlock's signal scope needs ABI 6 (Linux 6.12); this host runs 6.8.
  - (d) verdict line: covered by C2.
  - (e) Decisions: covered by C8.
  - (f) "a test that fails when its line is removed": already worker.md:20-21. The steer repeats the role.
- **AFTER:** add the one missing reviewer line, (a), to reviewer.md. Land the (c) guard and C2/C8. Delete handoff.md:24 and the "steer text below" step of handoff.md:9. From then on a steer carries only what is new for that job.
- **Files:** `packages/delivery/roles/reviewer.md`, `packages/core/src/worktree-guard.ts` (or the shell-words module it uses) for (c), the handoff.
- **Size:** S (prose), plus S/M for the pkill guard.
- **Removes:** (a), (b), (c), (d), (f) as steers: about 44 a day.

---

## Order
C1, C2 and C3 are independent and smallest; land them first. Then C4 and C7, then C5, which depends on both. C6 comes after C5 (an automatic merge should leave nothing to commit by hand). C8 before C9 (C9 is the route C8 points workers to). C10 last, as the clean-up once its code landed.

Throwaway scripts used for the counts (outside the repo): `/tmp/coordaudit_count.py`, `/tmp/coordaudit_held.mjs`.
