# AR0547 - Review 1

- Job: 2026-10-28-review-6c536fee
- Branch: arthur/2026-10-28-worker-1185a1c6
- Commit reviewed: ab454a85234d2cc3e7f809e34add0a1da6f68d1c
- Verdict: FAIL

## Final message

I'm failing this branch: it opens a new hole in the worktree guard. Cutting a `~` name at `:` lets `echo x > ~-:x` through on this branch, while the base commit refuses it, and bash then writes into the main checkout.

## Findings

1. **`packages/core/src/shell-words.ts:194`: `~-:` at the start of a word now gets past the guard.**
   - **What changed:** the branch's "one extra change" ends the name after a `~` at a `:` as well as at a `/`. So `~-:x` now gives the name `-`, and the parser keeps the word raw as `~-:x`.
   - **On the base commit:** `[^/\s…]*` took in all of `-:x`, so the parser returned `\0--:x`. The guard refused that as "cannot tell".
   - **Why the guard misses it:** the guard only knows a raw `~-` when a `/` or the end of the word follows it.
     - `located` (`worktree-guard.ts:76`, `/^~-(?=\/|$)/`) does not match `~-:x`.
     - Neither does the OLDPWD check (`worktree-guard.ts:94`, `(^|=)~-(\/|$)`).
     - So `~-:x` is read as a relative path inside the worktree.
   - **What bash does:** it expands `~-:x` to `$OLDPWD:x`. I ran this in a temp folder: `cd acme/sub; cd wt; echo x > ~-:x` created the file `acme/sub:x`, inside the main checkout.
   - **Guard results, from a throwaway script calling `worktreeRefusal`:**

     | Command (after `cd <main>/sub; cd <worktree>;`) | Base, f5da297 | This branch |
     |---|---|---|
     | `echo x > ~-/x` | refused (main checkout) | refused (main checkout) |
     | `echo x > ~-:x` | refused (OLDPWD unknown) | **allowed** |
     | `rm ~-:x/../README.md` | refused | **allowed** |

   - **Not affected:** `~+:x`. The guard's `here` replaces every unescaped `~+` with the current folder, so that path is still checked.
   - **Missing from the branch:** no test row covers `~-:` at a word start, and neither finding mentions it. F1 only covers `~-` after an assignment's `:`.
   - **Fix:** either keep `~-:`/`~+:` as the "cannot tell" marker in the parser, or let `located` and the OLDPWD check accept `:` as an end too (`(?=[/:]|$)`). Either way, add a refused row.

## Notes
- What the ticket asks is met. `x=a:~acme/y; echo x > $x` is refused, the quoted `x=a:'~acme'/y` passes, and the edge rows match what bash prints.
- F1 (`x=a:~-/b`) is logged correctly. The value starts with `a:`, so it is a relative path, and the guard result is the same on base and on this branch.
- F2 (a quoted name before `=`) is logged correctly: it makes the guard refuse too much, never too little. The same goes for `x"="a:~root`: bash keeps that `~` literal (I checked), but the parser still reads `x=` as an assignment.
- `shell-words.ts` is 200 lines, which is at the limit.

## Checks
- **`npm ci`:** exit 0.
- **`npm run check`:** exit 0.
- **`npm test`, run twice:** 1260 tests each time, 1198 passed, 0 failed, 62 skipped. That matches the worker's numbers.
  - The first run overlapped a one-second swap of `shell-words.ts` to its base version for the guard comparison above.
  - The second run started earlier, so the same swap fell inside it too.
  - Both runs passed, and no file is changed now.
- **Mutations:** I ran `worktree-guard.test.ts` once per mutation and restored the file each time with `git checkout`. Each run had 1 failing test out of 12, so all four are caught:
  - `colon === at` replaced with `false`.
  - `:` removed from the characters that end a `~` name.
  - `colon` set to `at` instead of `at + 1`.
  - The assignment test after `:` replaced with `/^/`.
- **Bash probes:**
  - `~-:x` gives `/tmp:x`.
  - `~:/b` gives `$HOME:/b`.
  - `~root:b` gives `/root:b`.
  - `x=a:~-/b` gives `a:/tmp/b`.
  - `x"="a:~root` stays literal.
- **Parser output, base against this branch:** `echo x > ~-:x` gives `\0--:x` on base and `~-:x` on this branch.
- Temp folders, the throwaway script and the log file are deleted. `git status` is clean.

FAIL