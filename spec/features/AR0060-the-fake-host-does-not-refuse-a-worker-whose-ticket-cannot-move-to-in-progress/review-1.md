# AR0060 - Review 1

- Job: 2026-10-16-review-ar0060-fake-host-f4f19f96
- Branch: h/2026-10-16-ar0060-fake-host-refuses-f4ebb0ee
- Commit reviewed: 3bef88ed034c2bbe16ff789a73e56c0fed4e5f1b
- Verdict: PASS

## Final message

Worktree clean, no leftover mutation edits.

Findings: none blocking.

Notes:
- F1 (worker spawned inside a plugin's `setup` skips the core's check in a real load; the fake host is stricter than production there) is correctly logged as `Status: open` in findings.md rather than fixed — out of this ticket's Done means, which only requires matching production's order for the normal case, which it does.
- The "subscribe the move first" mutation worker claims to have checked is ambiguous in wording; swapping registration order of the two independent hooks inside `spawn()` (check vs. move) has no observable effect (both pass) — the actual breaking mutation, which the worker's commit `3bef88e` and description correctly target, is subscribing `moveStartedTickets` unconditionally at `fakeHost()` construction time instead of gated at first `spawn`. I reproduced that exact mutation and it breaks the handler-order test (12/13), matching the worker's claim precisely.

Checks run (in this worktree):
- `npm ci` — clean.
- `npm run check` (tsc) — passes, no errors.
- `npm test` — 236/236 pass.
- Line counts: `host.ts` 145, `testing.ts` 195, `board-jobs.ts` 46 — match worker's claims.
- Mutation "drop the fake-host check" (remove `refuseUnstartableTickets` call in `spawn()`): 12 pass, 1 fail (refusal test) — matches claim.
- Mutation "subscribe the move as soon as the fake host is created" (move `moveStartedTickets` to run unconditionally at `core` construction, outside the `following`-gated block): 12 pass, 1 fail (handler-order test) — matches claim.
- Restored `testing.ts` to clean state after each mutation; `git status --short` empty.
- Verified `board-jobs.ts`'s `refuseUnstartableTickets` is a byte-identical move of the logic previously inline in `host.ts` (same `STARTS`, same message format), registered by both `loadPlugins` and `fakeHost`.
- Verified `jobs.ts`'s `beforeSpawn` checks run in registration order (array push + sequential iteration), confirming the "after the plugin's checks" ordering claim is structurally true, not just test-shaped.
- Diff touches only `board-jobs.ts`, `host.ts`, `testing.ts`, `testing.test.ts`, and the ticket's `findings.md` — within the ticket's named scope; no incidental changes to AR0017/AR0056-adjacent code.

PASS
