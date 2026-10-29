# AR0493 - Review 3

- Job: 2026-10-28-review-f7186b0c
- Branch: arthur/2026-10-28-worker-86ff30bd
- Commit reviewed: 9a16cdf18049e33df55bd5f3662b63d7ce4738fe
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/core/src/shell-join.ts:17-18`: a heredoc delimiter written `$'E'` or `$"E"` still lets an `rm` of the main checkout through.** This bypass is new to this round.
   - `joinLines` works out the delimiter with its own regex, which turns `<<$'E'` into `$E`.
   - `shellCommands` (`shell-words.ts:117`, through `shellWords`) and bash 5.2 both read it as `E`.
   - So `joinLines` treats the lines after the `E` line as the body of a quoted heredoc and leaves them unjoined. `shellCommands` ends the body at `E` and reads `rm $\<newline>HOME/acme/README.md` as the literal relative word `$HOME/acme/README.md`.
   - I added two rows to the guard table, both expected MAIN: `cat <<$'E'\nE\nrm $\\\nHOME/acme/README.md\n$E` and the same with `$"E"`. Each came back `undefined`, so the guard allows them.
   - Run in bash 5.2.21 with `env -i HOME=…`, the same scripts with `rm -v` printed `removed '…/h/acme/README.md'` and `removed '…/h/acme/R2'`.
   - This breaks the ticket's first Done point: remove a backslash-newline wherever bash does, so that `$\<newline>HOME` reads as `$HOME`.

2. **Finding 3 of review 2 was not addressed: three mutations of key behaviour still survive the tests, and each one lets through a command the unchanged code refuses.** I ran each mutation against `worktree-guard.test.ts`, `shell-join.test.ts` and `env-guard.test.ts`: `fail 0` every time. The worker's final message does not mention them, and the test file has no row for any of them.
   - **M25, `shell-join.ts:64`:** change `heredoc.depth <= within.length` to `<`. The guard then allows `cat <<'EOF' $(echo)\na\\\nEOF\nrm $\\\nHOME/acme/README.md`; the unmutated code refuses it.
   - **M28, `shell-join.ts:54`:** change `[out, at] = [out + char, open]` to `at + 1`. The guard then allows ``rm "$\\\n(echo "'")" $\\\nHOME/acme/README.md "'"``; the unmutated code refuses it.
   - **M30, `shell-join.ts:18`:** drop `double!.replace(/\\([$`"\\])/g, "$1")`. The guard then allows `cat <<"E\$F"\na\\\nE$F\nrm $\\\nHOME/acme/README.md`; the unmutated code refuses it.
   - The review criteria count an uncaught mutation of a key behaviour as a FAIL.

**Notes (not blocking)**
- The worker's claims hold: all four commands from review 2 are now refused. With `shell-join.ts` from `e15e7571`, the guard test fails on `rm ${x// #/} $\<nl>HOME/acme/README.md`.
- I checked several readings against bash 5.2.21, and the code agrees with bash on each:
  - a backslash-newline inside backticks is joined, including inside `'…'` there;
  - an unquoted `${x:-$'a\'b'}` prints `a'b`;
  - `"${x:-$'a\'b'}"` is a bad substitution in bash, so it cannot be used.
- The line budget rises from 6414 to 6492 in `test/structure.test.ts`, which AR-D63 allows. `shell-words.ts` is at 200 lines and `shell-join.ts` at 79.
- findings.md F1 (`((x<<1))` read as a heredoc) stays open. The `case … )` inside `$(…)` problem noted in review 2 also still exists; it predates this range.

**Checks run**
- `npm ci`: no errors.
- `npm run check && npm test` with a 1800 s timeout: the harness moved it to the background; it completed with tsc clean, tests 1230, pass 1169, fail 0, skipped 61, matching the worker's numbers.
- A second run, written to a file in the worktree, was redundant once the first finished. I stopped it and deleted the file.
- The bash 5.2.21 runs above, under `/tmp`.
- The temporary guard-test rows for finding 1: both failed with `undefined`.
- The mutation sweep:
  - M25, M28 and M30 survived (`fail 0`).
  - Turning off backslash-newline joining in an unquoted heredoc's body was caught, and so was ignoring `<<-` tab stripping (`fail 1` each).
  - I ran the three surviving mutants with their bypass rows added: each mutant failed on its row, and the unmutated code passed.
- Every mutation and temporary row was restored with `git checkout --`. `git status` is clean and the `/tmp` probe folder is removed.

FAIL