# AR0498 - Review 2

- Job: 2026-10-29-review-b92060b6
- Branch: arthur/2026-10-29-worker-8bf1122a
- Commit reviewed: 6f47403895740fdbab8c070bda6b6df156073fad
- Verdict: PASS

## Final message

No blocking findings. The branch closes the gap the ticket describes: the string `env -S`/`--split-string` splits is now read as the start of the command, with the words after it appended. If that string holds a character that env reads differently from bash, the call is refused as unknown. All three findings from the previous review are fixed.

**Findings**

None.

**Notes (do not block the merge)**

- `env -S "$(echo rm ../../acme/README.md)"` passes the guard. This is the documented limit "a path built at run time" (`worktree-guard.ts:48`), the same as a bare `$(…)` command, so I don't count it against this branch. The probes `env -S "$(echo -C ../../acme)" rm README.md`, `env -S "$v" rm …` and `env -S $v rm …` are all refused as unknown.
- `env -S 'cd ../../acme'; rm README.md` is refused, although `env` running `cd` does not change the shell's folder. This is too strict, not a bypass. Base reads `env cd` the same way.
- Probes refused as the main checkout: `sudo env -S '…'`, `timeout 5 env -S '…'`, `env -vS '…'`, `env --split-str='…'`, `env -S 'bash' -c 'rm …'`, `env -S 'sh -c "rm …"'`, `env -S 'git -C ../../acme commit -m x'`, `env -S'-iC../../acme' rm README.md`, `env -S 'cat' > ../../acme/README.md`. A vertical tab, form feed or carriage return as the separator (the real GNU env 9.4 splits on all three) is refused too: with `$'…'` as unknown, with the raw character as the main checkout.
- These pass the guard, and the real commands write nothing in the main checkout: `env -C /tmp -S 'rm README.md'` and `env -u -S 'rm …'` (`-u` takes `-S` as its value).
- Changing `name === "env"` to `name !== "sudo"` in `command-index.ts:20` is not caught. I take it to be an equivalent mutation, since no other wrapper lists an `S` or `--split-string` option.
- Moving `WRAPPERS`, `RESERVED` and `commandIndex` into `command-index.ts` keeps `worktree-guard.ts` at 183 lines. The core budget goes from 6448 to 6460, which the 2026-10-29 Decision allows. The range does not touch the ticket's `ticket.md`.
- `findings.md` F1 (an empty quoted word vanishes) is `Status: open` and outside this ticket's scope. It uses the made-up `acme` name.

**Checks**

- **`npm ci`:** added 24 packages.
- **`npm run check`:** `tsc` found no errors.
- **`npm test`, first run:** 1279 tests, 1216 pass, 1 fail, 62 skipped. The failure was `machine.test.ts`, "a copy brings only the log's new bytes…", at 3013 ms; the range does not touch that code. Run alone three times, it passed each time.
- **`npm test`, second full run:** 1279 tests, 1217 pass, 0 fail, 62 skipped. This matches the worker's claim.
- **New rows against base:** I put base's `worktree-guard.ts` into a scratch copy and ran the branch's test with failures logged instead of asserted. All the Goal rows fail with `undefined`: the plain, attached, long, abbreviated, cluster and `-C` forms, assignments in the string, and the rows with a character env reads differently. So does the nested `env -S`. Only `-S '# x' rm …` and the redirect row already passed on base.
- **Mutations:** 24 in total, each run with `node --test --test-name-pattern="each call that writes into the main checkout"` on the scratch copy, then restored. 23 were caught:
  - Removing the refusal line for characters env reads apart, and removing each of its 13 characters one at a time.
  - Mapping a dynamic index to `-1`, or leaving it unshifted, and dropping `dynamic` entirely.
  - Dropping the words after the value.
  - `[command.words[0]!, …]` in place of the options before `-S`.
  - `writes: []` in the second `judge` call.
  - `end` as `index + 1` or `index + 2`.
  - Disabling the long form or the cluster form.

  Only the equivalent `name !== "sudo"` mutation above survived.
- **Cleanup:** the scratch copy is removed and `git status` in the review checkout is clean.

PASS