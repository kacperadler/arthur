# AR0658 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The checks line and the review gate read a run the deadline cut as one capped by --max

- Kind: fix
- Found by: 2026-11-08-worker-54bdf673 (worker), 2026-11-08
- Where: `packages/delivery/src/checks-extension.ts:77`, `packages/delivery/src/review-command.ts:133-136`
- What: mutate's summary now has two `not run` parts, `; <n> not run (time)` before `; <m> not run (--max <max>)`. The extension's regex `survived(?:; (\d+) not run)?` takes the first one only: `node -e` on `mutate: 10 mutants, 10 caught, 0 survived; 15 not run (time); 100 not run (--max 25)` gives run 10, survived 0, not run 15, the --max part dropped. The gate then needs min(25, 10 + 15) = 25 and refuses with `mutate capped at --max 10 (...)`, which names a cap nobody set [INFERENCE from review-command.ts:133-136, not run]. Whether a run the deadline cut opens the gate is the owner's call; today it does not, under a misleading reason.
- Suggestion: read both parts in the extension (`<run> run, <survived> survived, <not run> not run` with the time count apart, or summed), and have the gate name a run cut by time as such, opening or refusing it as the owner decides. Out: mutate.ts itself.
- Status: open

## F2. A mutate run over test/mutate.ts still leaves a blocked fixture test running

- Kind: test
- Found by: 2026-11-08-worker-54bdf673 (worker), 2026-11-08
- Where: `test/mutate.test.ts` (the signal test and the new deadline-cut test both block `packages/a/test/limit.test.ts`), `test/mutate.ts` (`passes` spawns it `detached`)
- What: after each of this branch's three `npm run mutate` runs (and the review's, 2026-11-09-review-ba7bd630), one `node --test packages/a/test/limit.test.ts` group (two processes, parent pid 817) was still running in a `/tmp/arthur-test-*/tmp/folder-*` fixture, 2658 s, 958 s and 936 s old when seen; I killed each group by hand. This is AR0637 F1 again: a mutant of `test/mutate.ts` that breaks its own group kill leaves the fixture's blocking test in a process group the outer run's kill does not reach. Which of the two blocking tests leaked each one was not determined; the deadline-cut test is a second test of that shape, so it may add a path [INFERENCE].
- Suggestion: have the blocking fixture test end itself once its own parent test file is gone (for example, exit when `process.ppid` changes), so no mutant can leave it behind. Out: mutate.ts's logic.
- Status: open

## F3. Any SIGKILL of a test run in mutate's last 600 s counts as the deadline's cut

- Kind: fix
- Found by: 2026-11-09-review-ba7bd630 (review), 2026-11-09
- Where: `test/mutate.ts:217` (`signal === "SIGKILL" && left < RUN_MS ? undefined : false`)
- What: a test run that started with less than RUN_MS (600 s) before the deadline and dies by SIGKILL for another cause (the OOM killer, a mutant that kills its own group) is read as cut by the deadline: the mutant is not run, the loop stops, and every later one is `not run (time)` though time was left [INFERENCE from the lines, not reproduced].
- Suggestion: decide by the clock at exit, `Date.now() >= end`. Not made on this branch: the tests' fake clock stands still at its last offset, so the deadline-cut test would never see `end` reached; it needs a clock that also advances with real time, and a spawn timeout that may fire a millisecond before `end` makes that boundary flaky unless the check allows for it.
- Status: open
