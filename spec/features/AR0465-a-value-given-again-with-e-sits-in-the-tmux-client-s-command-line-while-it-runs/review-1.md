# AR0465 - Review 1

- Job: 2026-10-27-review-95de6ae2
- Branch: arthur/2026-10-27-worker-1209ec59
- Commit reviewed: b7949308d2f2eb34a4442e9071d7bb4e2ae236ad
- Verdict: FAIL

## Final message

**Findings**

1. `packages/orchestration/src/coordinator.ts:122`: nothing tests that the `update-environment` indices are restored when the start fails. On every path the code itself is correct. `restore` runs right after `made`, whether `refused` was set or `new-session` failed. The calls between `own()` and `restore` are all synchronous, so nothing can come between them. Unsetting an index that was never set does not make tmux fail. But the only test that names a variable in `update-environment` is the AR0434/AR0465 test (`coordinator.test.ts:127-151`), and in it the start succeeds. A grep of `packages/orchestration/test` finds no test that hits `coordinator start failed`, the `set-environment, set-option` refusal, or `update-environment` outside that one test.
   - **Uncaught mutation:** `if (restore.length > 0 && made.status === 0) tmux(coordinator, restore);`. Every test still passes with it, reasoned from the test file because tmux cannot run here.
   - **Effect of that bug:** the coordinator retries every `restartDelaySeconds` while `new-session` keeps failing. Each retry would add one more leftover index, since `free` is recomputed above the old ones. Every later session or attach on that server would then copy the name from its own client.
   - **Why it fails the branch:** the review criteria FAIL a branch on a key-behavior mutation the tests miss, and on happy-path-only coverage. "A name is never left in the server option" is exactly that kind of behavior.
   - **Fix:** in the same test, have the logging `tmux` wrapper exit non-zero once for `new-session … -s coord`. Then assert that the `coordinator start failed: tmux new-session` line was printed and that `show-options -g update-environment` is unchanged before the retry succeeds.

**Notes (not blocking)**
- `coordinator.ts:146-147`: if `show-options` fails while `show-environment` succeeded (the server exiting between the two calls), `free` becomes 0. The name would then overwrite `update-environment[0]`, and `restore` would unset the human's entry there. This is a narrow race.
- The other questions you asked about hold, judged from the code:
  - **No value in any argv:** `given` holds names only, and the values reach tmux through the client's environment. The stale values come back on `show-environment`'s stdout, not in argv. In `cmd-new-session`, the `-e` options are applied after `environ_update`, so the `ARTHUR_*` `-e` values still win.
  - **Free index:** it is the highest existing index plus one, so sparse arrays and an empty array both work.
  - **Mutations the test catches:** going back to `-e NAME=value`, dropping the `set-option`, dropping `restore`, and `free` off by one below.
- While those indices are set, a new session that another client makes on the same server would also copy the name from that client's own environment. This is harmless, and expected from the approach.
- Unix sockets are refused here, so the success-path behavior rests on your host run (15/15 pass), not on a run of mine.
- The worker's note holds: tmux drops any environment entry over 16 KB, so such a value ends up cleared in the session instead of passed on. This is an edge case.
- Budget 2421 is recorded (AR-D165). The doc lines 15 and 25 match the code.

**Checks**
- `npm run check`: exit 0, `tsc` clean.
- `node --test test/structure.test.ts`: 16 tests, 16 pass, 0 fail.
- tmux test: `tmux -S <tmpdir>/s new-session -d …` gave "Permission denied" (tmux 3.4), so no tmux tests or mutation runs could be done here. The mutation results above are reasoned from the test file.
- `npm test`: not run, as you instructed.

FAIL