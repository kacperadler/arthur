# AR0693 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. herdr's start-up pass test times out in the full suite on a loaded machine, and its leftover queue fails the next test

- Kind: test
- Found by: 2026-11-11-worker-07795aec (worker), 2026-11-11
- Where: `packages/herdr/test/herdr.test.ts:152`, `packages/herdr/test/herdr.test.ts:169`
- What: In `npm test` on a 3-CPU host with a load average of about 15, `before start nothing reaches herdr; …` failed three runs in a row with `waited 20 s for the start-up pass`. The start-up pass makes about 20 herdr calls one after another, and the fake `herdr` starts a new node process for each call, so under that load the pass takes longer than `until`'s 20 s. That test's plugin queue keeps running after it fails, and once `process.env.PATH` points at the next test's fake, it sends a `pane report-agent … --state working` call there, so `a prune in a process that never started …` fails too (`no workspace, nothing made`). Run alone, `node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts` passes all 11 tests. The branch does not touch herdr. Its failure keeps the review gate shut.
- Suggestion: stop the plugin (or wait for its queue to drain) in a `t.after` of the herdr test's `load`, so one test's leftover calls never reach the next test's fake. Give the start-up pass's `until` a wait sized for its number of calls, or make the fake answer faster (one long-lived process instead of a node start per call). The plugin's behavior stays as it is.
- Status: fixed in eca9687c (AR0692: the fake herdr no longer loads the test kit)

## F2. `--auto` reads the Scope as main holds it at merge time, not as the owner approved it

- Kind: security
- Found by: 2026-11-11-review-7747a3c1 (review), noted by 2026-11-11-worker-07795aec (worker), 2026-11-11
- Where: `packages/delivery/src/auto-merge.ts:52`
- What: `autoRefusal` reads the ticket's `## Scope` from main's ticket.md at `before`. `spec/features/*/ticket.md` is not on the always-review list, so a line added to a ticket's Scope after the owner approved it also lets a role, criteria or vision file of that ticket's next branch merge without him. Such a line can come from a commit on main by the coordinator, or from an earlier merged branch. The ticket's status is not checked either. A worker's own branch cannot do it: orchestration's `merge.check` refuses a worker branch that changes a ticket.md, and the branch's own copy is never read.
- Suggestion: read the Scope as it stood at the approval, for example from the commit that recorded the plan decision (AR-D603), or refuse when ticket.md's Scope changed on main after that commit. How an approval is recorded is the owner's call. Out of scope: anything about the owner's merge words.
- Status: deferred (client summary)

## F3. `arthur review-needed` matches the always-review list against paths git quotes

- Kind: security
- Found by: 2026-11-11-worker-07795aec (worker), 2026-11-11
- Where: `packages/delivery/src/review-needed.ts:61`
- What: `decide` reads the changed files from `git diff --numstat` without `-z`. With git's default `core.quotePath`, a non-ASCII path such as `.github/workflows/ż.yml` comes out quoted (`".github/workflows/\305\274.yml"`) and misses its glob. `arthur merge --auto` had the same gap, which this branch fixed with `-z`: before the fix, the AR0693 test showed a branch adding `.github/workflows/ż.yml` merging. [INFERENCE] I did not run `review-needed` on such a path. If its later rules (docs only, size, checks) let the branch through, it answers `no review`, and `--auto` takes that as its PASS.
- Suggestion: `git diff --numstat -z` in `decide`, parsed per NUL-separated record, plus a test with a non-ASCII held path. The rest of `decide` stays as it is.
- Status: deferred (client summary)

## F4. A project's `prompts.criteriaDir` outside `.agents/` and not named `criteria/` is not held by `--auto` or `review-needed`

- Kind: security
- Found by: 2026-11-11-worker-07795aec (worker), 2026-11-12
- Where: `packages/delivery/src/auto-merge.ts:42`, `packages/delivery/src/delivery-options.ts:17`
- What: `autoRefusal`'s `rules` give a project's `prompts.rolesDir` its own held rule ("a role") and `prompts.vision` one ("the vision"), but give `prompts.criteriaDir` none. The always-review list reaches a criteria file only through `**/criteria/**` or `.agents/**`. So a project with `prompts: { criteriaDir: ".ops/rules" }` gets a branch that rewrites its review criteria merged by `--auto` with no Scope naming it, and `arthur review-needed` can answer `no review` for it. [INFERENCE] I read this from the lines above and did not run it. A criteriaDir under `.agents/` (the default, or the `.agents/ops/rules` of the AR0693 test) is held.
- Suggestion: add a `criteria` rule to `rules`, beside the role rule, holding `**/criteria/**` and the project's `prompts.criteriaDir` folder. Have `delivery.alwaysReview` and `review-needed` hold the project's `prompts` folders too, each with a test. AR0693's Scope exception stays as it is.
- Status: deferred (client summary)
