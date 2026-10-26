# AR0373 - Review 2

- Job: 2026-10-26-review-2a12efc8
- Branch: arthur/2026-10-26-worker-9f5b347e
- Commit reviewed: dbc5e690d68a81a92dd5f8412eda4353d5b36a54
- Verdict: PASS

## Final message

Nothing blocks the merge. The stop that review 1 failed the branch on is fixed and tested in `dbc5e690`: an `arthur stop` that comes after the install exited, while a process it forked still holds its output, now ends the job `stopped`, starts no agent, and kills the forked process.

## Findings

None that block the merge.

- **The fix** (`packages/core/src/wrapper.ts:101`): the "the agent had ended already" check now applies only once the agent itself is running (`playing`). Before that, a stop always sets the stop reason, stops the install's process group, and the gate before the agent starts (`failure === undefined && why === undefined`, line 148) keeps the agent from starting.
- **No other gap there:** nothing can interrupt the wrapper between setting `started = true`, starting the install and starting the agent, because no event-loop turn happens in between. A stop can only arrive while the wrapper waits on the install. Time and memory limits during the install go the same way and end the job with their limit as the reason.

## Notes (non-blocking)

- **Stop not awaited when the agent is skipped** (`wrapper.ts:148`): the wait for the stop to finish only happens inside the agent's run, so it is skipped. Picture a stop during the install, on a host with no user manager, where something in the install's process group ignores SIGTERM. The wrapper then writes the job's `state` first, and up to about 3 s later it SIGKILLs that process and writes the matching line into the log after `state`. With a scope, `endScope` kills the process first and nothing is written late. I found this by reading the code, not by running it.
- **Points from review 1 still stand:**
  - The header comments in `jobs.ts:23` and `wrapper.ts:17` are folded into one long line each, which keeps both files at the 200-line limit.
  - The install runs outside the agent's sandbox.
  - `stepRunner` reuses unit names from one merge to the next.
  - F1 (a merge run from inside a job's sandbox always runs its steps bare) is still open, correctly.
- **One test run looked inconsistent:** while I ran the `playing &&` removal against both new install tests together, the first test failed too, but it passed when run alone under the same mutation. Unmutated, the pair passed 3 runs out of 3.

## Checks run

- **Setup:** `npm ci` added 22 packages; `npm run check` (`tsc`) found no errors.
- **Full suite:** I started a full `npm test` before your instruction not to, then killed it. Its failures ("Promise resolution is still pending…") come from my kill and say nothing about the branch.
- **Changed test files**, run with `--import=@arthur/core/testing` as `npm test` does:

| Test file | Pass | Fail | Skipped |
|---|---|---|---|
| `packages/core/test/job-control.test.ts` | 28 | 0 | 2 |
| `packages/projects/test/install.test.ts`, `test/structure.test.ts`, `test/plugin-api.test.ts` | 27 | 0 | 0 |
| `packages/delivery/test/merge.test.ts` (the two new tests, by name) | 1 | 0 | 1 |
| `packages/core/test/scope.test.ts` | 11 | 0 | 11 |

  - The skips in `merge.test.ts` and `scope.test.ts` are the scoped tests: this sandbox has no systemd user manager (`Failed to connect to bus: Permission denied`). The coordinator runs them on the host.
  - The `merge.test.ts` test that passed is the one with no user manager: its steps run bare and it prints exactly one `uncapped:` line.

- **Mutations**, each restored with `git checkout --`; `git status` was clean at the end:

| Mutation | Result |
|---|---|
| Removed `playing &&` (the fix) | Caught: the new test for a stop after the install exited fails |
| Removed `why === undefined &&` from the gate before the agent starts | Caught: both new install tests in `job-control.test.ts` fail |
| Removed `continued ||` in `installStep` | Caught: "a continue installs nothing again" fails |
| Made `job-install.ts` treat exit code 1 as a pass | Caught: the failing-install test fails |
| Removed `cwd: worktree` from the install's spawn | Caught: 5 of the 8 `install.test.ts` tests fail |

  - My first try at the last three mutations overlapped, because I ran them in parallel. I restored the files and ran each one again on its own; the table shows those runs. The `cwd` mutation left a stray `installed` file in my checkout, which I removed.
  - I could not run the merge mutations here (always bare, no `systemctl stop`), since the scoped merge test skips without a user manager.

PASS