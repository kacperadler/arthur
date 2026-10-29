# AR0552 - Review 1

- Job: 2026-10-28-review-12c5bb00
- Branch: arthur/2026-10-28-worker-eddb9bac
- Commit reviewed: 286817630565ff12d497d1a9c03d0996fb508bd3
- Verdict: PASS

## Final message

I found no blocking problems. The branch meets the ticket's Done means, with one wording point to note below. Both checks pass once a timing test that failed under load is run on its own.

## Findings
None.

## Notes
- **README "same links" point.** `README.md:67` has a single `media` box (voice, video) that is separate from `chan` (`telegram; discord planned`) and marked `built`. Its only link is the `core <-->|events, commands| FIRST` edge that every first-version plugin box shares. No node in that diagram has a hyperlink. The worker read "the same links as the README's plugin list" as these diagram edges, not as the doc links in the Features list. I accept that reading.
- **Architecture diagram.** `docs/architecture/core-and-plugins.mmd:17-19,82-83`: video now sits beside voice inside `MEDIA`. The `MEDIA` label says it claims voice, audio and video parts. The new edges show `video --> host` asking for `voice.transcribe`, then `host --> voice`. Video is added to the `first` class.
- **Roadmap entry 102.** It sits after entry 81 (`spec/roadmap.md:840`) and has the same fields as the other entries (Package, Delivers, Done means, Depends on, Size, Covers). Its details match `packages/video/src`:
  - the option defaults 5/12/600/300 (`video-options.ts:13`);
  - `collect("voice.transcribe")` (`words.ts:14`);
  - the texts `no sound`, `no speech`, `not transcribed`, `not cut: over maxSeconds` and the `maxSeconds` reply (`video.ts:32-50`).
- **Why 102 and not 99.** The worker says the approved plan of AR0527 holds 99 to 101. That is true: its `plan.md:146-148` names those entries, and its ticket records "Plan approved by the owner" (AR-D203). No other file under `spec/` claims 102. The site's `parseRoadmap` reads the edited roadmap with no duplicate-entry error: 99 entries, 102 at line 840.
- **Vision needs no change.** `spec/vision.md`'s "Where the less obvious parts live" (line 176 on) does not name voice, so it does not need video either. The plugin table already has video at line 80.
- **No code changed in the range**, so there was no behavior to mutate-test.
- **Findings file.** `findings.md` is new on the branch, and each of its three entries is still `Status: open`. Outside the range, the README Features line for voice is out of date because of AR0550; F2 already covers the roadmap side of that.

## Checks run
- `npm ci`: succeeded.
- `npm run check` (`tsc`): exit 0.
- `npm test`: 1257 tests, 1195 passed, 1 failed, 61 skipped, exit 1. The failure was `packages/core/test/limits.test.ts:200`, "an agent that ignores SIGTERM at its limit gets SIGKILL after the grace…", with "timed out waiting for the stop at the budget" after 22 s. A second full test run of mine was going at the same time, so the machine was loaded.
- `limits.test.ts` run alone: 18 of 18 passed, exit 0. The test above passed in 5.6 s, so I don't count that failure against the branch.
- The run that went to the background wrote to two log files in this worktree. I deleted both, and `git status --short` is clean.

PASS