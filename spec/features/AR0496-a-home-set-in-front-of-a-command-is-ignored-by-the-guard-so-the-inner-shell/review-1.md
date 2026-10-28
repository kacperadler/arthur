# AR0496 - Review 1

- Job: 2026-10-28-review-3a3446cb
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 835474d2ddac93c1950f1a4463af67855e6dc3bc
- Verdict: FAIL

## Final message

The branch fails. The fix blocks every attack the ticket names, and the checks pass. But four of the refusal forms the worker added and claims to cover have no test, and with each one removed, real bash deletes the main README while the tests stay green.

## Findings

1. **`packages/core/test/worktree-guard.test.ts:278-290` (the new rows) against `packages/core/src/worktree-guard.ts:95`: four claimed refusals are untested.** I removed each one in turn and reran `worktree-guard.test.ts`. All four mutations passed (11 pass, 0 fail):
   - Index group `(?:\[[^\]]*\])?` removed from the regex. No row uses `HOME[0]=`, yet real bash deleted `../../acme/README.md` with `HOME[0]=../../acme; rm $HOME/README.md`.
   - `"declare"` removed from the builtin list. Real bash deleted it with `declare -x HOME=../../acme; bash -c "rm \$HOME/README.md"`.
   - `"typeset"` removed. Real bash deleted it with `typeset HOME=../../acme; rm $HOME/README.md`.
   - `"readonly"` removed. Real bash deleted it with `readonly HOME=../../acme; rm $HOME/README.md`.

   The worker's message ("also `+=` and an index", "`export`, `declare`, `typeset`, `readonly` or `local`") and the comment at `worktree-guard.ts:72` both promise these forms. The review criteria count a new behavior with no test, or a surviving mutation of a key behavior, as a FAIL. Each one needs a row that is refused.

2. **`packages/core/src/worktree-guard.ts:95`: a variable name built at run time bypasses the check.** I ran these through `worktreeRefusal` and all three passed:
   - `v=HOME; export $v=../../acme; bash -c 'rm $HOME/README.md'`
   - `declare "${v}=../../acme"`
   - `v=HOME; eval $v=../../acme; rm ~/README.md`

   Real bash deleted the main README with the first one. It is the same open-ended kind as F1 and close to the guard's documented "another `$x`" gap, so I don't count it toward the FAIL. It belongs in F1 of `findings.md`.

## Notes
- Refusing rather than using the assigned value is the smaller of the two options the ticket allows, and the worker explains why. `OLDPWD` really is followed already: `OLDPWD=… bash -c 'cd - && …'`, `export OLDPWD=…; …` and `OLDPWD=…; cd -; …` are each refused as writing into the main checkout.
- The logic sits in `worktree-guard.ts`, not `shell-words.ts`. The ticket's scope allows that, since the refusal text changes, and both files stay at 200 lines.
- 37 other forms I tried are refused, among them `builtin export`, `command export`, `time`, `!`, `if`, a subshell, braces, `env -S`, `env -i`, `nohup env`, `timeout 5 env`, `sudo -E`, `eval "HOME=…"`, a redirect before the assignment, a heredoc to `sh`, `export --` and `\HOME=`. `HOME=… git`, `env HOME=… git` and `HOME=… sudo git` still get the git-config refusal.
- `HOME=/tmp/h npm test` is now refused, as the worker reported.
- Mutation `index < at` → `index <= at` survives, but it is equivalent: the command's own word is never an assignment.

## Checks run
- `npm ci`: ok.
- `npm run check`: exit 0.
- `npm test`: 1229 tests, 1168 pass, 0 fail, 0 cancelled, 61 skipped, exit 0. This matches the worker's numbers. The harness moved my first foreground run to the background, so I stopped it and reran writing to a file in the worktree, deleted afterwards.
- Mutations, each followed by a run of `worktree-guard.test.ts` and `git checkout --`:

  | Mutation | Result |
  |---|---|
  | `\+?` removed | caught (1 fail) |
  | "stands alone" (`at < 0`) removed | caught |
  | `verb !== "git"` removed | caught |
  | only `HOME` matched | caught |
  | `"local"` removed | caught |
  | index group removed | survives |
  | `declare` removed | survives |
  | `typeset` removed | survives |
  | `readonly` removed | survives |

- Ran `worktreeRefusal` on 50 commands in a temporary `acme/` plus `w/x` layout under `/tmp` (removed afterwards); results as in finding 2 and the notes.
- Real bash in the same layout deleted `acme/README.md` with each of the four untested forms and with `export $v=`.
- The tree is clean after restoring.

FAIL