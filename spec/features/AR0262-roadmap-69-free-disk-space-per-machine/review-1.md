# AR0262 - Review 1

- Job: 2026-10-21-review-ar0262-roadmap-69-f7619179
- Branch: h/2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2
- Commit reviewed: f06b608c7774998f22330217e928220d926b23c3
- Verdict: PASS

## Final message

Clean worktree confirmed — all throwaway mutations reverted. Final assessment.

## Findings

None that block merge.

## Notes

- F1 (second ssh call per round, not folded into the AR0149-style single call) is a reasonable improvement, correctly logged as an open finding rather than silently skipped; ticket's Delivers text doesn't mandate a single combined call.
- `host.jobs.home`'s "unknown machine" refusal path reuses the pre-existing `lookup` helper (already covered by `pick`/`run` tests); no dedicated unit test for `home` itself, but behavior is exercised transitively through `disk.test.ts` (home-missing, home-counts cases) and a mutation of the accessor is caught.

## Checks run

- `npm ci`: clean, 21 packages.
- `npm run check`: no errors.
- `npm test`: 907/907 pass (full suite, ~4.5 min), matches worker's claim.
- `node --test packages/resources/test/disk.test.ts`: 7/7 pass in isolation.
- Line budgets verified independently: `packages/resources/src` = 577 lines (matches `BUDGETS.resources`); `packages/core/src` minus `testing.ts`/`fake-agent.ts` (349) = 6084 − 349 = 5735 (matches `BUDGETS.core`); `jobs.ts` = exactly 200 lines.
- Mutation tests (each applied, run, reverted via `git checkout --`):
  - `underFloor`: `<` → `<=` — caught by exact-floor test (room under floor).
  - Filesystem dedup (`seen.has` guard removed) — caught by "two paths on one filesystem counts once" test.
  - Skipped-path branch disabled (`if (line === "missing")` → `if (false)`) — caught, room went to 0 instead of Infinity.
  - "once per fall" `disk-low` dedup removed — caught, got 4 `disk-low` events instead of 3 in hovering test.
  - `floor === 0` gate disabled (always runs df) — caught, disk now shown at floor 0.
  - Home-missing detection disabled (`index === 0` check) — caught, "home not there" test failed (got Infinity instead of 0).
  - Failed-check once-notice gate removed — caught in both `disk.test.ts` and pre-existing `room.test.ts` (duplicate notices emitted).
- Verified `host.jobs.home("local")` resolves via the seeded `local` entry in `machineRegistry`, not a separate code path — read `job-machine.ts` directly.
- Verified path-quoting for `df` over SSH relies on the existing, already-tested `host.jobs.run` quoting (`machine.test.ts:551`, unchanged in this diff) — no new quoting code introduced in `machine-disk.ts`.
- Verified commits: 3 commits, Conventional Commits with `AR0262` scope, all carry `Signed-off-by` trailers.
- Verified ticket.md and spec/roadmap.md untouched by the branch; README/arthur.mmd mark entry 69 as built; docs/plugin-api.md documents the new host member and provided name under "Changes since entry 51".
- Read `findings.md` additions: no secrets, no real client/project names, generic.

PASS
