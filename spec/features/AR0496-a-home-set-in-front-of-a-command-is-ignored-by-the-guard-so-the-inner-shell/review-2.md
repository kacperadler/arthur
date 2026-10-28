# AR0496 - Review 2

- Job: 2026-10-28-review-77ce7a7c
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: a0f2d4f58c7d35426ec36c1459ac6c4267d5f3f5
- Verdict: PASS

## Final message

No blocking findings. Both findings from review 1 are fixed, and every forced breakage (mutation) I made in the changed code is caught by the tests.

**Findings**

None block the merge.

**Notes**

- **Brace list in the name still gets through** (`packages/core/src/worktree-guard.ts:95`, `packages/core/src/shell-words.ts:76`): `export HOME{,}=../../acme; bash -c "rm \$HOME/README.md"` and `export {HOME,X}=../../acme; …` both pass `worktreeRefusal`. Real bash deleted `acme/README.md` with each in a temporary `acme/` + `w/x` layout. The guard's header comment already lists "a brace list" under "Not seen", and these are the same kind as the run-time names review 1 treated as not blocking. They belong in F1 of `findings.md`. Adding `{` (and `[`, `*`, `?`) before the first `=` to `mark`'s trigger would close them.
- **Review 1, finding 1, is fixed:** there are rows for `HOME[0]=`, `declare -x`, `typeset` and `readonly`. Removing each from the code now fails the table test.
- **Review 1, finding 2, is fixed in the parser:**
  - **Refused:** `export $v=`, `declare "${v}=…"`, `export H$v=`, `export $(echo HOME=…)`, `local` with a backtick name, `x=1 export $v=…`, `export a=1 $v=…`, `true | export $v=1`, and `bash -c` / `bash <<EOF` wrapping `export \$v=…`.
  - **Pass:** `export FOO=$x`, `export FOO=1 > $log`, `export FOO 2>$log`, `export FOO <<<$x`.
  - **`eval $v=…`** is recorded in F1, as review 1 asked.
- **New refusals:** `export $x` with no `=`, and `export -n $v`, are now refused. The worker's final message names this. It is harmless and errs on the safe side.
- **Outside the range** (one line): `cat <<EOF | sh` followed by `rm ../../acme/README.md` passes the guard; this gap was there before the branch.

**Checks run**

- **`npm ci`:** ok.
- **`npm run check`:** exit 0 (`CHECK_EXIT=0`), in two separate runs.
- **`npm test`:** 1229 tests, 1168 pass, 0 fail, 0 cancelled, 61 skipped, `TEST_EXIT=0`. This matches the worker's numbers.
  - The harness moved my first foreground run to the background, so I stopped it; it had shown 0 failures before that.
  - I reran it writing to `ar0496-review-checks.log` in the worktree and deleted that file afterwards.
- **Mutations:** run in a throwaway copy of the tree under `/tmp`, now removed. Each ran the table test "in a job, each call that writes into the main checkout…"; every one failed it (`pass 0, fail 1`) except the last row, which only the full `worktree-guard.test.ts` run catches (10 pass, 1 fail).

  | Mutation | Result |
  |---|---|
  | `target === undefined` dropped from `mark` | caught |
  | `!word.includes("=")` dropped from `mark` | caught |
  | no `mark` for `$` inside double quotes | caught |
  | no `mark` for a backtick inside double quotes | caught |
  | no `mark` for an unquoted `$` | caught |
  | no `mark` for an unquoted backtick | caught |
  | `(declares && command.dynamic)` removed | caught |
  | `dynamic` refused for every command, not just the five builtins | caught |
  | `typeset` removed | caught |
  | `readonly` removed | caught |
  | `declare` removed | caught |
  | index group removed from the regex | caught |
  | `\|\| declares` clause removed | caught |
  | `ARTHUR_JOB` removed from the regex | caught |
  | `at < 0` removed | caught |
  | `verb !== "git"` removed | caught by the full file |

- **Probe script against `worktreeRefusal`:** 40 commands. Results are as in the notes. Quoted, backslashed and `$'…'` forms of the name, `declare -g`, `builtin declare`, `HOME=(…)`, `declare -a HOME=(…)` and `export --` are all refused.
- **Real bash:** the two brace-list forms deleted `acme/README.md`.
- **Rules:** `shell-words.ts` and `worktree-guard.ts` are 200 lines each. No new dependency, class or enum. The 4 commits use Conventional Commits with the `AR0496` scope. `findings.md` uses only made-up names.
- **Tree:** clean after cleanup (`git status --porcelain` printed nothing).

PASS