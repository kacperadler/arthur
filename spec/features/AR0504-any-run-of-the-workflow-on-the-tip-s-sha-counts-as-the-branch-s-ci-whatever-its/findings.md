# AR0504 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A run now builds one branch, yet ci-finished still groups branches per run

- Kind: refactor
- Found by: 2026-11-05-worker-d668a5a7 (worker), 2026-11-05
- Where: `packages/github/src/github.ts:85-111` (the `ended` map of a run to its branches, `rest`), `packages/github/docs/github.md` (`ci-finished`'s `branches`)
- What: since AR0504 `nearestRun` counts only runs whose `head_branch` is the branch, so a run is the run of one branch at most; the grouping of several branches under one run, the `branches` list of `ci-finished` and the wake's `rest.join(", ")` always hold one branch. Behavior is right; the code and the event's shape carry a case that no longer happens.
- Suggestion: fold the per-run grouping into one branch per run and decide whether `ci-finished` keeps `branches` (its consumers: delivery's CI waits, the docs); the event's shape is a contract, so it is the owner's call.
- Status: deferred (client summary)
