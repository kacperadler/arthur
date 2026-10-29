# AR0496 - Review 7

- Job: 2026-10-29-review-a8180493
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 81f06d60ae08930c465112b6aa12bf6023a7ecb1
- Verdict: FAIL

## Final message

**AR0496 review, round 7 (allow-list branch at `81f06d60`): FAIL.** The checks pass. The new allow-list refuses most of what the ticket targets and every review-6 row. But one way of setting `HOME` through `env` still gets past the guard, and three of the four new run-time-name marks can be removed without any test failing.

## Findings

1. **`packages/core/src/worktree-guard.ts:95`: `HOME` set through `env -S` in the attached form still passes the guard.** I called `worktreeRefusal` from a throwaway probe test file (removed afterwards). Run as a shell command:
   - These pass at HEAD: `env -SHOME=../../acme bash -c 'rm $HOME/README.md'`, `env -iSHOME=../../acme bash -c '…'` and `env --split-string=HOME=../../acme bash -c '…'`.
   - The same thing as two words, `env -S 'HOME=../../acme' bash -c '…'`, is refused. That works only because `HOME=` happens to be a word of its own before the command.
   - Why: the env/sudo allow-list skips every word that starts with `-`, and the `HOME|ARTHUR_JOB|PWD` pattern only matches at the start of a word.
   - `env -S` splits its string into assignments and a command, and expands `${VAR}` inside it [INFERENCE, coreutils behaviour; not run, as instructed]. So this is a `HOME` assignment in front of a command that is neither used nor refused, which is the first Done means point. The doc comment at `worktree-guard.ts:71` says such a call "is refused as unknown".

2. **`packages/core/src/shell-words.ts:160`, `:161`, `:166`: three mutations survive.** I removed `mark()` from each of these, one at a time, and the guard tests stayed at 12 pass, 0 fail:
   - the `$` inside double quotes (`:160`);
   - the backtick inside double quotes (`:161`);
   - the unquoted backtick (`:166`).

   These marks are not dead code. With all three removed, the probe showed these going from refused to PASS:
   - `env "$v" bash -c 'rm $HOME/README.md'`
   - ``env `echo HOME=../../acme` bash -c '…'``
   - ``env "`echo HOME=../../acme`" bash -c '…'``
   - `sudo "$v" bash -c '…'`

   No test row has a quoted expansion or a backtick in a word without `=` under `env` or `sudo`. Only the unquoted `$` mark (`:165`) is covered, by `sudo -u root env $v bash`. The review criteria count an uncaught mutation of a key behaviour as a FAIL. This also contradicts the worker's claim that every mutation was caught.

3. **`worktree-guard.ts:95`: a glob in the command position after `env` or `sudo` skips the allow-list.** `env HOM* bash -c 'rm $HOME/../acme/README.md'` and `sudo HOM* …` pass at HEAD. Words without `=` are exempt, and `HOM*` is taken as the command. If the worktree holds a file named `HOME=..`, which a job can create, bash expands the glob to an assignment of `HOME`. AR-D245 asks for plain literal names among the env and sudo arguments. This overlaps a gap that was already there: `env X* bash -c 'rm ../../acme/README.md'` passes at base `bfe01006` too, and the doc lists globs as not seen.

## Notes (not blocking)

- **Equivalent mutation:** `index > from` → `index >= from` survives, but the word at `from` is always the builtin or wrapper itself.
- **New refusals:** `export -f my-func` and `readonly -f my-func` are now refused as unknown, because a function name with `-` is not a plain name. This follows the allow-list, at some cost in usability.
- **F1 still holds:** `local -n r=HOME` passes; F1 in `findings.md` is still open, as the worker says.
- **Checked against the worker's message:** both source files are at 200 lines. `findings.md` uses only made-up names.

## Checks run

- `npm ci`: exit 0.
- `npm run check; npm test` in one bash call (1800 s timeout, 537 s): `CHECK_EXIT=0`, `TEST_EXIT=0`. My summary filter matched no lines, so I have no pass/fail counts; the exit code is 0. No failure in `limits.test.ts` showed up.
- `node --test packages/core/test/worktree-guard.test.ts` at HEAD: 12 pass, 0 fail.
- **Mutations**, guard test file run each time, each change undone with `git checkout -- <file>`:
  - Caught (11 pass, 1 fail each):
    - the `dynamic?.some(named)` check removed;
    - the `<= at` bound changed to `< at`;
    - three variants of the option-exclusion patterns;
    - three variants of the plain-name pattern;
    - `sudo` dropped from the wrapper list;
    - the `target === undefined` condition in `mark` removed;
    - the `!word.includes("=")` condition in `mark` removed;
    - the unquoted `$` mark removed.
  - Survived (12 pass, 0 fail): the double-quoted `$` mark, the double-quoted backtick mark, the unquoted backtick mark, and `>= from` (equivalent).
- **Probe test file** (throwaway, deleted): about 45 command strings run through `worktreeRefusal` at HEAD, and the source files from base `bfe01006` for comparison. Results as quoted above.
- No command from the ticket or the reviews was run in a shell. `git status` is clean.

FAIL