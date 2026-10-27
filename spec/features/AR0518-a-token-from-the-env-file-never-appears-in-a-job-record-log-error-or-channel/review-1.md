# AR0518 - Review 1

- Job: 2026-10-27-review-e1228f08
- Branch: arthur/2026-10-27-worker-28470be0
- Commit reviewed: b6e61fecc7df6731f414d2beebffe53eae582c25
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/cli.ts:80`: a plugin's setup error prints the token as it is.** `printNames(hide)` (cli.ts:77) only starts after `loadPlugins` returns. If a plugin's `setup` throws, `load()` ends up in this `catch`, and every command then prints `problem` unchanged. I reproduced it with a temporary repo, env file `ARTHUR_ORCHESTRATION_TOKEN=supersecret-value-123` and an `orchestration` plugin whose setup throws `"setup failed with " + host.env.ARTHUR_ORCHESTRATION_TOKEN`:
   - `arthur spawn hello` printed `plugin orchestration: setup failed: setup failed with supersecret-value-123` (exit 1).
   - `arthur help` printed the same line.

   This is the ticket's main case: an error Arthur prints after a plugin call fails, for example a 401 during setup. The Goal says no env value ever appears in "an error Arthur prints". The new doc line (`packages/core/docs/commands/config.md:18`, "in every text an `arthur` command prints, an error included") is therefore wrong, and the worker's message says the same. The test only covers a call that fails after a successful load (`token.check`), so it misses this path.

2. **`packages/core/src/secret-names.ts:11`: no test holds the 8-character limit.** I changed `value.length >= 8` to `value.length >= 9` and `secret-names.test.ts` still passes 2/2. The unit test (`packages/core/test/secret-names.test.ts:104-105`) has values of 7, 13 and 22 characters, but none of exactly 8. The end-to-end token is 30 characters. So a value at the documented limit could go back to leaking with no test failing. The review criteria count an uncaught mutation that moves a limit by one as a FAIL.

3. **`packages/core/src/wrapper.ts:136-137` and `packages/core/src/job-install.ts:16`: a value split across two chunks reaches the record's `log`.** This is the worker's own F1, and config.md:18 says so. The ticket's Goal is "never", and this is a log path the branch rewrites. It is left open as a finding instead of being fixed. Holding back the last `longest - 1` characters of each chunk would close it.

4. **`packages/core/src/jobs.ts:175` (F3): plugin prompt sections still reach the record's `prompt` file unchanged.** The worker left this as a finding because `jobs.ts` is at 200 lines. That reason is real, but the record path stays open against the Goal.

## Notes (not blocking)
- `host.ts:44` only builds `hide` from the variables of enabled plugins. `envFileNames` in the wrapper names every value in the env file. So a value from the env file that belongs to a disabled or unknown variable is named in the job's own writes but not in a task or the CLI's output.
- `wrapper.ts:55` names each string before it is written. A value that only appears in an escaped form (JSON `\"`, `\\`, `\uXXXX`) in the agent's output would get through. Today's token formats (letters, digits, `-`, `_`, `:`) are not affected.
- F2 (a job on another machine) and F4 (the guard lets an exported `GIT_CONFIG_*` through) are recorded and open. F4 is outside this ticket.
- `cli.ts:189`: `notLoaded` was folded onto one line. Behaviour is the same; it looks like it was done to fit the line budget.

## Checks run
- `npm ci`: OK.
- `npm run check`: tsc, no errors.
- `npm test` (gpgSign off through `GIT_CONFIG_*`): 1210 tests, 1149 pass, 0 fail, 61 skipped. This matches the worker's claim.
- `node --test packages/core/test/secret-names.test.ts`: 2/2 pass.
- Mutations, each run against `secret-names.test.ts`:

  | Change | Result |
  |---|---|
  | limit `>= 8` → `>= 7` | caught |
  | longest-first `sort` removed | caught |
  | `printNames` off | caught |
  | event-log replacer off | caught |
  | spawn/continue/block/steer `hide` off (four mutations) | caught |
  | route `hide` off | caught |
  | caption `hide` off | caught |
  | wrapper `save` `hide` off | caught |
  | `hide(said)` off | caught |
  | `isFile` filter in `envFileNames` off | caught |
  | **limit `>= 8` → `>= 9`** | **not caught** |

- The setup-error leak above: a throwaway repo under `/tmp`, with `ARTHUR_JOB` and `ARTHUR_INSTALL` unset. Both commands printed the raw value.
- Every mutation was reverted with `git checkout`, the throwaway files were removed, and `git status` is clean.

FAIL