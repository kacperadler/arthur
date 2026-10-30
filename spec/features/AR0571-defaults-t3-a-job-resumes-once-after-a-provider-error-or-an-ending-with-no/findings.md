# AR0571 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. omp's 20 tries of an Anthropic overload take about 19 minutes, not about 2

- Kind: perf
- Found by: 2026-10-30-worker-4caae474 (worker), 2026-10-30
- Where: `packages/core/src/job-omp.yml:13`
- What: omp's own back-off for 20 retries is 101.6 to 135.5 s (0.5, 1, 2, 4 s, then 8 s, less up to 25 % jitter; read in the omp 18.3.0 binary: `XGe`, `Vca = 8000`, `Xca = 0.25`). But each omp try of the Anthropic API is itself its client's 11 requests: against a local server that answers every request `529 overloaded_error` (`ANTHROPIC_BASE_URL` pointed at it, `--config job-omp.yml`), omp reported `"maxAttempts":20` and its first two tries took 49.9 s and 49.3 s of requests each (27 requests in 110 s). So a job waits about 21 x 50 s + 2 min, about 19 minutes, before the run stops on the error and the wrapper's one resume starts, which can wait as long again. A job's time limit keeps counting through it.
- Suggestion: decide whether 20 is the window wanted; 10 (omp's default) gives about 10 minutes. Only the number in `job-omp.yml` and its comment change.
- Status: open

## F2. plan-file.ts files a plan review's verdict `none`, which no plan review that may be filed has any more

- Kind: refactor
- Found by: 2026-10-30-worker-4caae474 (worker), 2026-10-30
- Where: `packages/orchestration/src/plan-file.ts:30-32`, `packages/orchestration/docs/commands/plan.md:43`
- What: `plan-review` is registered with `verdicts: ["PASS", "FAIL"]` since AR0571, so a plan review whose last line is not `PASS` or `FAIL` ends `failed: no verdict` and the core refuses to file it (`plans.test.ts`, "a plan review without a bare verdict ... is never filed"). The `none` branch of `filePlanReview` and the doc's `or none` can no longer be reached by a run that is filed. The ticket put plan-file.ts out of scope.
- Suggestion: read the verdict as `PASS` or `FAIL` only, drop `none` from the doc; the filing stays otherwise as it is.
- Status: open
