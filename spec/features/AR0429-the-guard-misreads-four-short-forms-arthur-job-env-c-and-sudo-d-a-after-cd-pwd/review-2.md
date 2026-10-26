# AR0429 - Review 2

- Job: 2026-10-27-review-36dcaaef
- Branch: arthur/2026-10-26-worker-71cba7c4
- Commit reviewed: 92cdaf069b66f9b8c339fac90c7de90a61a2d16f
- Verdict: FAIL

## Final message

This review is unchanged: the job that just finished was my `sleep 100` wait timer, and it printed nothing.

## Findings

1. **`packages/core/src/worktree-guard.ts:53`: no test checks the `"--chdir".startsWith(long[1]!)` condition.**
   - I deleted that condition and `worktree-guard.test.ts` and `env-guard.test.ts` still passed.
   - With the condition gone, any long option of `env` or `sudo` that is long enough is read as `--chdir`, so it takes the next word as the folder and hides the command.
   - A probe under the mutation showed `env --ignore-environment rm ../../acme/README.md` and `sudo --preserve-env rm ../../acme/README.md` passing. The branch and the code before it both refuse them.
   - A row like `env --ignore-environment rm ${main}/README.md` → MAIN would catch it. The review criteria count an uncaught mutation of a key condition as a reason to fail.

2. **`packages/core/src/shell-words.ts:136`: no test covers `${PWD}` in an unquoted heredoc.**
   - I changed `PWD(?!\w)|\{PWD\})/g` to `PWD(?!\w))/g` and the tests still passed.
   - With that change, `cd ../../acme; bash <<EOF` / `cd /tmp; rm ${PWD}/README.md` / `EOF` passes, while bash removes the main checkout's `README.md`.
   - The worker's message says this form is handled. The tests check `${PWD}` only in a here-string and `$PWD` only in a heredoc.

## Notes (not blocking)

- **Escaped variables in an unquoted heredoc:** `bash <<EOF` / `echo x > \$ARTHUR_JOB/result` / `EOF` passes, and so does the same with `\$HOME/acme/README.md`.
  - The outer bash removes the backslash and the inner bash expands the variable; real bash confirmed this.
  - The code before the branch also lets the `\$HOME` form through.
- **Long options followed by their value:** `sudo --user root rm <main>/README.md` and `env --unset X rm <main>/README.md` pass, on the old code too. The value is read as the command.
- **Mutation `--chd` → `--ch` for `sudo` survives.** It does no harm: sudo rejects `--ch` itself because it could mean `--chdir` or `--chroot`, so nothing runs.
- **Mutation of the OLDPWD marker `\0-` → `\0+` survives.** It only matters for `${OLDPWD%…}` inside text a shell reads from its input.
- **Scope:** the added `findings.md` (F1) is consistent with the ticket's Out list. Both source files are exactly 200 lines and `test/structure.test.ts` is untouched.

## Checks run

- `npm ci`: OK.
- `npm run check` (tsc): no errors.
- `npm test`: I started it, then stopped it when you asked me not to run the full suite. Its failures (exit 143) come from that kill. I am going by your result: 1182 tests, 1176 pass, 0 fail, 6 skipped.
- `node --import @arthur/core/testing --test packages/core/test/worktree-guard.test.ts packages/core/test/env-guard.test.ts test/structure.test.ts`: all pass.
- 16 mutations: 12 caught, 4 survived (findings 1 and 2, and the two in the notes). Each was restored after its run.
- Probes: about 45 commands against the branch and 3 against the old code; results as listed above.
- `git status --short`: clean.

FAIL