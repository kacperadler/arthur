# AR0025 - Review 2

- Job: 2026-10-16-review-ar0025-machine-st-f065702a
- Branch: h/2026-10-16-ar0025-machine-stop-stee-a6df9ae2
- Commit reviewed: 7fde64c5ca9470ef65df2cc44e33f1f6b71ede7d
- Verdict: PASS

## Final message

The new commit closes the finding, and nothing else in 4105b52..7fde64c is a problem.

**Findings:** none.

**What the new work does:**
- `machine.test.ts:340` now asks `arthur remote-job records` for the log from exactly its current size. It expects `logFrom` equal to that size and an empty `log`. This is the "caught up exactly" boundary the earlier review said no test covered.
- `machine-sync.ts` `unreachable()`: `failed` is renamed `moved`. Behavior is the same.
- `continue.md` now says that for a job on another machine, the `continuing` lock here is released as soon as `arthur remote-job continue` returns.

**Notes:**
- I did not read the full `continue.md` wording, only the diff stat. The diff shows one sentence extended by about 160 characters.

**Checks I ran:**
- `npm ci` finished without error output.
- `npm run check` (`tsc`) exits 0.
- `npm test` passes 304 of 304, with 0 failing.
- Mutation: in `packages/core/src/remote-job.ts` I changed `Number(skip) <= bytes.length` to `Number(skip) < bytes.length` and ran `machine.test.ts`. It now fails with `AssertionError: caught up exactly: nothing new, not the whole log`. I restored the file and `git status` is clean.

PASS
