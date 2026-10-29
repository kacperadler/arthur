# AR0498 - Review 1

- Job: 2026-10-29-review-d6618d6f
- Branch: arthur/2026-10-29-worker-8bf1122a
- Commit reviewed: 7e3bdf69ff3242237505711947e64e0930a329a1
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/worktree-guard.ts:73`: no test checks that env's options before `-S` are kept.** I changed `[...command.words.slice(0, at), ...parse(...)]` to `[command.words[0]!, ...parse(...)]`, which drops every word between `env` and `-S`. All 12 tests in `worktree-guard.test.ts` still passed. Under that change, a throwaway script calling `worktreeRefusal` showed that `env -C <main> -S 'rm README.md'` passes the guard instead of being refused as a write into the main checkout. The only `-C` row the branch adds puts `-C` inside the split string (`-S '-C <main> rm README.md'`). None has `env -C <dir> -S …`. The review criteria count a key behavior whose removal no test catches as a FAIL.
2. **`packages/core/src/worktree-guard.ts:74`: no test checks that redirects survive the re-check.** The new `env -S` path returns before `redirected` is computed. So the redirect check depends on `{ ...command, …}` carrying `writes` into the second `judge` call. I mutated that call to `judge({ ...command, writes: [], … })`. The full test file still passed, and `env -S 'rm x' > <main>/README.md` then passed the guard. One row for an `env -S` call with a redirect into the main checkout would catch this.
3. **`spec/features/AR0498-…/ticket.md:46`: the Decisions line the worker added is not a decision record.** The worker wrote it by hand ("Worker 2026-10-29-worker-8bf1122a: core line budget raised from 6448 to 6460…"). The raise itself is covered by policy (AR-D317), and main's ticket already holds the policy line (AR-D63) at the same spot. The added line should go, and it will likely conflict with main's line on merge. As you instructed, this one does not fail the branch on its own.

## Notes
- **Gaps I tried that are closed:** strings with `\v`, `\f` or `\r` in them. Real `env -S $'echo\vsplit-v'` printed `split-v`, so env splits on these, and the guard splits them too and refuses. Also refused: `-0S`, `-vS`, `--split-str=`, `sudo env -S`, `timeout 5 env -S`, `xargs env -S`, `cd <main> && env -S 'rm README.md'`, a nested `bash -c` inside the string, and `-S''` and `-S ""`.
- **`packages/core/src/command-index.ts:20`: `name === "env"` changes nothing today.** No other wrapper's list has `-S` or `--split-string=`, so replacing it with `true` kept every probe and test result the same. It only protects against a future entry.
- **Things that still pass, harmlessly:** `env -uS 'rm <main>/README.md'` passes. env unsets `S` and runs a command named `rm <main>/README.md`, space included, which does not exist. Likewise `env -S 'rm{,x} …'`: env does not expand braces, so the command is not found.
- **Worker's F1:** filed with `Status: open`, outside this ticket's Scope. The worker's message cites "AR-D305, your instruction" for the HOME/ARTHUR_JOB/PWD rows; that is not in the ticket. It is only data, and those rows are covered either way.
- **Shape:** `worktree-guard.ts` is 183 lines and `command-index.ts` 29, as the worker said. No dependencies, no classes.

## Checks
- `npm ci`: exit 0.
- `npm run check`: tsc, no errors.
- `npm test`, one call with a 1800 s timeout: 1279 tests, 1217 pass, 0 fail, 62 skipped. This matches the worker's numbers.
- `node --test packages/core/test/worktree-guard.test.ts`: 12 pass, 0 fail, about 37 s.
- **Mutations**, each restored with `git checkout --`; the tree is clean at the end:
  - Caught by the tests:
    - Mapping run-time words before the value to their own index instead of `at`.
    - Dropping the `dynamic` remap.
    - Dropping the words after the value.
    - Replacing the `--split-string=` check with `false`.
  - **Not caught:** dropping env's options before `-S` (finding 1) and clearing `writes` in the re-check (finding 2). Both survived the full file.
  - Equivalent mutation: `name === "env"` to `true` changed nothing in tests or probes.
- **Throwaway probe:** a script calling `worktreeRefusal` on about 36 strings under a temporary folder, never run in a shell, then removed. It gave the results listed in the findings and notes.

FAIL