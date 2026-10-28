# AR0534 - Review 2

- Job: 2026-10-28-review-bdd6d5f1
- Branch: arthur/2026-10-28-worker-429e9ac1
- Commit reviewed: 1f77d10dea142481e55f46202d29fc2fa73b83ac
- Verdict: PASS

## Final message

I found no blocking issues. The fix makes `review-needed` stop treating a regex on Node's environment object as a mention of the secrets file, uses the same lookbehind as the core's env guard (as the ticket requires), and every mutation I tried was caught by a test.

**Findings**

None.

**Notes (not blocking)**
- `packages/delivery/src/review-needed.ts:15`: because the lookbehind is the same as the core's, a backslash path to the real file is skipped too. A changed line that reads `C:\proj\.env` gets no review for that reason. The core guard in `packages/core/src/env-refusal.ts:13` has the same gap. The ticket asks for that same lookbehind, so this is noted, not failed.
- The match has no `i` flag, so `.ENV` in capitals is still not caught. That was true before this branch and is outside this ticket, as the worker said.
- Against the ticket:
  - **Lookbehind:** `/(?<![\w.]\\*)\.env\b/` uses the same lookbehind as the first branch of the core's `NAME`.
  - **Test rows:** there are three rows for a regex on `process\.env`: a regex literal, a regex in a string, and a dot before the backslash. Each expects `no review: 2 lines changed; …`. The row `a regex naming the .env file in code` (`/^\.env$/`) still expects `review: the diff mentions .env in src/shop.ts`.
  - **Scope:** only `review-needed.ts` and its test changed.
  - **Commits:** both are Conventional Commits with the ticket id as the scope.
- The worker's claims match what I saw: the two new rows, no further code change, and identical test counts.

**Checks I ran**
- `npm ci`: success.
- `npm run check`: exit 0, tsc reported nothing.
- `npm test`: the harness moved my first foreground run to the background, and I couldn't read its output (the proc broker refused access). I stopped it after confirming its processes ran in this worktree; its exit 143 is not counted. I reran it with output to a log file in the worktree:
  - `ℹ tests 1230`, `pass 1169`, `fail 0`, `cancelled 0`, `skipped 61`, exit 0. These counts match the worker's.
  - I deleted the log afterwards.
- Mutations on `review-needed.ts:15`, each followed by `node --test packages/delivery/test/review-needed.test.ts`:

| Mutation | Tests | Row that failed |
|---|---|---|
| `(?<!\w)` (the code before the fix) | 1 fail | `a regex on process\.env in code` |
| `\\*` → `\\?` | 1 fail | `a regex in a string on process\.env in code` |
| `[\w.]` → `\w` | 1 fail | `a regex with a dot before the backslash on process\.env in code` |
| lookbehind removed | 1 fail | `.env as text in docs and tests only, process.env in code` |

- After each mutation I restored the file with `git checkout -- packages/delivery/src/review-needed.ts`. `git status --short` is clean and line 15 is back to the committed version.

PASS