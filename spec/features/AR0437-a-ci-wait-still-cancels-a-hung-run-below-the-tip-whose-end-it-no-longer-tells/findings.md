# AR0437 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A plain merge refuses a passed run below the tip on the branch's own commits, and leaves a CI wait

- Kind: fix
- Found by: 2026-10-29-worker-9f0f2fde (worker), 2026-10-29
- Where: `packages/delivery/src/auto-merge.ts:66`
- What: `ciRefusal(…, false)` passes line 64 for a completed run on the branch's own commits (`below < own`), then line 66 `run.below !== 0` starts a wait and refuses with `arthur merge merges only with CI passed on the branch: no run built the tip yet (the nearest, …, 1 below the tip); it waits: …`, though `docs/commands/merge.md` says a plain merge refuses only a run that ended other than `success` and waits for nothing (AR0362). Reproduced with a throwaway `await merge(docs.id)` (no `--auto`) at the end of the test "CI passed on the tip after a new commit…" in `packages/delivery/test/auto-merge.test.ts`, `github.ci` answering a `success` run with `below: 1`: it printed `1 arthur merge: arthur merge merges only with CI passed on the branch: no run built the tip yet (the nearest, 7, ran on 5b253ba, 1 below the tip); it waits: …; main is unchanged`. Left alone here: AR0437's Scope puts the plain merge's reading of the branch's own commits out.
- Suggestion: guard line 66's wait with `auto &&` as a whole (`if (auto && (run === undefined || run.below !== 0 || run.sha !== tip))`), so a plain merge falls through to the `success` check; a test of a plain merge with a passed run 1 below the tip that merges, and one that ended `failure` that refuses with `…, 1 below the tip, ended failure: …`.
- Status: open

## F2. A run delivery cancelled below the tip that still ends `success` is told as the pass the wait waited for

- Kind: ux
- Found by: 2026-10-29-worker-9f0f2fde (worker), 2026-10-29
- Where: `packages/delivery/src/ci-wait.ts:64`
- What: since AR0437 `ciEnded` tells a run delivery cancelled at any depth. Should GitHub finish such a run below the tip with `success` (the cancel came too late), `ended` says `CI passed on <branch> (run …, on <older commit>): …. It waited for that: arthur merge --auto <job>`, and the `--auto` it names refuses again, the run not being on the tip. Reading of the lines; no test runs it.
- Suggestion: in `ended`, say a pass below the tip as not the tip's (or leave a `success` below the tip to github's wake in `ciEnded`), with a test.
- Status: open
