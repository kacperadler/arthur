# AR0670 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A hung herdr queues every event's calls behind 5 s each

- Kind: perf
- Found by: 2026-11-09-review-2384b0b7 (review), 2026-11-09
- Where: `packages/herdr/src/herdr.ts` (`queue`), `packages/herdr/src/herdr-cli.ts` (`call`, `LIMIT_SECONDS`)
- What: every herdr call waits up to 5 s and all go through one chain, so with herdr hanging each `job-started` and `job-state` adds at least 5 s to the chain, and a `jobs.cleanup` in `arthur run` waits behind all of them; in another process `arthur prune --all` costs about 5 s per job. [INFERENCE from the code; not measured.]
- Suggestion: after a call that did not answer in time, skip herdr calls for a while (one minute), so a hung herdr costs one timeout, not one per event; the doctor line stays as it is.
- Status: deferred (client summary)

## F2. Each job-state makes three herdr calls before its report

- Kind: perf
- Found by: 2026-11-09-review-2384b0b7 (review), 2026-11-09
- Where: `packages/herdr/src/herdr.ts` (`job-state` handler), `packages/herdr/src/herdr-cli.ts` (`space`)
- What: `workspace list`, `tab list` and `pane list` run before every `report-agent`, each a process of its own, though the workspace and tabs rarely change.
- Suggestion: keep the last `Space` in memory and look it up again only when a call on it fails; measure first, since a state change is rare (a few per job).
- Status: deferred (client summary)

## F3. No test covers the herdr call's fallback message

- Kind: test
- Found by: 2026-11-09-worker-bafad861 (worker), 2026-11-09
- Where: `packages/herdr/src/herdr-cli.ts:40` (`|| failed.message`)
- What: a herdr that exits non-zero with an empty stderr, or answers with stdout that is not JSON, gets `failed.message` in its doctor line; no test drives either, so a mutant removing the fallback (`herdr workspace list: ` with nothing after it) would pass.
- Suggestion: a fake herdr mode that exits 1 without output, and a doctor-line test of it.
- Status: deferred (client summary)
