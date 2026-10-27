# AR0508 - Review 1

- Job: 2026-10-27-review-ae770173
- Branch: arthur/2026-10-27-worker-6355f513
- Commit reviewed: 32172e72f984c64493adbdeab44496a1a9ea7354
- Verdict: FAIL

## Final message

**Verdict: FAIL.** One part of the new security fix has no test. Everything else the ticket asks for is done, and the checks pass.

## Findings

1. **`packages/core/src/job-sandbox.ts:42`: a mutation of the new nesting fix is not caught by any test.**
   - The worker added this skip line: `if any(folder == real or folder.startswith(real.rstrip("/") + "/") for real in reals): continue`. Its `startswith` clause stops the sandbox from granting reads inside a folder that sits below a hidden folder.
   - **Mutation:** I deleted the ` or folder.startswith(real.rstrip("/") + "/")` clause. `node --test packages/core/test/sandbox.test.ts` still had 0 failures.
   - **Why it matters:** with that clause gone, the same sandbox gives away a key. Hidden paths `[<home>/.ssh/arthur/env, <home>/.ssh]` with `cat <home>/.ssh/arthur/id` printed `KEY`. With the clause in place, the same command got `Permission denied`.
   - So an env file kept one level down in `~/.ssh` (`~/.ssh/<dir>/env`) would make the keys next to it readable again. The worker gives exactly this risk as the reason for the change, one level higher.
   - **Why the test misses it:** the new test "a hidden path inside another hidden folder unhides nothing of that folder" (`packages/core/test/sandbox.test.ts:113`) only covers the `folder == real` case. There, the env file sits directly in the hidden folder.
   - The review criteria count an uncaught mutation of a key behavior as a reason to fail.
   - **Fix:** add a case to that test with the env file one folder deeper, e.g. `[ssh/sub/env, ssh]` with a key in `ssh/sub`.

## Notes (not blocking)

- **Behavior change:** every job and every merge step now confines reads. This includes jobs on other machines, which before hid nothing. As a side effect, a job cannot read a file created after its sandbox starts directly in `/`, `/home` or `~`. The worker stated this and the docs cover it.
- **Home folder:** `homedir()` follows `$HOME`, but OpenSSH looks up the home folder from the user account instead. If Arthur ever runs with a different `$HOME`, the wrong `.ssh` would be hidden. The `guarded` file's `ssh` line (`job-place.ts:24`) uses the same source.
- **Bypass probes:** each was run against the real `sandboxed()` with a hidden `.ssh` folder; none got the key.

  | Attempt | Result |
  |---|---|
  | `ln` / `cp -l` | `Invalid cross-device link` |
  | `mv` of `.ssh` into the worktree | `Permission denied` |
  | `/proc/self/root/...` | `Permission denied` |
  | `tar` of `.ssh` | `Cannot open: Permission denied` |
  | `ls ~/.ssh` | still lists file names; only the contents are refused |

- The two new findings in `findings.md` (F1: emptying `guarded` before `arthur continue`; F2: credentials kept outside `~/.ssh`) are reasonable. They contain no leaked names.

## Checks run

- `npm ci`: succeeded. `npm run check`: `tsc` gave no errors.
- `npm test`: 1208 tests, 1147 pass, 0 fail, 61 skipped. This matches the worker's numbers.
- The two new tests, filtered by name: 2 pass, 0 skipped, so the sandbox really ran here.
- Mutations on `packages/core/test/sandbox.test.ts`. Every file was restored with `git checkout --`, and `git status` is clean.

  | Mutation | Result |
  |---|---|
  | `~/.ssh` removed from `hidden()` | the AR0508 test fails |
  | `~/.ssh` removed from `stepSandbox` | the AR0508 test fails |
  | `folder == real or ` removed | the nested-hidden test fails |
  | the `startswith` clause removed | **0 failures** (finding 1) |

FAIL