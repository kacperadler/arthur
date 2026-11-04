# AR0623 - Review 1

- Job: 2026-11-04-review-69c283f8
- Branch: arthur/2026-11-04-worker-a260185c
- Commit reviewed: 1aa5d7132cbc456bc9a726a498c197d920c5821e
- Verdict: FAIL

## Final message

I'm failing this branch. It does what the owner asked in AR-D496, but with `probes: []` a saved offline state makes the plugin stop checking every site, for good and without telling anyone.

## Findings

1. **`packages/uptime/src/uptime.ts:95` and `:112`: with `probes: []`, a saved offline state switches monitoring off for good.** On start, `begin()` reads `offline` from `state.json` whatever `probes` holds. After that, every round goes into the offline branch and awaits `answered()`. With no probes, that is `Promise.all([])`, which gives `[]`, and `[].includes(true)` is false, so the round returns. No site is ever requested again and nothing is sent. The offline entry stays in the file, so a restart changes nothing.

   This can happen in real use. The base (AR0620) saved `offline` with `probes: []` through its 2-site check; the old test "with probes: []" did exactly that. So an owner who upgrades in that state, or who sets `probes: []` while offline, loses all uptime monitoring and never hears of it.

   This breaks the Done means point "With `probes: []` there is nothing to tell offline apart". It also contradicts the new line in `docs/uptime.md`: "With `probes: []` ... each site is judged alone".

   I reproduced it with a throwaway test, since removed: a `state.json` holding `{ down: {}, offline: START }`, plugin started with `probes: []`, a site that never answers, `everySeconds: 1`, wait 4 s. Result: `[site.seen("/a"), notices().length, offline]` was `[0, 0, "2026-01-01T00:00:00.000Z"]`.

   The fix: ignore or clear a stored `offline` when `probes` is empty, with a test for it.

## Notes
- (risk) `packages/uptime/docs/uptime.md:66`: with `probes: []`, losing the connection now sends one down notice per site, which goes against the owner's "do not send me any message if machine is offline". I accept the worker's reading: the ticket says "nothing to tell offline apart", the worker flagged it, and the other reading could never leave offline without requesting sites. But the owner should know.
- (minor) The rest is correct against the ticket:
  - Offline sends nothing and emits no `uptime-down`; it writes one log line.
  - While offline, sites are asked 0 times and only the probes are asked; this is tested before and after a restart.
  - When a probe answers, the checks resume silently and a still-failing site needs 2 new failed checks.
  - The docs, roadmap entry 98 and the example config were updated.

## Checks (on `1aa5d713`)
- `npm run check && npm test`: tsc clean. My `grep` dropped the totals from that test output, so I ran `npm test` again: 1536 tests, 1471 pass, 1 fail, 64 skipped.
- The failure is in `packages/discord/test/menu.test.ts` ("no phone commands empties the menu; ..."). Run alone with `node --import @arthur/core/testing --test packages/discord/test/menu.test.ts` it passed 12 of 12. This branch doesn't touch that file and it is the worker's F1, so it does not count against the branch.
- The throwaway test above failed as described. I restored the file with `git checkout -- packages/uptime/test/uptime.test.ts` and `git status` is clean.
- I did not run `npm run mutate`, to save budget. The finding above stands on its own.

FAIL