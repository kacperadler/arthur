# AR0493 - Review 5

- Job: 2026-10-28-review-3333c495
- Branch: arthur/2026-10-28-worker-7b31d67c
- Commit reviewed: 25957f5973b648f62781f6eeae650a18279baac8
- Verdict: PASS

## Final message

**Findings**

None block the merge. The branch meets every Done means point of AR0493:
- **The rule:** a backslash-newline that does not follow a blank is refused once on the raw text, with the existing unknown refusal. It also covers `$'…'` and anything after a heredoc's `<<`.
- **Rows:** both Goal commands, `$\<nl>HOME`, `<<\<nl>EOF`, the AR0472 heredoc row and the commands from reviews 1–4 are all refused rows, and the ` \<nl>` passing row is there.
- **Docs and size:** the `docs/deploy.md` paragraph names the refusal. `worktree-guard.ts` is at 200 lines, and no boundary or Shape rule breaks.

Both review-4 findings are fixed, and the worker's test, mutation and check numbers reproduce.

**Notes (do not block)**

- **The arithmetic rule misses array subscripts** (`packages/core/src/worktree-guard.ts:78`). The rule only looks for `<<` after `((` or `$[`. An assignment with an array index still hides the next lines from the guard, and bash 5.2 deleted the main checkout's README for each of these, while the guard returned `undefined`:
  - `a[1<<1]=5\nrm $HOME/acme/README.md`
  - `a[1<<1]=5\nrm ../../acme/README.md`
  - `a[1<<1]+=5\nrm ../../acme/README.md`
  - `x=1 a[1<<1]=2 true\nrm ../../acme/README.md`
  
  Base 1d192a2c lets `a[1<<1]=5\n…` through as well, so this is not a regression. None of review-1.md to review-3.md uses it, so the ticket does not require it. The docs only claim the `((`/`$[` cases, so nothing is misstated. It belongs in a new ticket or a `findings.md` entry, which the branch does not have.
- **Already refused or never a write:** a `$'…'` that builds the backslash out of `\x5c`, `\134` or `\u005c` is decoded first, and its inner text then goes through the same check. The `bash -c`, `eval` and `<<<` forms were refused (unknown, or the main checkout when a blank comes first). The guard reports a main-checkout write for `${x:0:1<<1}`, `${a[1<<1]}` and `a=([1<<1]=2)`. Bash does not read `[[ 1<<1 ]]`, `[[ -v a[1<<1] ]]`, `declare a[1<<1]=2` or `let x=1<<1` as arithmetic, so the `rm` never ran.
- **Accepted trade-offs:** `((i++)); cat <<EOF` is refused even though bash would run it, as the worker says. Checking the inner texts goes beyond "checked once on the raw command text", and review 4's notes record that the coordinator accepted it.
- **Docs wording:** the `docs/deploy.md` sentence "So it refuses a `<<` after `((`…" reads as if it follows from the sentence before it. The worker already pointed this out.

**Checks run**

- **`npm ci`, `npm run check`, `npm test`, first run:** the harness moved it to the background and I stopped it, so the ✖ lines it printed come from the kill. I ignored them.
- **`npm run check`, second run** (output to a file in the worktree, since deleted): `tsc` printed nothing, `CHECK EXIT 0`.
- **`npm test`, second run:** tests 1230, pass 1169, fail 0, cancelled 0, skipped 61, `TEST EXIT 0`. This matches the worker's numbers.
- **Guard against bash 5.2:** a throwaway node probe ran each command through `worktreeRefusal` with a hand-built place, then ran it with `bash -c` in a temporary tree. The results are the ones stated in the notes.
- **Base:** I loaded base's `worktree-guard.ts` from `git show` into a temporary file, since deleted. It also lets `a[1<<1]=5\n…` and `((x<<1))\n…` through.
- **Mutations of `worktree-guard.ts`,** each run against `worktree-guard.test.ts`. All eight were caught (`fail 1` each):
  - no `$'…'` case
  - no `$[`
  - no `((`
  - a space-only blank lookbehind
  - `eval` text parsed without the check
  - `bash -c` and stdin text parsed without the check
  - lookbehind removed
  - no heredoc rule
- **`wc -l packages/core/src/worktree-guard.ts`:** 200.
- **Cleanup:** I restored the file with `git checkout --` and removed the probe folder. `git status` is clean.

PASS