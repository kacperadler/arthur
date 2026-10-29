# AR0494 - Review 2

- Job: 2026-10-28-review-eb5bc13e
- Branch: arthur/2026-10-28-worker-444ea31a
- Commit reviewed: f6c6aa0c45f8cbb3b20d4d29cdb6a77a9f5b7fcc
- Verdict: FAIL

## Final message

I'm failing this branch. The two gaps from review 1 are now covered, and the ticket's case works. But the same kind of gap is still there on the single-quote side of the regex the branch rewrote.

## Findings

1. **`packages/core/src/shell-words.ts:44`: no test catches making the closing `'` required (`'[^']*'?` → `'[^']*'`).**
   - The branch replaced the old `indexOf` logic for both quote kinds with one regex. Review 1's finding 2 was this mutation's double-quote twin, and only that side got a test row (`'echo "${x:-"a'`).
   - With the single-quote mutation, a single quote that is never closed inside a `${…}` or `$(…)` makes `exec` return `null`. The `!` then turns that into `TypeError: Cannot read properties of null (reading '0')`.
   - I checked this with `shellCommands`: `echo "${x:-'a`, `echo ${x:-'a` and `echo $(echo 'a` all throw under the mutation. With the branch's real code all three parse.
   - Under the mutation, `worktree-guard.test.ts` + `shell-words.test.ts` still give 12 pass, 0 fail, and the whole core suite gives 475 tests, 455 pass, 0 fail.
   - The review criteria count an uncaught mutation of a key behavior as a FAIL, and review 1 counted this exact mutation on the `"` side as one.
   - Fix: add one row, e.g. `["bash", { command: "echo \"${x:-'a" }, undefined]`. Bash rejects that command with exit 2 (`unexpected EOF while looking for matching '''`), so no refusal is correct.

## Notes (not blocking)

- **The ticket's case is fixed.** `echo "${x:-"\""}"; rm ../../acme/README.md` is refused naming the main checkout, and the backslash-newline row is now covered.
- **The worker's bash claim holds.** `x=; echo "${x:-"\⏎"}"; echo AFTER` printed an empty line, then `AFTER`.
- **Each mutation the worker reports reproduces** (see Checks).
- **`shell-words.ts` is at 200 lines,** exactly the cap.
- **`findings.md` (F1, `limits.test.ts` timing)** is outside the ticket's Scope list but follows the findings workflow. F1 did not reproduce in my full run.
- **The `$'…'` bypass from review 1's notes still isn't logged in any `findings.md`:** `closing()` ignores `\'` inside `$'…'`, so `echo $(echo $'\'')'); rm X` hides `rm X` from the guard. The worker hands it to the coordinator.

## Checks run

- **`npm ci`:** exit 0.
- **`npm run check`:** exit 0.
- **`npm test`:** 1230 tests, 1169 pass, 0 fail, 61 skipped, exit 0. Output went to a file in the worktree, which I deleted afterwards.
- **Mutations of `shell-words.ts:44`**, run with `worktree-guard.test.ts` + `shell-words.test.ts`:

| Mutation | Pass | Fail | Caught? |
|---|---|---|---|
| None (real code) | 12 | 0 | — |
| Closing `"` required | 11 | 1 | yes |
| `s` flag removed | 11 | 1 | yes |
| Escape part removed (`"[^"]*"?`) | 11 | 1 | yes |
| `- 1` removed | 11 | 1 | yes |
| Closing `'` required | 12 | 0 | **no** (finding 1) |
| Closing `'` required, whole core suite | 455 of 475 | 0 | **no** |

- **Bash:** `echo "${x:-'a` exits 2 with a syntax error.
- **Restore:** every mutation was undone with `git checkout --`, and `git status --short` is clean.

FAIL