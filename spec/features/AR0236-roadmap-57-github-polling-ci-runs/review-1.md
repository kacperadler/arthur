# AR0236 - Review 1

- Job: 2026-10-20-review-ar0236-roadmap-57-c8b859f7
- Branch: h/2026-10-20-ar0236-roadmap-57-github-6bafb88c
- Commit reviewed: 97a80d12f59eea05dcb54d06fe8a95babae92edd
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `packages/github/src/github-api.ts:68` — the `x-ratelimit-remaining === "0"` branch of `waitUntil` also fires on a successful (`response.ok`) answer per the docs ("An answer with runs that says 0 requests left is used, and the instance waits for `x-ratelimit-reset` likewise"). Mutating it to require `!response.ok` leaves all 6 `github.test.ts` tests passing — this specific sub-path is undertested. Not blocking: the ticket's named rate-limit edge case (a refusal answer waiting as GitHub says) is exercised and mutation-proof via the 403/429 tests; this is a proactive optimization on top of it, not a correctness-critical path (the very next poll would hit the already-tested 403/429 branch anyway).
- F1 in `findings.md` (rerun keeps its run id, so a rerun's end is never retold) is correctly scoped to entry 58 and left open; reasonable.
- Worker's open question to the owner (instance-selection by owner name vs. a future `ci.instance` option) is appropriately non-blocking and doesn't contradict any ticket Decision.

## Checks run

- `npm ci`: clean (18 packages).
- `npm run check` (`tsc`): clean, no output.
- `npm test`: **805/805 pass**, 0 fail — matches worker's claim exactly.
- `node --test packages/github/test/*.test.ts`: **11/11 pass** (~27s) — matches claim.
- Mutation testing (reverted via `git checkout --` after each, confirmed `git status --short` clean):
  - Removed dedupe (`!told.has(run.id)`) → "branch deleted" test fails (duplicate events for run 32). Caught.
  - Disabled first-poll baseline (`known ?? []` instead of seeding from completed runs) → "finished before first poll" test fails (unexpected `ci-finished` for run 11). Caught.
  - Disabled rate-limit pause (removed the `paused` skip) → rate-limit test fails ("no request before x-ratelimit-reset"). Caught.
  - Disabled say-once notice dedupe (`told = false`) → 401 test fails (6 notices instead of 1). Caught.
  - Disabled owner-match instance selection (`accounts[0]` always) → instance-selection test fails (wrong Bearer token for `acme` owner). Caught.
- Verified line budget claim: `wc -l` on the four source files = 79+70+26+135 = 310, matches `test/structure.test.ts` comment and budget entry.
- Verified `remote` (the git URL) is never interpolated into any thrown error message (`grep` over `github.ts`) — only `project.name`, `owner`, `name`, and instance labels appear.
- Verified `host.jobs.list()`'s `branch` field is `""` for read-only kinds (via `packages/core/src/job-records.ts`), matching the `job.branch !== ""` filter in `inPlay()`.
- Spot-checked README/`arthur.mmd` sync (the "mermaid block is arthur.mmd, unchanged" structure test is part of the 805 passing) and the wiring in `test/option-tables.test.ts` (github added consistently with other plugins).
- Confirmed commit is a single Conventional Commit (`feat(AR0236): ...`), signed off.

PASS
