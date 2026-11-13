# AR0651 - Review 1

- Job: 2026-11-13-review-9a56749c
- Branch: arthur/2026-11-13-worker-40659c2f
- Commit reviewed: a4b870aa210b12191555b375870f1756ec2ce177
- Verdict: PASS

## Final message

I found no blocking findings. The branch moves `arthur stats` and the merged-ticket report from manage to stats as plan section 3 / ticket 4 (entry 110) asks. Its output, refusals and exit codes are unchanged. Manage's audit and retro prompts now build their `### Stats` section with `collect("stats.tickets", project, since)`. Without the stats plugin the section reads `none: the stats plugin is not loaded`, and there is a test for this in both audit and retro.

There is one departure from the plan, and the worker's final message explains it. The plan has manage keep a `mergedSince` function. Instead, the same `>=` filter is now written inline at its only caller, `packages/manage/src/audit.ts:76`, and roadmap entries 61 and 110 were reworded to match. Behavior is unchanged, and a test covers it: a ticket merged at the exact second of the audited commit.

The edits outside packages/stats and packages/manage are needed:
- `README.md`, `arthur.mmd`, `docs/setup.md`, `arthur.config.example.ts` and `help.md` would otherwise still say manage provides `arthur stats`.
- `test/job-gate.test.ts` now has to load the stats plugin.

I found no other stale references to manage's `arthur stats`, `mergedSince` or `manage/src/stats.ts`. The ticket's folder has no `findings.md`.

## Notes
- (minor) `packages/stats/test/stats.test.ts:37-38`: the second load calls `plugin.setup` directly instead of going through `fake.setup`. That skips the fake host's piece check and its spawn-during-setup guard. It works for stats, which has no piece, but it is a workaround inside the test helper.
- (minor) `packages/stats/src/stats.ts:75`: only the root test `test/job-gate.test.ts` checks `inJob: true`, and `npm run mutate` does not run that test. I removed the line by hand and that test failed with `stats: arthur stats: refused inside a job …`, so it is covered.
- (minor) `packages/stats/src/tickets.ts:15,31`: two mutants survived (`#{0,6}` and `+2`), both in code moved unchanged. Neither can change the result in practice. The line is trimmed before the test, and a review file starting with a blank line and no `## Final message` is never written.
- (minor) `packages/stats/src/tickets.ts:73` / `packages/manage/src/audit.ts:76`: the merged-since filter now exists in both packages. That is acceptable, since one plugin cannot share a helper with another and the code is short.
- (minor) `packages/stats/src/stats.ts:15`: the one-line `summary` that `arthur setup` shows still mentions only the job and turn records, not `arthur stats`.
- (minor) `spec/roadmap.md:776`: says the test moved "unchanged". The assertions are unchanged, but its setup changed: it imports the stats plugin and the fake host is named `stats`.

## Checks (on `a4b870aa`)
- `npm run mutate`: 100 mutants, 97 caught, 3 survived (the three above); 142 not run because of `--max 100`.
- I made three mutations by hand, and each was caught:
  - removing `inJob: true` from `stats.ts:75` made `test/job-gate.test.ts` fail (1 pass, 1 fail);
  - changing `>=` to `>` in the audit's merged-since filter, and dropping `look.made` from the retro's `stats.tickets` call, made `audit.test.ts` and `retro.test.ts` fail (20 pass, 2 fail).
  
  I restored each file with `git checkout`; `git status` is clean.
- `npm run check`: clean.
- `npm test`: 1806 tests, 1741 pass, 1 fail, 64 skipped.
  - The one failure is in `packages/discord/test/gateway.test.ts` ("a close the gateway never answers…"), a file this branch does not touch.
  - Run alone it passes (8 of 8), so it does not count against the branch.
  - No file the branch changed went into yellow.
- I ran the real CLI in a scratch folder (orchestration, projects, manage and stats, project `shop`):
  - `arthur stats --help` printed the moved page.
  - `arthur stats` printed `Stats of shop: 1 merged ticket …` and exited 0.
  - `arthur stats now` printed the usage line and exited 2.
  - `arthur stats --project nope` printed `arthur stats: unknown project nope; projects: shop` and exited 1.
  - `arthur help` lists `stats`.

PASS