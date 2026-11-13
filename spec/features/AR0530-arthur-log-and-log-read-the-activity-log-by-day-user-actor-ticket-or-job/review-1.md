# AR0530 - Review 1

- Job: 2026-11-13-review-017fcc52
- Branch: arthur/2026-11-13-worker-38c25313
- Commit reviewed: 71dffb6a67ec0fc4f05684126ffd52f015353187
- Verdict: PASS

## Final message

No finding blocks the merge. The branch builds `arthur log` and `/log` as the AR0527 plan's section 5 and roadmap entry 101 describe. Every filter, the default and `/log` on a channel are tested against the fake host, `/log` including its usage refusals and the 30-line limit. The checks pass and the worker's claims match what I found.

## Notes
- (minor) `packages/activity/src/log-command.ts:33`: a check in `readOnly` is never needed. The `words[0]?.startsWith("/")` part of the `phone-command` branch can be removed and the activity tests still pass 27 of 27. Every channel already sends `route` a text that starts with `/name`: see `telegram/src/poll.ts:84`, `discord/src/receive.ts:80` and `interaction.ts:35`. So the check can never be false in practice.
- (minor) `packages/activity/src/log-command.ts:47`: every `--user` call reads all the kept day files up to `--day`, which by default is 90 files, to collect the user's messages and jobs. It is correct, but the cost grows with `keepDays`.
- (minor) `packages/activity/src/day-files.ts:30`: the one surviving mutant is `hunk reverted to the base`. `lastSeq` going back to its old body behaves the same, because `Object(JSON.parse(...))` and the old destructuring skip the same values. No test can catch it.
- (minor) `packages/activity/test/log-command.test.ts:48`: the fixture's actor names a real OS user, `user:terminal:kacper`, the owner's own account name. A made-up name such as `user:terminal:alice` would keep the committed test about Arthur alone.

## Checks (all on `71dffb6a67ec0fc4f05684126ffd52f015353187`)
- **Type check and tests:** `npm run check && npm test` gave a clean tsc. I re-ran `npm test` on its own to get the totals: exit 0, 1828 tests, 1764 pass, 0 fail, 0 cancelled, 64 skipped. The structure test passed and listed only core, delivery and session files as yellow, so every activity file is green and inside its line budget.
- **Mutation run:** `npm run mutate` ran 100 mutants: 99 caught, 1 survived (the `day-files.ts:30` revert above), 141 not run because of `--max 100`.
- **Hand mutations:** I made six by hand in `log-command.ts`, ran `node --import @arthur/core/testing --test "packages/activity/test/**/*.test.ts"` after each, and restored the file with `git checkout`. Five were caught:
  - a `job-started` counting for `--user` without being on his word: 1 fail;
  - the `/log job` check with no id after it removed: 1 fail;
  - `--user` looking at that day only: 2 fail;
  - the two-word read-only names (`coordinator context`) removed: 6 fail;
  - the `--project` filter removed: 1 fail.

  The sixth, the `/` check in the first note, survived with 27 pass. `git status` was clean afterwards.
- **Stale mentions:** I searched for `arthur log`, `/log` and `entry 101` across the repo. README, `arthur.config.example.ts`, `arthur.mmd`, `docs/architecture/core-and-plugins.mmd`, `activity.md`, `vision.md` and `roadmap.md` all agree with the branch.
- **Not checked:** `npx arthur log --help` printed `unknown command log`, because this checkout has no `arthur.config.ts`. So I did not see the command run through the CLI; the doc page and the run path are covered by the fake-host tests.

PASS