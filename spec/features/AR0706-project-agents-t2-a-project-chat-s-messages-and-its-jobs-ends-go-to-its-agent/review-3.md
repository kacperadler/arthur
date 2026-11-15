# AR0706 - Review 3

- Job: 2026-11-15-review-fa3791a1
- Branch: arthur/2026-11-14-worker-8a88fde0
- Commit reviewed: 46194dc21fb4792007c214647edd5a581225930a
- Verdict: FAIL

## Final message

## Findings

1. **`packages/orchestration/src/inbox.ts:101`: no test catches it if `outbox/held` is dropped from the list of reply boxes.** `inbox.start()` now reads the replies of a removed agent from `outbox/`, `outbox/sent/` and `outbox/held/`, and keeps every handed message they answer in that agent's `turn/`. The worker's final message and `docs/commands/coordinator.md:102` both name all three places. The worker tested removing `outbox` and `outbox/sent`, but not `outbox/held`.
   - **Mutation:** `["outbox", "outbox/sent", "outbox/held"]` → `["outbox", "outbox/sent"]`.
   - **Result:** `node --import @arthur/core/testing --test packages/orchestration/test/project-routing.test.ts` gave pass 10, fail 0. The mutant survives.
   - **What it breaks:** I ran a throwaway copy of the test at `project-routing.test.ts:172` with shop's earlier reply moved from `outbox/sent/` to `outbox/held/`.
     - On the tip, `5-1000` stays in shop's `turn/`.
     - With the mutation, `5-1000` moves to the coordinator's queue: the assertion shows `[ '7-1000' ]` where `[ '5-1000', '7-1000' ]` was expected.
     - The copy's other failure was an outbox-listing test unrelated to this; it failed with and without the mutation.
   - **Why it matters:** a held reply answers a turn of Arthur's messages only, such as a job's end while silent mode is on. Without the `held/` check, that job end reaches the coordinator a second time as a new, unmarked message, and the coordinator acts on it twice. That is the double answer this commit set out to prevent.
   - **Fix:** give the removed agent a reply in `outbox/held/` that answers one of its `turn/` messages, and assert that the message stays where it is.

## Notes
- (minor) `packages/orchestration/src/inbox.ts:102`: the start now calls `JSON.parse` on every `.json` in a removed agent's `outbox/sent/` and `outbox/held/`. One file broken by hand there throws in `start()`, and `arthur run` does not start. The extension's own restart check (`inbox-extension.ts:149-152`) also throws on such a file, so the behavior is consistent, but a removed agent's old `sent/` file is now one more place this can happen.
- (minor) `packages/orchestration/src/inbox.ts:24`: mutate's only `survived:` mutant puts back `const RESULT_LINES = 15;`, which nothing reads. It changes no behavior, so it is not a missing test; review-2 said the same.

## Checks (all on `46194dc2`)
- `npm run check`: `tsc`, exit 0.
- `npm test`: 1865 tests, 1801 pass, 0 fail, 0 cancelled, 64 skipped.
  - The yellow files it prints (in core, delivery and session) are all outside the diff.
  - The structure test passes with orchestration's budget at 3193.
- `npm run mutate`, three calls on the same commit:
  - 1st: 38 mutants, 37 caught, 1 survived, 62 not run (time).
  - 2nd: 78 mutants, 77 caught, 1 survived, 22 not run (time).
  - 3rd: 100 mutants, 99 caught, 1 survived; 361 not run (`--max 100`).
  - The survivor is `packages/orchestration/src/inbox.ts:24: hunk reverted to the base`, as the worker said.
- Hand mutation (finding 1): survived, 10 pass, 0 fail. Restored with `git checkout -- packages/orchestration/src/inbox.ts`.
- Throwaway probe test (finding 1): the removed-agent case passes on the tip and fails with the mutation. The probe file was deleted, and `git status --short` is empty.
- The worker's claims match what I saw:
  - check, test and mutate counts;
  - the test at `project-routing.test.ts:172` now covers `outbox/sent/`, a draft and the coordinator's own `sent/`;
  - the doc line `coordinator.md:102`.
- Review-1's minor notes are resolved:
  - `coordinator.md:34` now lists `{ text, project? }`;
  - the stale "until the project agents" line is gone from `spec/roadmap.md`.

FAIL