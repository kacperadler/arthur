# AR0025 - Review 1

- Job: 2026-10-16-review-ar0025-machine-st-7e07cca6
- Branch: h/2026-10-16-ar0025-machine-stop-stee-a6df9ae2
- Commit reviewed: 4105b5273b6dab28bf9455c77f5b1a9f584749f6
- Verdict: FAIL

## Final message

## Review Findings

**`packages/core/src/remote-job.ts:105` — off-by-one in the F2 log-offset boundary, uncaught by any test.**

```ts
[logSize, logFrom] = [bytes.length, Number(skip) <= bytes.length ? Number(skip) : 0];
```

The ticket's Decision (F2, folded from AR0024) requires: "ask for `log` from the size already copied... and append; keep whole files for the rest." The correct boundary is `skip <= bytes.length` (caught up exactly ⇒ send nothing new, `logFrom = skip`, empty delta). I mutated this to `skip < bytes.length` (a "limit moved by one," exactly the family the review guide names) and reran `packages/core/test/machine.test.ts`: **all 17 tests still pass**, `machine.test.ts:323` ("a copy brings only the log's new bytes...") included.

With the mutation, the extremely common case — a sweep where the log hasn't grown since the last sync (`skip === bytes.length`, true for any idle/blocked job, or simply a 30 s sweep interval with no new output) — falls through to `logFrom = 0`, resending the **entire log** over SSH on every such sweep instead of an empty delta. That is precisely the behavior F2 was written to eliminate; the regression reinstates it for the single most frequent case, and no test catches it.

The gap: the existing test (`machine.test.ts:323-340`) checks `skip=0` (whole log), `skip=Buffer.byteLength(before)` (a genuine partial offset), and `skip=size+1` (over-ask ⇒ whole log), but never `skip=size` (the exact "caught up" boundary) — the one value that distinguishes `<=` from `<`. Restoring the file (`git checkout -- packages/core/src/remote-job.ts`) confirms the original code is correct at that boundary; the test simply never exercises it.

This is a mutation of a key, ticket-mandated behavior (F2) that the test suite does not catch, which the review guide treats as a FAIL on its own.

## Notes (non-blocking)

- `packages/core/src/machine-sync.ts` `unreachable()`: the local variable is named `failed` but holds `moveJob`'s "did it move" boolean (true on a real move, not failure). Confusing name, no functional issue.
- `packages/core/docs/commands/continue.md`: the pre-existing sentence "released here only when the continue fails; else the new wrapper removes it" isn't updated to note that for a job on another machine the lock is *always* released here (the remote wrapper can't touch this host's lock file) — confirmed correct in code (`job-control.ts`'s `finally` block), just not spelled out in the doc. No behavioral bug.

## Checks run

- `npm ci` — clean.
- `npm run check` — `tsc`, exits 0.
- `npm test` — 304/304 pass, matching the worker's claim.
- Diffed final tree against `0af07cb` for `packages/core/src` and `packages/core/test`: only intentional new test (`4105b52`) remains; the interim mutation damage from `46cbc3a` is fully reverted by `333863c`, confirmed clean.
- Mutation `packages/core/src/remote-job.ts:68` (removed `inRun` prune refusal) → caught by `machine.test.ts:294` (added in `4105b52`). Restored.
- Mutation `packages/core/src/machine-sync.ts:88` (`>=` → `>` on the offline grace boundary) → caught by `machine.test.ts:256` ("offline past the grace..."). Restored.
- Mutation `packages/core/src/remote-job.ts:47` (F1 slice fix replaced with fixed low cpu/memory) → caught by `machine.test.ts:315` ("a job there gets the machine's own joint limit..."). Restored.
- Mutation `packages/core/src/remote-job.ts:105` (F2 offset `<=` → `<`) → **not caught**, full suite green. Restored.
- Core src line count excluding test kit: 4508, within the `BUDGETS.core = 4812` ceiling (unchanged by this branch) and `jobs.ts` is exactly 200 lines, all other touched files under 200.
- Spot-read all touched docs (`continue.md`, `prune.md`, `steer.md`, `stop.md`, `stopall.md`, `jobs.md`, `remote-job.md`, `spawn.md`, `deploy.md`, `arthur.config.example.ts`) against the implementation; consistent with the code, cover the ticket's offline/grace/refusal wording.
- Confirmed `spec/roadmap.md` untouched by this branch, matching the worker's statement.

FAIL
