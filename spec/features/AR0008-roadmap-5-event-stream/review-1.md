# AR0008 - Review 1

- Job: 2026-10-16-review-ar0008-event-stre-81ea4e61
- Branch: h/2026-10-16-ar0008-event-stream-b32e80cb
- Commit reviewed: b88c72378885a4ecb59bc9015601fcb18552136c
- Verdict: PASS

## Final message

## Review: AR0008 — Roadmap entry 5, Event stream

### Findings (none blocking)

No requirement from `spec/roadmap.md` entry 5's Done means, or from the ticket, is missing, stubbed, or untested. All edge cases named are present with their own test in `packages/core/test/events.test.ts` / `lock.test.ts` / `testing.test.ts`.

### Notes (non-blocking)

- `packages/core/src/lock.ts`'s dead-holder takeover race (the `<path>.takeover` guard, protecting against a slow taker undoing a fast taker's work, and recovery from a guard left by a crashed taker) has no committed test exercising real concurrent takers racing a dead lock — only a single-process sequential takeover (`lock.test.ts:28`) and a live-holder-refusal test exist. I wrote a throwaway script (8 concurrent Node processes racing a pre-seeded dead-pid lock, and a second script seeding a stuck `.takeover` guard from a dead pid) and confirmed correct mutual exclusion and clean recovery in both cases — so the behavior is right, but it's not pinned by the suite. Since the roadmap's actual Done-means requirement ("two processes appending at once never interleave") *is* tested with two real concurrent OS processes, and this extra race-safety is infrastructure the worker built ahead of entry 17's reuse, I don't treat the missing test as a ticket-blocking gap, just a coverage note for whoever picks up entry 17.
- `host.events.read` / `readEvents(home, fromSeq)` vs. roadmap's bare `readEvents(fromSeq)`: explicitly called out by the worker and accepted per this review's Focus (roadmap names are proposals until entry 51).

### Checks run (in this worktree, not the main checkout)

- `npm ci` — 5 packages added, clean.
- `npm run check` — `tsc`, no errors.
- `npm test` — 77/77 passed, 0 failed, matching the worker's claim exactly (including the ~1.1s real two-process concurrent-append test).
- Mutation checks (throwaway edits, reverted with `git checkout --` after each, confirmed clean with `git status --short` and a final green `npm test`):
  - Removed the emit-queue (nested events delivered immediately) → `events.test.ts` "emit order" test failed as expected.
  - Removed the try/catch around a throwing handler → `events.test.ts` "throws or rejects" test failed (uncaught exception) as expected.
  - Removed torn-last-line handling in `appendEvent` → `events.test.ts` "torn last line" test failed as expected.
  - Removed the `alive()` guard in `lock.ts`'s takeover path (steal a live holder's lock) → `lock.test.ts` "live process … refused" test failed as expected.
  - Off-by-one on `readEvents`'s `>=` → `>` → `events.test.ts` "reading from a sequence number" test failed as expected.
- Line budgets: `events.ts` 132, `lock.ts` 85, `plugin.ts` 85, `host.ts` 121, `testing.ts` 80 — all ≤ 200; structure tests ("a package over its line budget … fails", "the repository keeps every rule", boundary tests) pass against the changed tree.
- No `package.json` touched — no new runtime or dev dependency.
- `README.md` and `arthur.config.example.ts` unchanged, correctly (no new command/option this entry).
- Boundary: `events.ts`/`lock.ts` are not in `@arthur/core`'s `exports` map — plugins can reach events only via `host.events`, never by importing the core file directly; core imports no plugin.

Worker's final-message claims (file list, test counts, mutation results, smoke run, finding) all match what I verified in the diff and by running the suite.

PASS
