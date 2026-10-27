# AR0472 - Review 1

- Job: 2026-10-27-review-1027b2ed
- Branch: arthur/2026-10-27-worker-75604f27
- Commit reviewed: 294c297a7f3c2d1ebbb17b9078c1994d7d6a8b35
- Verdict: FAIL

## Final message

I'm failing this branch. Both forms from the ticket are refused, and `outer()` matches real bash on every escape form I probed. But one mutation of the main behavior, dropping `$` from the escape set, leaves every test passing. With that mutation in place, two commands get through the guard and delete the main checkout's README when real bash runs them.

## Findings

1. **`packages/core/test/worktree-guard.test.ts:262-269`: the main behavior can be removed without any test failing.** The mutation was to delete `$` from the escape set on `packages/core/src/shell-words.ts:122` (`/\\([$`\\\n])|` → `/\\([`\\\n])|`). After it, `worktree-guard.test.ts` and `env-guard.test.ts` still pass with 0 failures.
   - **Why the tests miss it:** every `\$` row in the new tests uses a variable the guard knows (`HOME`, `ARTHUR_JOB`). The worker's extra substitution step then turns `\$ARTHUR_JOB` into `\` followed by the value, and the inner shell reads `\/…` as `/…`. So the refusal still happens even with escape removal gone.
   - **What the mutation lets through:** I ran these against `worktreeRefusal` and against real bash in a temporary folder.
     - `cd ../../acme; bash <<EOF\ncd /tmp; rm \$OLDPWD/README.md\nEOF`: refused at HEAD, passes with the mutation, and real bash deletes the main checkout's `README.md`.
     - `bash <<EOF\nrm \$x../../acme/README.md\nEOF`: refused at HEAD, passes with the mutation, and real bash deletes it too.
   - **Why it matters:** removing the backslash before `$` is the behavior the ticket asks for ("an escaped variable in an unquoted heredoc"). The review criteria FAIL a branch when a key behavior's mutation goes uncaught. The worker's table of broken conditions never tried this one.
   - **Fix:** add a refused row with an escaped `$` whose variable is unknown, or is `OLDPWD`/`PWD`, such as one of the two commands above.

## Notes (not blocking)

- **Fidelity against real bash:** I compared `outer()` with `bash -c 'cat <<EOF…'` (with `HOME=/h` and `ARTHUR_JOB=/j`) on 14 bodies. These matched exactly: `\$`, `\\$`, `\\\$`, `\\\\$`, `'${ARTHUR_JOB}'`, `"\$HOME"`, `\"`, `\x`, `\'`, a backslash-newline, an escaped backtick, and `a\\<nl>b`.
  - The differences are all expansions that `outer()` leaves for the inner shell, as its comment says: `$HOMEx`, `${HOME:-z}`, `${#HOME}`, `$1`, `$(echo \$HOME)`, `$\<nl>HOME`.
  - One is wrong: `$$HOME` becomes `$/h` where bash gives `<pid>HOME`. That makes the guard over-refuse, not under-refuse, so it opens nothing.
  - Command substitutions in the body are still judged from the raw text by the loop at `shell-words.ts:137`. Rewriting the inner copy only adds refusals.
- **The worker's extra change (expanding `$HOME`/`$ARTHUR_JOB` before the inner shell reads the body)** matches what bash does, including values that contain special characters. The replacer is a function, so `$&` in a value is not interpreted. I found no bypass it opens.
- **Gaps that existed before this branch** (same result at base `5536324`):
  - A backslash-newline right before the delimiter line makes bash read the next lines as body, while the guard reads them as outer commands. So `bash <<EOF\necho a\\\nEOF\nrm \$HOME/acme/README.md\nEOF` passes the guard. I confirmed with real bash that those lines end up in the body. This probably belongs to AR0493 ("removes a backslash-newline wherever bash does").
  - A `HOME=` set in front of the command is ignored: `HOME=../../acme bash <<EOF\nrm \$HOME/README.md\nEOF` passes the guard, and so does the `bash -c` form. Real bash deleted the main README in both cases.
- The worker's claims match what I saw: `shell-words.ts` is 200 lines, and each mutation in their table fails a row.

## Checks run

- `npm run check`: `tsc` finished with no errors.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts`: 11 tests, 11 pass, 0 fail.
- Mutations, each run against `worktree-guard.test.ts` and `env-guard.test.ts`, then restored with `git checkout`:

| Mutation | Result |
|---|---|
| `outer` replaced by identity | caught (`\$ARTHUR_JOB` row) |
| no `$` in the escape set | **not caught (0 fail)** |
| no backtick in the escape set | caught |
| no `\` in the escape set | caught |
| no newline in the escape set | caught |
| newline kept after a backslash | caught |
| no substitution | caught |
| no braced `${name}` form | caught |
| no plain `$name` form | caught |
| `Object.hasOwn` dropped | caught |
| quoted heredocs unescaped too | caught |
| `outer` applied before the `$PWD` replacement | caught |

- Two throwaway probes against `worktreeRefusal` and real bash in an `mkdtemp` folder, at HEAD and with the `$` mutation; results are in finding 1 and the notes. All probe files are deleted, and `git status` is clean.

FAIL