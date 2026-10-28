# AR0494 - Review 3

- Job: 2026-10-28-review-2ae4a183
- Branch: arthur/2026-10-28-worker-444ea31a
- Commit reviewed: ee8bf5cb9680a1653dda1452d0756c613862e9e7
- Verdict: PASS

## Final message

No blocking findings. The branch delivers what AR0494 asks for, and it covers the extra row that the ticket's 2026-10-28 decision added.

- **The fix:** `closing()` in `packages/core/src/shell-words.ts:44` now steps over a quoted run with one regex. Inside double quotes it matches `\\.` before `[^"\\]`, so `\"` no longer closes the quotes. The `s` flag makes a backslash-newline count as an escape too. The closing quote is optional, so a quote never closed runs to the end of the text. The file is at exactly 200 lines.
- **The required row:** `echo "${x:-"\""}"; rm ../../acme/README.md` → MAIN is at `worktree-guard.test.ts:311`. It fails before the change: with the old `indexOf` line put back, the file gives 11 pass, 1 fail.
- **The round-3 row:** `` echo "\${x:-'a` `` → `undefined` is at `:316`. Bash agrees: run alone, `"${x:-'}"` is a syntax error ("unexpected EOF while looking for matching `''") and nothing runs.
- **The worker's claims:** everything in the final message matches what I saw. That covers the files, the rows, the commits, F1 in `findings.md` still `Status: open`, and the results below.

## Notes
- The worker also added `findings.md` F1, about `limits.test.ts` timing out under load. This is the commit `a0a43e71` (docs), and findings are meant to go on the worker's branch. F1 did not show up in my full run.
- One mutation survived: `[^"\\]` → `[^"]` passes all 12. It doesn't count as a miss, because the change can't alter behaviour. The regex tries `\\.` first and the match never needs to backtrack, so the result is the same, and that holds for a trailing `\` too.
- The worker already flagged the `$'…'` case inside `${…}` from review 1's notes. It is out of scope here and is not logged as a finding yet.

## Checks
- `npm ci`: exit 0.
- `npm run check` (`tsc`): exit 0.
- `npm test`, output written to a file in my worktree that I then deleted: 1230 tests, 1169 pass, 0 fail, 61 skipped, exit 0.
- Mutations of `closing()`, run with `node --import=@arthur/core/testing --test packages/core/test/worktree-guard.test.ts` (12 tests unmutated):

| Mutation | Pass | Fail |
|---|---|---|
| Old `indexOf` line put back | 11 | 1 |
| `\\.` alternative removed | 11 | 1 |
| Closing `"` made required | 11 | 1 |
| Closing `'` made required | 11 | 1 |
| `s` flag dropped | 11 | 1 |
| `[^"\\]` → `[^"]` | 12 | 0 (cannot change behaviour, see notes) |

  Each mutation was restored with `git checkout -- packages/core/src/shell-words.ts`.
- **Other bypass attempts:** I first ran five commands in bash, and in each one bash ran the command after the `${…}`:
  - `"${x:-"\\"}"`
  - `"${x:-"\$"}"`
  - `"${x:-'\'}"`
  - unquoted `${x:-"\""}`
  - `"${x:-"a\"b\"c"}"`

  I then added each one, followed by `; rm ../../acme/README.md`, as a throwaway row expecting MAIN. The file passed 12 of 12, so the guard refuses all five. Restored with `git checkout`; `git status --short` is clean.

PASS