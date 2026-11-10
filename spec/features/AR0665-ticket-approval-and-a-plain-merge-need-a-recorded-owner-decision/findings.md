# AR0665 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Delivery's wakes still name a plain `arthur merge <job>` as the owner's merge

- Kind: ux
- Found by: 2026-11-10-worker-1ca8d870 (worker), 2026-11-10
- Where: `packages/delivery/src/auto-merge.ts:30`, `packages/delivery/src/auto-merge.ts:48`, `packages/delivery/src/ci-wait.ts:87`, `packages/delivery/src/pass-forward.ts:83`
- What: these refusals and wakes end `its merge waits for the owner: arthur merge <job> on his word`. Since AR0665 that command alone is refused (`arthur merge <job> needs the owner's decision: ...`); the coordinator learns the `--decision` only from that refusal.
- Suggestion: end them `arthur merge <job> --decision <the owner's decision id>`, as the `--no-ci` line at `auto-merge.ts:61` already does; update `auto-merge.test.ts`, `review.test.ts`, `merge.md` and the `review-pass-hook` eval with them.
- Status: fixed in 1dcfa484

## F2. A plan or ticket approved by the grant or a class can no longer be set planned

- Kind: ux
- Found by: 2026-11-10-worker-1ca8d870 (worker), 2026-11-10
- Where: `packages/orchestration/src/decision-use.ts:47`, `packages/orchestration/src/silent.ts` (`byRecommendation`), `packages/orchestration/docs/commands/decision.md:37`
- What: the `/silent on ... --recommend` grant and an approved class still answer a `plan` question, but `decision.owner` refuses an answer by recommendation or by policy, and the plan check refuses an approval without the owner's message. So `arthur ticket status <id> planned --decision <that id>` is refused, and the coordinator must ask the owner again.
- Suggestion: the owner decides whether the grant and classes should leave `plan` questions to him, as they leave merge and budget questions; if so, `byRecommendation` and `byPolicy` skip kind `plan` and decision.md says so.
- Status: open

## F3. `npm run mutate` reaches 10 of 25 mutants in its deadline on a diff that touches core and delivery

- Kind: test
- Found by: 2026-11-10-worker-1ca8d870 (worker), 2026-11-10
- Where: `test/mutate.ts:68`
- What: `npm run mutate -- --max 25` on this branch printed `mutate: 10 mutants, 10 caught, 0 survived; 15 not run (time); 140 not run (--max 25)`: each mutant of `packages/core/src/*.ts` or `packages/delivery/src/merge-command.ts` that its own test passes runs the package's whole `test/`, minutes each, so the 1500 s deadline ends the run before 25.
- Suggestion: run a mutant's same-name test and importers only, and the rest of the package once per file, or let the deadline scale with `--max`; out: the mutation rules themselves.
- Status: open

## F4. Any answer to a plan question sets the ticket planned, a no included

- Kind: security
- Found by: 2026-11-10-review-c77071b9 (review), 2026-11-10
- Where: `packages/orchestration/src/decision-use.ts:30` (`refusal`)
- What: `decision.owner` checks that the owner answered a `plan` question of the ticket in his own message, not what he decided. An answer "Not yet", or "Plan the ticket again: ..." (`plan-ended.md` step 5), still lets `arthur ticket status <id> planned --decision <id>` through. A `- Plan: yes` ticket's worker is still refused by `plans.ts`, which reads the decided line; any other ticket's is not. A merge decision answered "no" lets a merge through the same way (AR0664 F1, deferred).
- Suggestion: let `decision.owner` pass a `plan` or `merge` decision only when its later answer picked the option its use names (an approval option asked with the question, as `--picked 1`), and refuse `--decided` lines alone; out: reading the owner's words for their meaning.
- Status: open
