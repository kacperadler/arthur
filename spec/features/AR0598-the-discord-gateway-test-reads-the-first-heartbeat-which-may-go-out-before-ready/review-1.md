# AR0598 - Review 1

- Job: 2026-10-31-review-e6b5cc53
- Branch: arthur/2026-10-31-worker-95fff6d4
- Commit reviewed: 6960ba539460b849800832259178d4f3a330d4b2
- Verdict: PASS

## Final message

## Findings

None. The branch does what AR0598 asks:

- **The assertion.** In `packages/discord/test/gateway.test.ts:21`, the first test now waits with `until("three heartbeats", …)` and checks `api.sent(1)[2]?.d === 2`. That is the third heartbeat. The first goes out at `every * Math.random()` (`src/gateway.ts:109`), and the third goes out two full intervals after it, so it is the first one certain to come after READY and GUILD_CREATE. The two-line comment above it gives that reason.
- **Scope.** Only this one assertion and its comment changed. `src/gateway.ts` is unchanged, as the ticket requires. The commit `6960ba53 test(AR0598): …` follows the Conventional Commits rule with the ticket id as the scope.
- **The test still catches a broken gateway.** I changed `src/gateway.ts` twice and ran the test each time:
  - With the sequence kept stale after READY (`if (typeof s === "number" && seq === null) seq = s;`), it failed with `actual: 1, expected: 2`.
  - With the sequence never tracked (`if (false) seq = s;`), it failed with `actual: null, expected: 2`.
- **Worker's claims.** Everything the worker reported matches what I saw: the check, the test totals, both mutant results and the 50/50 loop.

## Notes
- (risk) `packages/discord/test/gateway.test.ts:8`: the test can still fail under heavy load. The 50-run loop passed 48 of 50 while `npm test` ran in parallel, and I did not capture why the two failed. Alone it passed 50 of 50, and with six loops at once 90 of 90. `[INFERENCE]` The likely cause is the 50 ms window for a heartbeat ACK: if one ACK arrives late, the connection closes with 4000 before the `closed === undefined` check. That would be a different line from the one this ticket fixes.

## Checks
- `npm run check`: `tsc` clean.
- `npm test`: ran twice. The first run's grep pattern did not match the reporter's output, so it gave no totals. The second run gave `tests 1453, pass 1391, fail 0, cancelled 0, skipped 62`, exit 0, with no yellow or red line.
- The ticket's 50-run loop:
  - alone: `passed 50 of 50`
  - beside the full suite: `passed 48 of 50`
  - six loops in parallel: 90 of 90 ok
- The two hand mutants above: both caught. I restored the file with `git checkout --`, and `git status --short` was clean afterwards.
- I did not run `npm run mutate`, to keep within the small budget. The diff changes only a test file, and the hand mutants cover the behavior it protects.

PASS