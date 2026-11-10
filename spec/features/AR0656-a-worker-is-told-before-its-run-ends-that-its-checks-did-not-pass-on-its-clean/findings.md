# AR0656 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The processes reminder is lost in a run whose end also gets the checks reminder

- Kind: fix
- Found by: 2026-11-08-worker-2ea1125b (worker), 2026-11-08
- Where: `packages/delivery/src/processes-extension.ts:23`, `packages/delivery/src/delivery.ts:117`
- What: omp's `session_stop` asks every handler and keeps only the first continuation (`s ??= a` in omp's `emitSessionStop`, seen with `strings ~/.local/bin/omp`; the fake agent does the same, `packages/core/src/fake-agent.ts:154`, `answers.find`). delivery registers the checks extension before the processes extension, so when a worker's run ends with its checks missing and a process left running, both handlers answer: the checks reminder goes to the agent, the processes one is dropped, yet the processes extension has already set `reminded = true`, so it never names the leftovers in that run. docs/delivery.md, "Processes a job leaves running", says such a run goes on with that message. [INFERENCE from the code named; not reproduced with a live omp run.]
- Suggestion: the processes extension marks itself reminded only once its message reached the run (its text in the next `session_stop`'s `messages`), or delivery answers `session_stop` from one handler that joins both reminders. The checks reminder itself stays as it is.
- Status: ticket AR0675

## F2. The docs do not name the checks reminder at a worker's run end

- Kind: docs
- Found by: 2026-11-08-worker-2ea1125b (worker), 2026-11-08
- Where: `packages/delivery/docs/commands/review-needed.md`, "The job's checks" and "Before a review"; `packages/delivery/docs/delivery.md`
- What: AR0656 adds a `session_stop` handler to `checks-extension.ts` that continues a worker's run once with `[Arthur] Before your run ends: Arthur starts no review yet: …` when `untested` would refuse its tip. The ticket's Scope leaves every file but `checks-extension.ts` out, so no doc page says so; `arthur review-needed --help` describes the extension's lines and timeout only.
- Suggestion: one paragraph in "Before a review": a worker's run that ends while `arthur review` would refuse its tip goes on once with that reminder, at most once per run, workers only, not for a job on another machine.
- Status: deferred (client summary)

## F3. the processes reminder (AR0585) can be lost

- Kind: fix
- Found by: 2026-11-08-review-03f1f51c (review), 2026-11-09
- Where: `packages/delivery/src/checks-extension.ts:49`
- What: omp keeps only the first continuation, and the checks extension is registered first (`delivery.ts:117`). When both reminders fire, the processes one is dropped, and since its `reminded` flag is already set it never comes back in that run. The ticket's design causes this and the Scope keeps the fix out; it is already F1 in `findings.md`. Nothing is lost for good: the wrapper still kills leftover processes at the job's end.
- Status: ticket AR0675
