# AR0643 - Outcome

- Merged: 2026-11-12, `dd403666`
- Branch: arthur/2026-11-12-worker-39557d5f
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $4.66, reviews $1.37; review rounds 2

## What went in

- packages/manage/src/release-notice.ts: the daily run; skips a checkout with no release tag at HEAD, lists origin's `v*` tags cut after 30 s, sends one notice per newer release not yet told, keeps the newest told in `.arthur/manage/releases.json`
- packages/manage/src/manage.ts: registers `manage.release` every day at 09:00 through `schedule.register` (`option: "enabled"`) when the schedule plugin is loaded; header comment names it
- packages/manage/test/release-notice.test.ts: tests for registration, the no-schedule load, once-only notices across a restart and an update, version order, the version running here, broken told files, unchecked checkouts, and a failed or cut listing
- packages/manage/test/audit.test.ts: ignores the always-registered `release` entry
- packages/manage/test/cleanup.test.ts: ignores the always-registered `release` entry
- packages/manage/test/retro.test.ts: ignores the always-registered `release` entry
- packages/manage/docs/manage.md: entry 107 in the intro, and a "The release notice" section
- packages/schedule/docs/commands/schedule.md: the `--help` page and the registering rules name entries a plugin always makes, with `option: "enabled"`
- packages/schedule/docs/schedule.md: the intro names entries a plugin always makes (manage's release notice)
- packages/schedule/src/register.ts: the comment names entries made always and the `enabled` convention; no code change
- docs/setup.md: the `schedule` line names entries a plugin always makes
- docs/deploy.md: under "Updating", the daily release notice line
- test/job-gate.test.ts: `arthur schedule` and `schedule list` inside a job now show `manage.release`
- test/structure.test.ts: manage line budget raised from 1535 to 1597

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1731/1802 passed.

## Left open

- Deferred (client summary): F1. `git ls-remote` runs with the inherited environment, without `GIT_TERMINAL_PROMPT=0` or `GIT_ASKPASS=""` (the settings `github-git.ts`'s `quiet()` uses)
