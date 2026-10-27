# AR0471 - Review 4

- Job: 2026-10-27-review-2a867a5d
- Branch: arthur/2026-10-27-worker-c28e3457
- Commit reviewed: 330bc10871ee5b7de4a73af15f8ae6176dfc0b52
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/shell-words.ts:93` (added in `38287dc1`, still at the tip): the branch now reads a double-quoted fallback's `~` as `$HOME`, which bash does not.** The guard reads the fallback word with `shellCommands(fallback[1]!, known, true)`, and that call expands a leading `~` to `known.HOME` whether or not the `${…}` is inside double quotes. Inside double quotes bash leaves `~` as plain text. This is a regression that lets a job delete the main checkout's README with no link at all, only a `~` folder in its own worktree (`mkdir '~'`).
   - `rm "${x:-~}"/../../../acme/README.md`: the base refuses it (main checkout). The tip passes it, because the guard judges `$HOME/../../../acme/README.md`. Real bash deleted the main README.
   - `rm "${x:-~/../../../acme/README.md}"`: same result. Refused at the base, passes at the tip, and bash deleted the README.
   - The unquoted `${x:-~}` is now read correctly, since bash does expand `~` there. Only the double-quoted case broke.
   - No row in `worktree-guard.test.ts` covers `~` inside a double-quoted fallback.
   - Fix in the spirit of AR-D157: do not expand `~` when reading a fallback in double quotes, or refuse a double-quoted fallback that holds `~`.

## Notes

**Earlier FAILs, with near variants, checked against real bash in a scratch layout with jobs `job1` and `job2`:**
- **Nested operator:** all of these are refused (UNKNOWN), where the base passed most of them.
  - `${x:-${ARTHUR_JOB%/*}}`, quoted inside or outside, and three levels deep;
  - `${x-…%job1}`, `${x:=…}`, `${ARTHUR_JOB:+${ARTHUR_JOB%job1}}`;
  - `${ARTHUR_JOB[0]%…}`, `[@]`, `[*]`, `${ARTHUR_JOB/job1/job2}`, `${ARTHUR_JOB:0:-1}`, `${ARTHUR_JOB@P}`.
  - `${x:-${ARTHUR_JOB}}/../job2` is refused (Arthur's home folder).
- **`>` and `#` in a fallback:** `${x:->…}`, `<`, `#` and `2>` are refused. `${x:-""#}` is refused too, which is more than needed but safe. `${x:-a\>…}` and `${x:-a">"b}` are read as bash reads them.
- **`IFS`, `time` and `!` splits:**
  - `IFS=;` and `IFS=x;` with a blank are refused, and so is `IFS=; rm ${x:-a${y:- }b}`.
  - `time OLDPWD=${x:-../../acme} cd -` is refused (main checkout).
  - `time -p` and `!` with a quoted or escaped blank pass, and bash misses too: it does not split those.
- **Quoted fallbacks in unquoted `${…}`:** these are all read as bash reads them, and refused (main checkout):
  - `${x:-"a b"}`, `${x:-'a b'}`, `${x:-a\ b}` and `${x:-a\;b}`;
  - `${x:-';'}`, `${x:-"a  b"}`, `${x:-'a<TAB>b'}` and `${x:-a$'\t'b}`.
- **Fully double-quoted `"${x:-…}"` (already on the base, not counted):**
  - `"${x:-a b}"` with a single space is read right.
  - Tab, newline, two spaces, a leading or trailing blank, `'a b'`, `a\ b`, `a\;b` and `'a;b'` are misread: the guard splits, removes the quotes and joins the words with one space; bash keeps the text as written. The base gives the same wrong reading for each.
- **Pre-existing, not counted:** `IFS=Q; rm ${x:-aQ../../acme/README.md}` passes at both the base and the tip (review 3 already noted it). F1 is out of scope.
- **Line counts:** `shell-words.ts` 197, `worktree-guard.ts` 200. Both are within the limit, as the worker said.

## Checks
- `npm run check`: exit 0.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 tests, 11 pass, 0 fail. The full `npm test` was not run, as you asked; the coordinator runs it.
- **Mutations**, each restored with `git checkout --`; the tree is clean afterwards. Each one made the guard test fail (10 pass, 1 fail):
  - refusing inside double quotes;
  - dropping blanks from the refusal check;
  - not skipping quotes and escapes before the check;
  - turning `plain` off;
  - disabling the refusal entirely;
  - reading `${HOME+…}` as HOME's value;
  - dropping the known-variable case from the unread-operator refusal.
- **Real-bash probes against the base and the tip:** about 70 rows, results as listed above. The scratch folders were removed.

FAIL