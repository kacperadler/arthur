# AR0643 - Review 2

- Job: 2026-11-12-review-7ff043ed
- Branch: arthur/2026-11-12-worker-39557d5f
- Commit reviewed: 7fdb80f0e11a8811cf4b1cc0c36b1b9e55abdb05
- Verdict: PASS

## Final message

The branch can merge. It fixes review 1's only finding. It meets every point of entry 107's Delivers and Done means, and each is tested. The checks pass on the tip, and the mutants that survive change nothing a user sees.

## Findings
None.

- **Review 1's finding is fixed (commit 7fdb80f0).** Four places now say a plugin can register entries "always", not only from its options:
  - `packages/schedule/docs/commands/schedule.md:5`, which is the `arthur schedule --help` page.
  - `packages/schedule/docs/schedule.md:3`.
  - `docs/setup.md:71`.
  - The comment at `packages/schedule/src/register.ts:6-11`.

  Searching the repo for the old wording finds nothing else stale. The two lines left as they were are the ones the worker names, and both are still accurate.
- **What the ticket asks for, point by point:**
  - **The entry:** `manage.ts:79` registers `manage.release` every day at 09:00 through `schedule.register`. It is registered after the schedule plugin, because manage declares `after: ["schedule"]`.
  - **The check:** it runs `git ls-remote --tags --refs origin 'v*'` in `host.code[0]`, cut after 30 s.
  - **The notice:** one per release, in the exact text the roadmap gives.
  - **What was told:** kept in `host.folder/releases.json`, which the core creates before setup. It is written to a temporary name and then renamed.
  - **Told once, after a restart too:** tested.
  - **A checkout not at a tag, or a core outside Git:** not checked. The test points origin at a folder that doesn't exist, so a check that wrongly went ahead would fail it.
  - **Without the schedule plugin:** nothing is checked and the load goes on. Tested.
- **Budget:** the worker names the new number, `manage` 1535 → 1597, as Done means requires. No manage file is yellow.
- **Docs:** `manage.md` has a new "The release notice" section, and `docs/deploy.md` mentions the notice. No new option, so `arthur.config.example.ts` doesn't change.

## Notes
- (risk) `packages/manage/src/release-notice.ts:19`: `git ls-remote` runs with the inherited environment, without `GIT_TERMINAL_PROMPT=0` or `GIT_ASKPASS=""` (the settings `github-git.ts`'s `quiet()` uses). On a tty, an origin that asks for credentials can open a prompt that waits until the 30 s cut. The worker says no test can pin this; review 1 raised it and it never went into `findings.md`.
- (minor) `packages/manage/src/release-notice.ts:21`: the surviving mutant that drops `|| error.message` only matters when git fails with nothing on stderr. The other four survivors (lines 41, 42 and two on 49) are equivalent: the result a user sees is the same.

## Checks (all on 7fdb80f0, clean tree)
- `npm run check`: tsc exited 0.
- `npm test`: tests 1802, pass 1738, fail 0, cancelled 0, skipped 64. The structure test passes; the yellow files it lists are all in core, delivery and session, not in manage.
- `npm run mutate`: 82 mutants, 77 caught, 5 survived. The survivors are the same five the worker reports: `release-notice.ts:21` (`|| error.message` dropped), `:41` (`if (core === undefined) return` deleted), `:42` (`HEAD` dropped), and `:49` (`> 0` changed to `>= 0`, and to `> -1`).
- Searched the whole repo with `git grep` for the old "from their/its own options" wording: only the updated lines and `schedule.md:35`, which the branch rewrote, matched.

PASS