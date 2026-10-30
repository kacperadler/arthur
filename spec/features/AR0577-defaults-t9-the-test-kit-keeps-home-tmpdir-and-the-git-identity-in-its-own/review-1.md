# AR0577 - Review 1

- Job: 2026-10-30-review-20dbb589
- Branch: arthur/2026-10-30-worker-86e8884e
- Commit reviewed: 3ca573d71178978c249dd86cd67899425354c477
- Verdict: PASS

## Final message

The branch can be merged. It does what AR0577 asks, both changes outside the plan's file list are needed, and every check and claim in the worker's message held up when I ran it.

## Findings
None that block the merge.

## The two changes outside the plan's file list
- **`packages/core/src/testing.ts:35`, kit folders now made in `<root>/tmp`: needed.** The job sandbox lets a job write only in `tmpdir()` (`job-sandbox.ts:75`), and with this branch that is `<root>/tmp`. I moved the folders back to `<root>` and ran `sandbox.test.ts` with `testing.test.ts`: 6 failed, including the AR0516 signing test in `sandbox.test.ts`. With the change they pass (35 pass, 0 fail).
- **`test/structure.ts:14`, `test-env.ts` added to `TEST_KIT`: needed.** Without it the 12 lines would count against `core`, not `core/testing`, and the line count would not match the plan's "core/testing +6". `wc -l` gives `testing.ts` 194 (it was 200 on the base), `test-env.ts` 12 and `fake-agent.ts` 151, so 357, the same as the budget in `test/structure.test.ts`.

## Notes
- **The slice half of the SIGTERM test did not run for me either.** `systemctl --user show-environment` fails here too ("Failed to connect to bus: Permission denied"), so the `if (SYSTEMD)` check in that test was skipped. That a signalled child leaves no slice is still unproven. It is plausible, because the signal handler goes through the same exit handler that runs `systemctl --user stop`.
- **The kit's git identity is not fully sealed.** `GIT_AUTHOR_*`, `GIT_COMMITTER_*` and `EMAIL` set in the caller's environment would still win over the kit's identity. The ticket only asked for `GIT_CONFIG_GLOBAL`, so this does not block.
- **`test/report-check.test.ts` passed for me**, so the CI problem fixed by AR0586 does not show up locally.

## Checks I ran
- **`npm ci`:** succeeded (24 packages).
- **`npm run check` and `npm test`, one call, timeout 1800 s:** `tsc` clean; 1329 tests, 1255 pass, 0 fail, 74 skipped. This matches the worker's numbers, and no timing test in `limits.test.ts` failed.
- **New tests against the base kit:** I put the base version of `testing.ts` back and ran `testing.test.ts`. The same four tests the worker named failed (the two signal tests, the `child()` test, and the HOME/TMPDIR/identity test). The tip version passes them all (18 pass, 0 fail).
- **Breaking each behavior in `test-env.ts`** (`testing.test.ts`; each change undone with `git checkout --`):

  | Change | Failing test(s) |
  |---|---|
  | Signal handlers removed | the SIGTERM/SIGINT/SIGHUP test |
  | Only-handler check made always true (`>= 1`) | the "another handler" test |
  | Exit code changed to 1 | the signal test |
  | `HOME` dropped | the identity test |
  | `TMPDIR` dropped | the signal test and the identity test |
  | `GIT_CONFIG_GLOBAL` dropped | the identity test |
  | `SIGHUP` dropped | the signal test |
  | `SIGINT` dropped | the signal test |

- **Clean tree:** `git status --short` was empty after all the changes were undone.

PASS