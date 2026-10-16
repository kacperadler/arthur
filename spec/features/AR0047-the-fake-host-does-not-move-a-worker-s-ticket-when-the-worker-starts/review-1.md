# AR0047 - Review 1

- Job: 2026-10-16-review-ar0047-fake-host-5cd11d48
- Branch: h/2026-10-16-ar0047-fake-host-moves-t-504c50d5
- Commit reviewed: ffd9843de213e4c329ee9c2404ac0b454ad52613
- Verdict: PASS

## Final message

## Review

**Diff scope:** `board-jobs.ts` (new), `host.ts`, `testing.ts`, `testing.test.ts`, `findings.md` — 5 files, +80/-16, one commit `ffd9843 feat(AR0047): …`.

### Findings (none blocking)

- `board-jobs.ts` lives beside `board.ts` rather than inside it. Task's Focus note explicitly pre-approves this ("board-jobs.ts, a new file because board.ts is at 192 lines: accept"), and verified: the function + regex (~22 lines) would push `board.ts` from 192 to ~214, over the 200-line structure-test limit (`npm test` includes "a source file of exactly 200 lines passes, 201 lines fails"). Correct call.
- `moveStartedTickets` body is byte-identical to the handler it replaced in `host.ts` (diff confirms: same destructuring, same `flatMap`/try-catch, same throw). Matches the worker's "unchanged" claim.
- `testing.ts`'s `fakeHost` builds a second, independent `Board` instance (events named `"core"`) alongside `pluginHost`'s own board (events named by the plugin), mirroring the real `loadPlugins`/`pluginHost` split exactly (`board.ts:51`, `plugin.ts:110` vs `host.ts`'s `const core = board(...)`). No cross-boundary violation.

### Notes (non-blocking)

- F1/F2 in `findings.md` are correctly scoped out: the ticket's Done means names only the `job-started` subscription, not `beforeSpawn` (AR0048) or handler ordering.

### Checks run (in this worktree, not the main checkout)

- `npm ci`: clean, 5 packages added.
- `npm run check`: `tsc`, no output, passes.
- `npm test`: 234/234 pass, 0 fail — includes the new test `"on the fake host, as in a real load, a worker's start moves its planned ticket to in-progress; a read-only kind's moves nothing"` and all pre-existing suites (host.ts's `beforeSpawn`/`job-started` tests, structure/boundary tests, etc.).
- Mutation 1: commented out the `moveStartedTickets(...)` call in `fakeHost` → new test fails `actual: 'planned', expected: 'in-progress'`. Matches worker's claim.
- Mutation 2: inverted `if (kind !== "worker") return;` → `if (kind === "worker") return;` in `board-jobs.ts` → new test fails `actual: 'in-progress', expected: 'planned'`. Matches worker's claim.
- Both mutations reverted; `git status --porcelain` clean after.

New test exercises both branches (read-only spawn stays `planned`, worker spawn moves to `in-progress`), asserts the single `ticket-moved` event is tagged `plugin: "core"`, and asserts the plugin's own `emitted` log stays empty — not just a happy-path check.

All Done-means points met, instruction's file-touch constraint honored with a disclosed, pre-approved exception, checks reproduce as claimed.

PASS
