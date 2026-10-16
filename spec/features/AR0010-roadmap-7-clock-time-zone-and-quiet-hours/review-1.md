# AR0010 - Review 1

- Job: 2026-10-16-review-ar0010-clock-and-14c7ef11
- Branch: h/2026-10-16-ar0010-clock-and-quiet-h-81773814
- Commit reviewed: b2cb56bb59479578a6dc0be915cf77cb6c174ee7
- Verdict: PASS

## Final message

Thorough review complete. Summary of verification performed:

**Checks run (in this worktree):**
- `npm ci`: clean (5 packages).
- `npm run check` (tsc): clean, no errors.
- `npm test`: 77/77 pass, matches worker's claim exactly (same test names/count).
- `git status --short`: clean before and after all mutation probes.

**Mutation testing on key behaviors (each reverted via `cp`/`git checkout` after, tree confirmed clean):**
- `next()` strict-after (`at > from` → `at >= from`): caught — autumn-repeat test fails (returns same instant three times instead of advancing).
- Quiet-hours "equal means never" (removed `quiet.from === quiet.to` check): caught — "from equal to to" test fails.
- Week bound off-by-one (`7*DAY` → `6*DAY`): caught — day-list test throws "no 08:00 on wed within a week" instead of returning next week's slot.
- Across-midnight boundary inversion (`>`/`<=` instead of `>=`/`<`): caught — midnight-crossing quiet-hours test fails.
- Day-of-week filter disabled: caught — single-day `next` test returns tomorrow instead of the next matching weekday.
- One-clock-per-plugin instead of shared instance: caught — `assert.equal(orchestration.clock, telegram.clock)` fails on reference inequality.
- `setNow` made a no-op: caught — fake-host clock test fails, time stays frozen.

All seven mutations of the behaviors the focus names (DST spring/autumn, quiet hours incl. equal-from-to, `next` strictness/bound, shared clock, settable fake clock) are caught by the existing test suite — no gap found.

**Scope / boundaries:**
- Diff touches only `packages/core` (clock.ts, host.ts, plugin.ts, testing.ts, package.json, tests) plus the one-line `arthur.config.example.ts` comment update. No plugin packages exist yet in the repo, so the plugin-boundary rules are vacuously satisfied; `clock.ts` stays inside `@arthur/core`, imports only `./config.ts`.
- `clock.ts` is 106 lines, well under the 200-line cap; no core line-budget test exists yet to violate.
- New export `./clock` added to `package.json`, consistent with "plugins import only `@arthur/core` through its published exports."
- No runtime dependency added; refusals name the offending value (`quietHours.from`, `clock.next`, day name, time string) as the ticket requires.
- `docs/commands/config.md` is about `arthur config check` and never referenced `timeZone`/`quietHours` before this change either; this ticket adds no new user-facing command/option beyond the config comment already updated, so no doc page was missed.

**Notes (non-blocking):**
- `instant()`'s binary search and `wall()`-via-`Intl.DateTimeFormat` approach is a bit dense but each branch is covered by a DST test (gap, repeat, exact-minute) and the mutation checks above exercise it.

**Verdict basis:** diff matches ticket's Done-means edge cases one-for-one (midnight-crossing quiet hours, equal-means-never, spring gap, autumn repeat, exact-minute `next`, one-day list, week bound, settable fake clock, shared clock), tests are real functional checks (not tautologies), checks reproduce exactly as claimed, no scope creep, commits are Conventional Commits scoped `AR0010`.

PASS
