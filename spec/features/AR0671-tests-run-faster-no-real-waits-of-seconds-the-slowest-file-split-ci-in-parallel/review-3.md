# AR0671 - Review 3

- Job: 2026-11-11-review-fad6ce8c
- Branch: arthur/2026-11-10-worker-4b7cab02
- Commit reviewed: 3a41d10aec1dcb4cb5a9255351f6760f25afc43c
- Verdict: PASS

## Final message

No blocking findings. The rate-limit race from review 2 is fixed: after the 429 reaches the fake server, the test waits for two of tool's polls before it moves the clock. `packages/github/src/github.ts:134-136` polls each project in turn and waits for each answer, so tool's next request only goes out after the plugin has read shop's 429 and set its pause. The 60 s hang from review 2 does not come back, even when I delay every 429 by 300 ms or run 12 copies at once.

The other two changes since review 2 match what the final message says:
- **`handoff-extension.ts:20-24`:** the comment now gives `SETTLE_MS` as 4 ticks, 2 s in production.
- **F5 in `findings.md`:** it now counts the settle wait in the compaction test's time and stays open.

The 5 mutate survivors are the same 5 as last round. Each one puts back the production timing plumbing (one is a doc comment, one an unused constant), and no key behaviour depends on them.

## Notes
- (minor) `packages/session/src/handoff-extension.ts:24`: `SETTLE_MS = 4 * TICK_MS` ties a safety margin to the session tick. If someone later lowers `session()`'s default `tickMs` to 375 ms or less, the settle time drops to the inbox's 1.5 s handover or below without any warning, and no test checks the production default.

## Checks (on 3a41d10a, load average 8–22)
- **`npm run check`:** passed. `tsc` printed no errors.
- **`npm test`:**
  - 1742 tests: 1678 pass, 0 fail, 0 cancelled, 64 skipped.
  - `duration_ms` 639 366. Wall 639.6 s, user 1242 s, sys 529 s.
- **`npm run mutate -- --max 25`, first run:** 19 mutants, 14 caught, 5 survived, 6 not run (time).
  - Survivors, each "hunk reverted to the base": `fake-discord.ts:273`, `handoff-extension.ts:20`, `session.ts:39`, `site-check.ts:20`, `uptime.ts:22`.
- **Second run, same command:** 25 mutants, 20 caught, the same 5 survived, none cut by time.
- **Rate-limit test with a throwaway change answering every 429 300 ms late:** passed 3 of 3, 2.5–2.7 s each. Restored with `git checkout`.
- **Rate-limit test, 12 copies at once:** 12 pass, 0 fail, 0 cancelled.
- **Hand mutations of the rate-limit code,** each restored with `git checkout -- packages/github/src`; `git status` clean at the end:

  | Mutation | Result |
  |---|---|
  | `retry-after` × 999 instead of × 1000 (`github-api.ts:106`) | fails: "no request before retry-after" |
  | `x-ratelimit-reset` 2 ms early (`github-api.ts:108`) | fails: "no request before x-ratelimit-reset" |
  | pause check removed (`github.ts:135`) | fails: "no request before x-ratelimit-reset" |
  | `retry-after` × 1001 | cancelled by the test's 60 s timeout |

PASS