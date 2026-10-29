# AR0438 - Review 1

- Job: 2026-10-29-review-fac58c80
- Branch: arthur/2026-10-29-worker-72685687
- Commit reviewed: 240e82d7c7a4e2be628cb45b295cae7c4fb53dac
- Verdict: PASS

## Final message

The branch can be merged as is. It does what AR0438 asks, using the wording and budget from the owner's decisions AR-D292 and AR-D293, and every check passes when I run it myself.

**Findings**

None that block the merge.

- `packages/core/src/config-check.ts:25-27`: `readConfig` now adds the shell-only line to `env.warnings`. The line is `<name> is set in the shell only; the arthur service does not see it, put it in <envFile>`. It never prints the value and does not make the check fail. Both `arthur config check` (via `configCheck`) and `arthur setup` (via `setup.ts:57`) print these warnings, so the line shows up in both. The wording follows AR-D292, which replaced the ticket's original "a job's arthur" text.
- The "Done means" test is in `packages/core/test/config-check.test.ts`. One variable (`ARTHUR_YOUTRACK_ACME_TOKEN`) is set in the shell only and another (`ARTHUR_YOUTRACK_URL`) is in both the shell and the file; only the first gets the line. Two more cases are covered:
  - a variable of a disabled plugin gets no line;
  - with no env file, every set variable gets the line.

  A test that runs the real CLI checks that the exit code is 0, that the line is first, and that the secret does not appear in the output. The `setup.test.ts` expectations were updated for the new line.
- `test/structure.test.ts:14`: core's budget is 6440 → 6443, as AR-D293 decided. The structure test passes at 6443.
- `packages/core/docs/commands/config.md` lists the line under "Said, without failing the check".
- The two files changed outside the ticket's Scope In (`setup.test.ts` and the structure test) both follow from the change itself.

**Notes**

- If one variable is named by two options of a plugin (for example `tokenEnv` and `urlEnv` both set to `ARTHUR_YOUTRACK_TOKEN`), the warning prints twice. This is cosmetic: I reproduced it with a throwaway config, and the exit code was still 0.
- `checkEnv(config, {})` reads the env file a second time just to learn which variables the file holds. It's cheap and stays inside the budget.
- An env value that is set but empty (`KEY=`) counts as being in the file, so it gets no warning. This matches how `checkEnv` itself treats empty values.
- I did not edit `CHANGELOG.md`, as the worker reported.

**Checks run**

- `npm ci`: exit 0.
- `npm run check` and `npm test`, in one bash call with a 1800-second timeout: check exit 0. Tests: 1274 total, 1212 pass, 0 fail, 62 skipped, exit 0. This matches the worker's numbers. No `limits.test.ts` timing test failed.
- Mutations, each run against `config-check.test.ts` and `setup.test.ts`, then restored with `git checkout`. The tests caught every one:
  - dropping the `shell[...] !== undefined` condition: 3 tests fail;
  - dropping the "not in the env file" condition: 1 fails;
  - inverting the "not in the env file" condition: 4 fail;
  - removing the warning entirely, which is how main behaves: 4 fail.

  After restoring, both files pass and the worktree is clean.
- I ran the real CLI on throwaway configs: the variable set in the shell only, then also in the env file with an empty value. Output was as described above, exit 0 both times, and no value was printed.

PASS