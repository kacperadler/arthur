# AR0562 - Review 1

- Job: 2026-11-02-review-70acf07f
- Branch: arthur/2026-10-29-worker-868301bd
- Commit reviewed: fac1ae5ff548c1cea9d9bc730e7fb7411bab6c62
- Verdict: FAIL

## Final message

The branch does what the ticket asks, and `npm run check` and `npm test` pass. It fails on one point: a throwaway script was committed at the repo root and the worker's final message never mentions it.

## Findings

1. **`propose.tmp.ts:1-43`: a scratch script is committed at the repo root.** It came in with `3ddf369e` and is outside the ticket's Scope. It is a manual test script: it builds a fake `acme` project, records three budget asks, runs `arthur repeats`, then splits the printed `class propose` line with `sh` and runs it. It is not under `packages/*/test/` and is not part of `npm test`. It also imports `./packages/manage/src/manage.ts` and `./packages/orchestration/src/orchestration.ts` by file path, which the package boundaries forbid. The review criteria fail a diff that changes something outside the instruction without a reason in the final message, and the cleanup rule says throwaway scripts must be removed. The final message says "The tree is still clean at `fac1ae5f`" and lists no such file. The fix is to delete it in a commit. If the check it does (the proposed line runs as written) is wanted, it belongs as a test in `packages/manage/test/repeats.test.ts`.

## Notes
- (minor) `test/structure.test.ts:27-33`: the manage budget goes from 931 to 1262 and orchestration from 2434 to 2440. Both are well over the ticket's estimates (+190, +5). Per your instruction I judged the code, not the raise: it is your open decision AR-D444.
- (minor) `packages/manage/src/repeats-issues.ts`: this new file is not in the Scope's list of files. It is split out of `repeats.ts`, which keeps both files green (73 and 157 lines).
- (minor) `packages/manage/src/repeats-command.ts:32`: `--since` together with `--retro` exits 2 with the general usage line, which does not say that the two flags cannot be combined.

## What the diff covers
I checked each Done means point against the code and the test names in `packages/manage/test/repeats.test.ts`; all are present:
- **`arthur repeats`:** takes `--project`, `--since` (a date or a decision id) and `--retro`. Wrong usage exits 2.
- **The digest:** has its sections, the issues from ticket history, and a test over this repository's own log, AR-D1 to AR-D335.
- **`/repeats`:** sends the digest as a page in the report style, with red only for the overrides and the loose matches.
- **`/repeats retro` and `--retro`:** start the existing retro kind, and its prompt holds the digest of its period. A test shows that `/retro` alone starts no job.
- **Roles and criteria:** they allow `Kind: class` and the code-default exception.
- **Coordinator role:** gets its one line.
- **orchestration:** provides `decision.entries`. It throws for an unknown project or a log line broken by hand, and a test covers that.

## Checks run
- `npm ci`, then `npm run check`: tsc passed.
- `npm test`: 1320 tests, 1258 passed, 0 failed, 62 skipped. The skipped tests need tmux, which cannot start on this host (EACCES on a Unix socket). This matches the worker's numbers.
- `npm run mutate`: not run, because the script does not exist on this branch's base. Per your instruction this is not counted against the branch.

FAIL