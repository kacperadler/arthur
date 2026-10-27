# AR0508 - Review 2

- Job: 2026-10-27-review-bc8c068f
- Branch: arthur/2026-10-27-worker-6355f513
- Commit reviewed: 33f76fe7eaac4ea41d80f336b0092d2830444a69
- Verdict: PASS

## Final message

## Findings

No findings block the merge. The branch hides `~/.ssh` from a job's agent, its install and `arthur merge`'s checks, as AR0508 asks:
- **Where it is hidden:** `hidden()` and `stepSandbox` both add `join(homedir(), ".ssh")` (`packages/core/src/job-sandbox.ts:81`, `:117`).
- **Nested hidden paths:** the Python walk now skips any folder at or below a hidden path (`job-sandbox.ts:41`). Without that skip, the walk for an env file inside `~/.ssh` would grant reads on the keys beside it.
- **Not taken from the record:** the path comes from `homedir()`, not from the record, which the agent can write. The new test empties `guarded`, runs `continue`, and the key stays hidden in the second run.
- **`job-record.ts` left alone:** the ticket's Scope makes that change conditional ("if the record's guarded list is written here"). The `guarded` file already has an `ssh` line (`job-place.ts:24`), so no change there is needed.
- **Docs:** `spawn.md`, `docs/deploy.md`, `plugin-api.md`, `plugin.ts` and `merge.md` now say `~/.ssh` is hidden. `deploy.md:44` names the credentials a job can still read outside `~/.ssh`; `findings.md` F2 tracks them.

## Notes (non-blocking)

- `spawn.md:120` still lists "a job reaching the user's own SSH login (`ssh localhost`)" as a limit. Without the key that only works through a password or another stored credential, so the line is slightly stale but not wrong.
- The hidden folder comes from `$HOME` (`homedir()`), while OpenSSH finds the home folder from the user account. A changed `$HOME` would hide the wrong folder; `job-place.ts:24` reads the same source. The worker reported this.
- Every sandbox now limits reads and walks `/`, `/home` and `~`, even for a record with no env file (an old record, or a job on another machine). So a file created directly in `~` during a run can't be read inside the sandbox. `spawn.md` documents this cost in general terms.
- `findings.md` F1 is real and outside this ticket: a job that empties its record's `guarded` file can read the env file after `arthur continue`.

## Checks run

- `npm ci` succeeded, and `npm run check` (`tsc`) reported no errors.
- `node --test packages/core/test/sandbox.test.ts`: 18 tests, 14 pass, 0 fail, 4 skipped. The skipped tests need a Unix socket, which this sandbox refuses. Both AR0508 tests ran.
- `npm test`: 1208 tests, 1147 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's claim.
- Mutations on `packages/core/src/job-sandbox.ts`, each restored with `git checkout --`; the tree is clean afterwards. The tests caught every one:

| Mutation | Result |
|---|---|
| `~/.ssh` removed from `hidden()` | AR0508 test fails: `actual: undefined, expected: 4` |
| `~/.ssh` removed from `stepSandbox` | AR0508 test fails: the merge step printed `FAKE-PRIVATE-KEY` |
| `folder == real or` removed | nested-hidden test fails: `'FAKE-PRIVATE-KEY\nFAKE-PRIVATE-KEY\n'` |
| `startswith` clause removed | nested-hidden test fails: `'refused\nFAKE-PRIVATE-KEY\n'` |
| `hidden()` reads the `ssh` path from the record's `guarded` file instead of `homedir()` | AR0508 test fails: `actual: 2, expected: 4` (the run after `continue` reads the key) |

- Leak scan of the diff and the commit messages for owner paths or names: 0 hits.

PASS