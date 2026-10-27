# AR0471 - Review 1

- Job: 2026-10-27-review-d6549924
- Branch: arthur/2026-10-27-worker-c28e3457
- Commit reviewed: 723acd89d8705a18dd8ae1761fb96f034ad94a1f
- Verdict: FAIL

## Final message

I'm failing this branch: wrapping the exploit in a fallback still gets a write into another job's folder past the guard.

**Findings**

1. `packages/core/src/shell-words.ts:93`: an unread operator nested inside a fallback word is still read as nothing. The changed line parses the fallback with `shellWords(fallback[1]!)`, which calls `shellCommands` without `known`. Inside it, `value("ARTHUR_JOB")` is undefined, so the new `\0-` marker never fires for `HOME` or `ARTHUR_JOB`.
   - `echo x > ${x:-${ARTHUR_JOB%/*}}/<other job>/result` is read as `/<other job>/result` and passes the guard. I added this row to the test for one run: the guard returned `undefined` where `UNKNOWN` was expected, and I restored the file afterwards.
   - Real bash (`bash -c` with `ARTHUR_JOB=/h/.arthur/jobs/j1`) writes it to `/h/.arthur/jobs/j2/result`.
   - The same goes for `"${ARTHUR_JOB:+${ARTHUR_JOB%/*}}"/j2/result`, which the guard reads as `/j2/result` and bash also expands to `/h/.arthur/jobs/j2/result`.
   - So the ticket's Goal is still reachable by wrapping the finding's exploit once. The Done means point is not met for these forms, since they are a `${…}` of a known variable with an unread operator and are not refused. The same missing `known` makes `${x:-$ARTHUR_JOB}` read as nothing too (that part was already there before the branch).
   - Fix: parse the fallback with the caller's `known`, i.e. `shellCommands(fallback[1]!, known)` and keep its words, and add a row that fails without it.
   - `${PWD%…}` nested the same way is refused, because the `PWD` check does not depend on `known`.

**Notes (not blocking)**
- The edited refusal text in `worktree-guard.ts` (`OLDPWD_UNKNOWN`) is in scope, and the new clause does name `${PWD…}`, `${HOME…}` and `${ARTHUR_JOB…}`. But for `${HOME%/x}` the message still opens with "cannot tell where OLDPWD leads here", which reads oddly.
- In an unquoted heredoc, `${PWD:+x}` is now refused, though bash gives `x` there and the same form outside a heredoc passes. This is extra caution, not a hole.
- `shell-words.ts` and `worktree-guard.ts` are each at exactly 200 lines.
- The worker's claims match what I saw: the diff covers the 3 files listed, the 11 new rows are there, and `npm run check` is clean.

**Checks run**
- `npm run check` (tsc): clean.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 tests, 11 pass, 0 fail. The full suite was not run, as you asked.
- 8 mutations of `shell-words.ts`, each confirmed applied, then restored with `git checkout`. The guard test failed on every one:
  - dropping `name === undefined`;
  - dropping `value(of) !== undefined`;
  - dropping `of === "PWD"`;
  - dropping `#` from the `of` prefix;
  - removing the heredoc `\0-` replace;
  - reverting the heredoc forms to `\{PWD\}`;
  - letting the heredoc fallback match braces;
  - dropping `fallback === null`.
- A throwaway probe of `shellCommands` (in `/tmp/rv-d6549924`) over other forms:
  - refused (`\0-`): `${PWD^^}`, `${PWD,}`, `${PWD@Q}`, `${PWD: -3}`, `${PWD:0:3}`, `${PWD[@]}`, `${PWD[1]}`, `${HOME[0]%/x}`, `${HOME[@]}`, `${!HOME}`, `${#ARTHUR_JOB}`, `${!ARTHUR_JOB*}`;
  - read as before: the plain, `-`, `=`, `?` and `+` forms;
  - in a heredoc: `${PWD-${x}}` and `${PWD[1]}` are refused; `${PWD=x}` and `${PWD?x}` are read as the outer shell's folder;
  - not refused: the nested fallback forms in finding 1.
- `git status --short` was clean after every mutation and after the throwaway row.

FAIL