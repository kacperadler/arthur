# AR0489 - Review 1

- Job: 2026-10-28-review-f3805ea0
- Branch: arthur/2026-10-28-worker-868f32b2
- Commit reviewed: e1153fe865a3b5b913fd4d4d0d971ba37805ac5d
- Verdict: PASS

## Final message

No blocking findings. The fix does what the ticket asks. In `packages/orchestration/src/coordinator.ts`, `literal` rewrites a trailing `;` as `\;` before tmux sees it. It is applied to every argument of `tmux new-session` (around line 126) and to the server's variable names that `own()` passes to `set-environment -u` and `set-option update-environment[n]` (lines 157 and 162). The worker's final message explains the extra `own()` change. The test covers the ticket's own case, `model: "x;"`, and every mutation I tried made it fail.

**Findings**

None.

**Notes (not blocking)**
- **Budget raise:** the orchestration budget goes from 2430 to 2434 in `test/structure.test.ts:34`. The ticket at `860fc38` has no Decision for it, but main now has one: "Raise the orchestration line budget from 2430 to 2434 for AR0489 … (AR-D275)". So the raise is recorded.
- **Escaping matches tmux 3.4:** I fetched tmux 3.4's `cmd-parse.y` (`cmd_parse_from_arguments`, lines 1072–1082). A trailing `;` ends a command and a trailing `\;` becomes `;`, which is exactly how `literal` and the test's `commands()` helper treat them. So the fake-tmux test checks against tmux's real rule, not a copy of the fix.
- **Other ways in, all closed:**
  - `coordinator.tmux.session` is limited to `^[\w-]+$` (`orchestration-options.ts:47`), so the `-t =<session>` calls that `literal` does not touch cannot carry a `;`.
  - The socket goes through `-L`/`-S`, which tmux never splits.
  - The `restore` indices are made by the code itself.
  - A `;` in the middle (`a;b`), an already escaped `y\;` and a lone `;` all reach tmux unchanged.
- **Real-tmux test not run here:** this host refuses Unix sockets. My own `tmux -S rv-tmp/s new-session …` got "error connecting to rv-tmp/s (Permission denied)". The new test "a model ending in ; starts the coordinator on a real tmux…" is skipped, as the worker said.
- **Outside the range:** the AR-D275 Decision on main quotes the owner in Polish.

**Checks run**
- `npm ci`: exit 0. `npm run check`: `tsc`, exit 0.
- `npm test` (written to a log in the worktree, since deleted):
  - Result: tests 1259, pass 1194, fail 3, skipped 62, exit 1. These are the worker's numbers exactly.
  - The 3 failures are the timeouts in `packages/core/test/limits.test.ts`.
  - Run alone, `limits.test.ts` gives tests 18, pass 18, fail 0. So the failures came from load: other worktrees were running `npm test` at the same time.
- Mutations: during the full run, the file I mutated could have been loaded by it, but no orchestration test failed there. Afterwards I re-ran `coordinator.test.ts` and `test/structure.test.ts` on the restored tree: tests 34, pass 20, fail 0, skipped 14 (the Unix-socket tests).
- New fake-tmux test, unmutated: pass 1, the real-tmux one skipped.
- Mutations, each run on its own against the new test, each giving pass 0, fail 1, then restored with `git checkout`:
  - M1: `.map(literal)` removed from `new-session`.
  - M2: `literal` removed from the `update-environment` name.
  - M3: `literal` removed from the `set-environment -u` name.
  - M4: `literal` changed to `replaceAll(";", "\\;")`, which escapes every `;`.
  - M5: a lone `;` left unescaped.
  - M6: only the agent command escaped, not `-c` or the `-e` variables.
- My first M1–M3 runs went in parallel on the same file, so I threw those results away and ran each again alone.
- Throwaway files (`review-npm-test.log`, `rv-tmp/`) are removed, `git status` is clean, and `coordinator.ts` is 166 lines.

PASS