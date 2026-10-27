# AR0429 - Review 3

- Job: 2026-10-27-review-c0479eba
- Branch: arthur/2026-10-26-worker-71cba7c4
- Commit reviewed: 1de72df4aa5ddee990ceb1e4d2960a10be92db91
- Verdict: PASS

## Final message

## Findings

No blocking findings. Commit `1de72df4` adds three rows, and each one catches the mutation that review 2 said went undetected.

1. **`worktree-guard.ts:54` (`&& "--chdir".startsWith(long[1]!)`)**: I deleted the condition.
   - The new `env --ignore-environment rm ../../acme/README.md` row failed: the guard returned `undefined` where `'the main checkout'` was expected.
   - With the `env` row taken out, the new `sudo --preserve-env rm ../../acme/README.md` row failed the same way. So each row catches the mutation on its own.
2. **`shell-words.ts:136` (`|\{PWD\}` in the heredoc pattern)**: I deleted that alternative. The new row `cd ../../acme; bash <<EOF` / `cd /tmp; rm ${PWD}/README.md` / `EOF` failed: `undefined` where `'the main checkout'` was expected.

This matches what the worker reported, including the line number (54, not 53).

## Notes (not blocking)

- `1de72df4` changes only `packages/core/test/worktree-guard.test.ts`: 3 lines added, no source changed.
- Review 2's other non-blocking notes still apply: escaped `\$VAR` in an unquoted heredoc, `--user root` / `--unset X` followed by their value, and the `--chd` → `--ch` and `\0-` mutations. They are outside this round.
- My first try at the `${PWD}` mutation ran in parallel with the `sudo` run in the same checkout, so its result was mixed up with the other run's edits. I threw it away and reran that mutation alone; the result above is from the clean run.

## Checks run

- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts` at the tip: 14 of 14 pass, exit 0.
- `--chdir` prefix condition removed: fails on the `env --ignore-environment` row.
- Same change with the `env` row removed: fails on the `sudo --preserve-env` row.
- `\{PWD\}` removed from the heredoc pattern: fails on the new `${PWD}` heredoc row.
- Every mutation was restored with `git checkout -- packages/core`; `git status --short` is clean.
- You asked me to keep this narrow, so I did not run `npm ci`, `npm run check` or the full `npm test`. The full suite is the host's run: on `92cdaf06` it gave 1176 pass, 0 fail, 6 skipped; the run on the tip had not finished when you wrote.

PASS