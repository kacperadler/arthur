# AR0547 - Review 2

- Job: 2026-10-28-review-cc76acec
- Branch: arthur/2026-10-28-worker-1185a1c6
- Commit reviewed: b36b58cdb011c31d06e9629294f19caeddcf538c
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0547 asks: in an assignment, or an argument shaped like one, a `~` right after an unquoted `:` is now handled as if it started a word.

## Findings

None.

## Notes

- **`shell-words.ts:147,194`:** The change records where the last unquoted `:` ended (`colon`). It only counts a `~` there when the word so far starts with `name=`, `name[…]=` or `name+=`. `node -e` probes on `shellCommands` gave:
  - `x=a:~/b` → `x=a:/h/b`
  - `x=a:~acme`, `declare x=a:~1`, `env P=a:~acme ls` → the "cannot tell" marker `\0-`
  - `x=a:"~"/b` → `\~`, so it stays literal
  - `x=a:~-/b` and `x=a:~+/b` → the raw `~-` / `~+`, as after a `=`

  I checked the bash behaviour the test rows rely on. `x=a\:~root`, `x="a:"~root`, `x=a:b~root`, `--x=a:~root` and `a:~root` stay literal; `PATH=a:~root` (as an argument), `x=a=b:~root`, `x[1]=a:~root`, `x+=…` and `x=$y:~root` expand.
- **The file's limit holds:** `shell-words.ts` is exactly 200 lines, the maximum allowed.
- **F1 is logged open in `findings.md`:** `x=a:~-/b` keeps a raw `~-` that the guard's check (`(^|=)~-`) neither replaces with OLDPWD nor refuses when OLDPWD is unknown. This is not worse than the base commit. There the `~-` was a literal `\~-`, and the guard read the value as a relative folder `a:…` in both versions. The ticket's Done means does not name `~+` or `~-`.
- **F2–F4 are logged open:** F3 (`$OLDPWD:x`) was not introduced by this branch and the branch does not change it. F4 means `~:` is refused where bash expands it; that is too strict, not a hole.
- **Commits:** there are 4 commits, one more than this repo's usual 1–3. All are Conventional Commits scoped to `AR0547`.

## Checks
- **`npm ci`:** exit 0.
- **`npm run check`:** exit 0.
- **`npm test`:** 1260 tests, 1198 passed, 0 failed, 62 skipped, exit 0. This matches the worker's numbers. I wrote the output to a file in my worktree and deleted it afterwards.
- **Mutations:** I ran each against `node --test packages/core/test/worktree-guard.test.ts` and restored the file with `git checkout -- packages/core/src/shell-words.ts` after each. `git status` is clean at the end.
  - **M1:** `colon === at` replaced with `false`, so there is no `~` handling after a `:`. Caught: 11 passed, 1 failed.
  - **M2:** the `name=` check after a `:` replaced with `/^/`, so any word counts. Caught: 11 passed, 1 failed.
  - **M3:** `colon` set after every character, not only after a `:`. Caught: 11 passed, 1 failed.
  - **M4:** `colon` never set. Caught: 11 passed, 1 failed.
  - **M5:** a `~` name made to end at a `:`, which reverts the previous review's fix. Caught by the row `echo x > ~-:x`, which returned `undefined` where a refusal was expected. My first try changed only the lookahead, missed the capture, and showed 12 passed; I counted only the corrected run.

PASS