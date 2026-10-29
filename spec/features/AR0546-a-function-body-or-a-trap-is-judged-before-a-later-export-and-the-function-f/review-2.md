# AR0546 - Review 2

- Job: 2026-10-29-review-aeaade41
- Branch: arthur/2026-10-29-worker-29e2a868
- Commit reviewed: 9eafd39734a35c52580caea571afd1868608941e
- Verdict: PASS

## Final message

The four commands from review 1 are now refused, and every other range rule I checked holds, so this branch can be merged.

## Findings

None that block the merge.

## Notes

- **Review 1's finding is fixed.** `packages/core/src/worktree-guard.ts:84` now also counts config set in front of a command (`index < at`). All four commands from review 1 are refused. So are other ways of writing the same call that I tried in a throwaway test file:
  - indexed (`XDG_CONFIG_HOME[0]=`) and `+=` assignments, and `$'…'` values;
  - the call inside `{ }`, `if`, `!`, a pipe, `case`, `for`, `while`, `[[ ]] &&`, a subshell, `$( )`, backticks or `<( )`, or after `time` or `env -S`;
  - a function defined by `eval` or reached through another function, a `function f() ( … )` body, and `GIT_CONFIG_PARAMETERS`;
  - a trap followed by `XDG_CONFIG_HOME=… true`.

  These still pass, as they should: `FOO=1 f`, `GIT_CONFIG_NOSYSTEM=1 f`, `XDG_CACHE_HOME=… ls; git status`.
- **The stricter refusal was decided.** The worker says `XDG_CONFIG_HOME=/tmp/h ls; git status` is now refused. AR-D322 asks for exactly that.
- **The budget raise is already recorded.** The ticket on main records the raise from 6460 to 6467 as AR-D321, so that request in the worker's message is already done.
- **Outside the range, one line:** the guard does not read `coproc` at all. `coproc rm -rf <main>/x`, `coproc GIT_CONFIG_GLOBAL=/tmp/x git status` and `f() { git status; }; coproc XDG_CONFIG_HOME=/tmp/h f` all pass. This was true before the branch too, and a real `bash` run showed the function sees `XDG_CONFIG_HOME` under `coproc`.
- **The F1 entry in `findings.md` now covers the `DEBUG` trap case** that review 1 asked for.

## Checks

- **`npm ci`:** it completed.
- **`npm run check`:** `tsc` reported no errors.
- **`npm test`:** 1288 tests, 1226 pass, 0 fail, 0 cancelled, 62 skipped. This matches the worker's numbers.
- **Mutations**, each run against the AR0546 test (plus "config set earlier" for the `worktree-guard.ts` ones) and caught by at least one failing test:
  - `|| index < at` removed;
  - `at < 0` removed;
  - `declares` removed;
  - the second pass removed;
  - the second pass started with `[]` instead of `configured`;
  - the `trap` branch disabled;
  - the `--` handling removed;
  - the subshell around the trap removed;
  - the `function` skip disabled in `command-index.ts`;
  - `index += 2` changed to `index += 1` in `command-index.ts`.

  The worker's three mutation claims hold.
- **Probe file:** a throwaway test file (`packages/core/test/zz-probe.test.ts`) ran 34 + 3 command strings through `worktreeRefusal`, which gave the results above.
- **Cleanup:** the probe file and the backup are deleted, every mutated file was restored with `git checkout --`, and `git status --short` is clean.

PASS