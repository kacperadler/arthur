# AR0518 - Review 4

- Job: 2026-10-27-review-8e191089
- Branch: arthur/2026-10-27-worker-28470be0
- Commit reviewed: fcdaa850e2a5a6303c7d5ffdce56728eb52a01e9
- Verdict: PASS

## Final message

The branch fixes review 3's only finding. The new test in `packages/core/test/machine.test.ts` catches the removed naming at `machine-sync.ts:67`, all checks pass, and every mutation I tried was caught. It can merge as it is.

## Findings

None that block the merge.

- **Review 3's finding is fixed.** The new test, "a sweep's copy of the log a job on another machine appended since the last one names each env value", sweeps once while the job is held at the gate. That first copy writes `synced` with a log size above 0, so the second sweep, after the job ends, appends through line 67. Changing `hide(copy.files.log)` to `copy.files.log` on line 67 now fails this test (9 pass, 1 fail). It passes on the branch as committed.
- **The worker's claims hold.** The worker's table matches what I got for lines 66, 67, 68 and 74. Their test counts reproduce exactly. The only new commit is `fcdaa850`, a test-only change; no production file changed since round 3.

## Notes (not blocking)

- F4 is still open in `findings.md`: the worktree guard refuses `GIT_CONFIG_*=... git commit` but lets the same settings through when they are exported first. It is outside this ticket.
- A value split across two sweeps' copies of a remote log is still not named. `config.md` states this gap, and review 3 noted it.
- `host.ts:44` builds `hide` only from enabled plugins' variables, as earlier reviews noted.
- The core line budget is now 6414. The ticket's AR-D63 Decision entries cover the raise.
- Every changed source file is at most 200 lines (`jobs.ts` and `wrapper.ts` are at exactly 200). The diff adds no runtime dependency and no `index.ts`, `types.ts` or `utils.ts`.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check`: tsc, no errors.
- `npm test`, with `commit.gpgSign` and `tag.gpgSign` turned off through `GIT_CONFIG_*`: 1216 tests, 1155 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's claim.
- Mutations in `machine-sync.ts`, each run against the 10 "another machine" tests in `machine.test.ts`:

| Mutation | Result |
|---|---|
| Line 67, appended log copy not named | caught (1 fail, the new test) |
| Line 66, copied run files not named | caught (1 fail) |
| Line 68, whole log copy not named | caught (1 fail) |
| Line 74, reason not named | caught (1 fail) |
| `syncMachine`'s `hide` replaced with one that changes nothing | caught (2 fail) |

- Mutations elsewhere in the range, each run against `secret-names.test.ts`:

| Mutation | Result |
|---|---|
| `secret-names.ts`: shortest named value raised from 8 to 9 characters | caught (1 fail) |
| `secret-names.ts`: `namedChunks` writes the tail at once instead of holding it | caught (2 fail) |
| `wrapper.ts`: `save` writes without naming | caught (1 fail) |
| `host.ts`: a setup's error passed on without naming | caught (1 fail) |
| `event-log.ts`: the event log's naming switched off | caught (1 fail) |

- Each mutated file was restored with `git checkout -- <file>`, and `git status --short` is empty at the end.

PASS