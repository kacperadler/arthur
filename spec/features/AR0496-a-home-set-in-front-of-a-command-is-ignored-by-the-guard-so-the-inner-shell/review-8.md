# AR0496 - Review 8

- Job: 2026-10-29-review-b924d128
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: fd557d0fd84e0dac19c62df4e1c5d9147cd5c454
- Verdict: PASS

## Final message

Round 6 had one job: add tests for the three run-time-name marks in `packages/core/src/shell-words.ts` (`:160`, `:161`, `:166`), as decided in AR-D305. The branch does that, and nothing in the range fails the review criteria.

## Findings

None.

## Notes

- **Commit `fd557d0f`** adds only three rows to `packages/core/test/worktree-guard.test.ts` (`:337`–`:339`): `env "$v" …`, ``env "`echo HOME=…`" …`` and ``env `echo HOME=…` …``. Each expects the unknown refusal. This clears finding 2 of `review-7.md`. The worker's claims match what I saw: no source change in this commit, and each mutation is caught.
- **Two review-7 findings stay open, as decided:**
  - Finding 1, `HOME` set through `env -S` / `--split-string`, goes to AR0498 under AR-D305.
  - Finding 3, a glob as the command after `env` or `sudo` (`env HOM* …`), is not addressed. It already passes at base `bfe01006` (`env X* …`), and AR-D305 limited this round to the three marks. If the owner wants it fixed, it should get its own ticket.
- **Line caps:** `shell-words.ts` and `worktree-guard.ts` are both at exactly 200 lines.
- **`findings.md`:** F1 is still open and uses only made-up names (`acme`).

## Checks

- **Install:** `npm ci` exited 0.
- **Full run:** `npm run check` and `npm test` ran in one bash call (1800 s timeout). Check exited 0. Tests: 1276, with 1214 pass, 0 fail, 0 cancelled and 62 skipped; exit 0. No `manage.test.ts` or `limits.test.ts` failures this time.
- **Mutations:** I removed each `mark()` call one at a time and ran `node --test packages/core/test/worktree-guard.test.ts`. Every mutation was caught with 11 pass and 1 fail:

| Mark removed | Row that failed |
|---|---|
| `:160`, `$` inside double quotes | `env "$v" …` |
| `:161`, backtick inside double quotes | ``env "`echo HOME=../../acme`" …`` |
| `:165`, unquoted `$` | `v=OME; export H$v=…` |
| `:166`, unquoted backtick | ``env `echo HOME=../../acme` …`` |

- **Condition mutations:** each of these was also caught with 11 pass and 1 fail:
  - `target === undefined` removed from `mark`;
  - `!word.includes("=")` removed from `mark`;
  - `|| command.dynamic?.some(named)` removed from `worktree-guard.ts:95`.
- **Cleanup:** every mutation was undone with `git checkout -- <file>`, and `git status --short` is clean. I ran no bypass command from the ticket or the reviews in a shell.

PASS