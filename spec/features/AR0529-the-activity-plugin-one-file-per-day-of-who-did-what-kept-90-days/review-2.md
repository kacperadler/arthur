# AR0529 - Review 2

- Job: 2026-11-07-review-3d05567d
- Branch: arthur/2026-11-06-worker-d652f2fb
- Commit reviewed: c4f95060979458545debdd452a755ed7a769f2a3
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The fix for review 1 holds: the one-event gap test fails under the `next > last + 2` mutation, and the `keepDays` cap stops the crash at start.

## Findings
None.

What I checked against the ticket's Done means and the AR0527 plan (§2 to §4):
- **Events:** the plugin subscribes to a fixed list of 23 events: the plan's list plus entry 99's `command-ran`, `phone-command`, `schedule-fired` and `run-started`, which exist in core and schedule (`cli.ts:50`, `plugin-host.ts:110`, `run.ts:73`, `sweep.ts:39`). `job-state` is logged only when it goes to `blocked` or `ended`.
- **Line shape:** `{ seq, time, actor, on?, plugin, what, project?, ticket?, job?, kind?, text, cut? }`, as the plan sets it.
- **Text:** cut by code point, and `cut` is set only above the limit. Media parts never show their path. A forward becomes `[forwarded, N chars]`; the `^`-anchored mark matches how both channels build their text parts: telegram `media-in.ts:36` puts the mark at the start of each part, discord `receive.ts:84` at the start of the joined text. A pull request review's body is left out.
- **Writing:** the day is taken in `core.timeZone`. Only `start` writes. A replay is skipped by `seq`. A gap is read from the log once. A cut last line gets its line break first. Retention runs at `start` and at the first line of each new day.
- **Tests:** there is one for each Done-means point: each event, the cut, a forward, the day boundary, the replay, a gap of one and of several events, a cut last line, and retention.
- **Boundaries:** the plugin imports only `@arthur/core` exports, its state stays in its own folder, and there are no runtime dependencies. The source files are 91, 79 and 52 lines, all green. The budget is `activity: 350`.
- **The worker's claims:** each one matches the diff and what I ran.

## Notes
- (minor) README.md:31: the README says "One line per package", but activity has no line. The README is at its 120-line cap; this is already F1 in `findings.md`, and review 1 rated it the same way.
- (minor) packages/activity/src/activity.ts:7: the comments and the plugin's page cite "spec/roadmap.md, entry 100", which does not exist yet; `roadmap.md:19` only holds 99 to 101 for it. The diagrams have no `activity` node either. Both are already F2.
- (minor) packages/activity/docs/activity.md:46: the page says the log is read when the first held event is not the next number. The log is also read when nothing is held but a line was already written (`next` falls back to `Infinity`), as the test at `activity.test.ts:104` shows.
- (minor) arthur.config.example.ts:28: the `// first, named` tag guesses where entries 99 to 101 go, which AR0527 left open (noted in F2).
- (minor) arthur.config.example.ts:376-381: the 7 mutate survivors are in the example config, which no test loads.

## Checks (on c4f95060)
- `npm run check`: tsc clean.
- `npm test`: 1613 tests, 1549 pass, 0 fail, 0 cancelled, 64 skipped. The structure test passes. No activity file is yellow; the 7 yellow files it lists are all outside this branch.
- `npm run mutate`: 25 mutants, 18 caught, 7 survived (all in `arthur.config.example.ts:376/380/381`), 255 not run (`--max 25`), so it never reached the plugin's source.
- I ran 22 hand mutations against the activity tests (`node --import @arthur/core/testing --test packages/activity/test/*.test.ts`), each restored afterwards; `git status` was clean. **All 22 were caught.** They covered:
  - **Writing and replay:** the replay skip `<=` → `<`; writing before `start`; the sort removed; `last` never advanced.
  - **Gap and retention:** the gap check without `last !== undefined`; prune on every line; the start prune removed; the prune boundary `<` → `<=`.
  - **Line contents:** the time zone replaced by UTC; the job's ticket taken from `tickets[1]`; the `job-state` filter allowing `ended` through; the forward mask disabled; the cut `>` → `>=`; whitespace kept; `Math.round` → `Math.floor`; the actor fallback; `on` dropped; the job-started ticket fallback dropped.
  - **Day files:** the cut-line check forced; oldest file first; the last line instead of the max; `Number.isInteger` → `typeof number`.
- Throwaway smoke with the fake host: a held event from 2025-12-01 and one from today were delivered before `start`. Only today's file remained after `start`; the old file was pruned as soon as a newer day's line followed.
- I tried `npx arthur doctor` in a temporary folder to see the option refusals as a user would. It is refused inside a job. I read the message format instead: `host.ts:126` builds `<config>: activity.<path>: <problem>`, which matches `docs/activity.md`.

PASS