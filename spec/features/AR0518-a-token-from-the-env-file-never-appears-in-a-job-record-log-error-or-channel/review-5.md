# AR0518 - Review 5

- Job: 2026-10-27-review-8eab0680
- Branch: arthur/2026-10-27-worker-28470be0
- Commit reviewed: b026be80d195f468cef66f4256bc656ecb09425b
- Verdict: PASS

## Final message

No findings block the merge. The merge with main kept AR0509's bounded sweep copy and kept this branch's naming of every file, log and reason the sweep copies. Every check and every mutation I ran gave the results below.

## Findings

None.

## Notes (not blocking)

- **The merge resolution matches the worker's account.** `packages/core/src/machine-sync.ts` differs from the base `3e5feac5` only in:
  - the comment line at :48;
  - the `{ hide } = bus` binding at :50;
  - `hide(...)` on the copied run files (:61), the appended log (:62), the whole log (:63) and the reason (:70).
  
  Main's async `sshAsync` call with `COPY_SECONDS`/`COPY_CHARS`, its skip when another copy has written since this one asked, and its `logTo < logSize` early `continue` are all kept.
- **Known gap, already documented:** a value split across two sweep copies of a remote log is not named. `packages/core/docs/commands/config.md` says so. AR0509's 256 KiB cut makes such a split a little more likely.
- **Built from enabled plugins only:** the loading process's `hide` (`host.ts:44`) uses only enabled plugins' `...Env` values. The wrapper's uses the whole env file. Earlier reviews noted this too.
- **Lines squeezed for the budget:** `cli.ts:189` folds `notLoaded` onto one line to stay within the budget. `jobs.ts` and `wrapper.ts` are at exactly 200 lines. The core budget is 6414, covered by the ticket's AR-D63 decisions.
- **Changelog:** there is no CHANGELOG entry. Existing entries carry merge commit hashes, so they are written at merge time.
- **F4 is still open** in `findings.md`: an exported `GIT_CONFIG_*` gets past the worktree guard. It is outside this ticket.

## Checks run

- `npm ci`: installed.
- `npm run check`: tsc, no errors.
- `npm test`: 1222 tests, 1161 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's claim.
- **Mutations in `machine-sync.ts`**, each run against the "another machine" tests in `packages/core/test/machine.test.ts`. Every mutation was caught with 9 pass, 1 fail:

| Line | Mutation |
|---|---|
| :62 | appended log copy not named |
| :63 | whole log copy not named |
| :61 | copied run files not named |
| :70 | reason not named |

- **Mutations elsewhere**, each run against `packages/core/test/secret-names.test.ts`. Every one was caught (1 fail):

| File | Mutation |
|---|---|
| `host.ts` | `channel.send` caption not named |
| `host.ts` | `commands.route` reply not named |
| `host.ts` | `spawn` task not named |
| `host.ts` | `steer` text not named |
| `host.ts` | `block` reason not named |
| `host.ts` | `continue` instruction not named |
| `jobs.ts` | prompt not named |
| `wrapper.ts` | final `said` not named |
| `wrapper.ts` | stderr written raw instead of through `namedChunks` |
| `secret-names.ts` | bytes written to stdout/stderr not named |
| `secret-names.ts` | `uncaughtException` handler removed |

- Each mutated file was restored with `git checkout -- <file>`, and `git status --short` was empty at the end.

PASS