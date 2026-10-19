# AR0167 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The resources scope test assumes a machine of 2 cores or more

- Kind: bug
- Found by: 2026-10-19-ar0167-be6531bc (worker), 2026-10-19
- Where: `packages/resources/test/resources.test.ts:75`
- What: "a job spawned with the plugin gets its caps on its own scope" sets `perJob.cpu` 1.5 and expects `CPUQuotaPerSecUSec` `1.500000s`; the core caps a job's CPU at the machine's cores, so on one core (`taskset -c 0 node --import @arthur/core/testing --test packages/resources/test/resources.test.ts`, with a systemd user manager) it gets `1s` and fails every time (12 of 12 runs). Not a flake: GitHub's runner has more cores.
- Suggestion: take the expected quota as `min(1.5, availableParallelism())`, or skip below 2 cores; nothing else changes.
- Status: open

## Tests fixed

GitHub's job logs need a token, so each was found by load: the suite or one file run many times at once pinned to few cores (`taskset`), on this machine. Counts are from those runs.

1. `packages/core/test/job-state.test.ts`, "a block with stop stops the run and holds the job blocked on the user once it ended, whatever the outcome; arthur continue resumes it" (7df125d).
   - Symptom: `ends(...)` was `[]` right after `jobs.block(..., true)` resolved: the stop resolves once the state is final, and the wrapper emits `job-ended` after it.
   - Found: the full suite with `--test-concurrency=3`, three runs at once on cores 0,1 / 2,3 / 4,5: 1 of 3 failed. The test alone, 24 copies at once on one core, 5 rounds: 5 of 120 failed before, 0 of 120 after.
2. The same test, `packages/core/src/job-state.ts` `field` (a9697f4).
   - Symptom: `ENOENT ... /hold` thrown from `stopJob`: `field` checked `existsSync` and then read, and the wrapper removed `hold` in between; `arthur stop` could throw the same way.
   - Found: the after-fix stress run (six suite runs at once, two per 2-core set): 1 of 6 failed with it.
3. `packages/session/test/start-notice.test.ts`, "the probe times out: cut after its time, the agent killed; stopped meanwhile, no notice at all" (d17fb7f).
   - Symptom: `assert.ok(first)` failed: the probe's 300 ms ran out and killed the fake agent before it noted its start in `starts.jsonl`. The test now looks for the agent's process by its folder (`ps`), and fails when the probe no longer kills it (checked by removing the kill: timed out waiting for the probe killed).
   - Found: 12 copies at once on one core, 4 rounds: 47 of 48 failed before, 0 of 48 after.
4. The fake agent's notes, `packages/core/src/fake-agent.ts` `note` (ba75b20): tests that read `starts.jsonl` or `messages.jsonl` while the agent runs.
   - Symptom: `SyntaxError: Unexpected end of JSON input` in a test's `lines`/`starts` helper: `appendFileSync` creates the file empty, then writes the line. Seen in `restart.test.ts` "/restart with a coordinator: the handoff first, ...", `session.test.ts` "a session busy for compactWaitSeconds withdraws the request with one line, and the handoff is never asked for", and `coordinator.test.ts` "arthur coordinator stop is refused while a job runs, naming it, and the coordinator goes on". The file is now made with its first line by a link.
   - Found: each test file run 6 copies at once on 2 cores and 12 copies on one core. A throwaway reader polling `starts.jsonl` while 10 starts of one fake agent ran, 20 rounds: 317 empty reads of 48231 before, 0 of 57645 after, no line lost.
5. `packages/session/test/restart.test.ts`, "at a start only a handoff newer than the last one read is read, and an empty one never" (ba75b20).
   - Symptom: the handoff message was asserted right after `up()`, but the agent notes its pid before it sends the handoff and notes it read after: `[]` instead of the message, or "noted as read" failed. The test now waits for each.
   - Found: `restart.test.ts`, 12 copies at once on one core: 3 of 12 failed before (with item 4), 0 of 12 after.
