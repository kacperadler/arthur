# AR0497 - Review 1

- Job: 2026-10-29-review-93bf60c6
- Branch: arthur/2026-10-29-worker-3d4c552f
- Commit reviewed: e45c0ca22b889d727c11063c1b95762fdfeb070c
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0497 asks: every command its Goal names is now refused, naming the main checkout.

## Findings

None.

## Notes (not blocking)

- **Prefix rule** (`packages/core/src/worktree-guard.ts:54`): a long-option prefix now counts as taking a value when every option it matches takes one. The guard does not prefer an option whose whole name the word spells; that is correct only because no listed option that takes a value is a prefix of one that takes none. I checked that against the lists with a script: no such pair exists. A new entry that breaks it would get past the guard silently, and the comment at `:17` is the only thing that holds it.
- **Side effect**: an ambiguous sudo prefix like `sudo --ch dir` is now read as `--chdir`. The worker names this. Real sudo rejects an ambiguous prefix and runs nothing, so it cannot hide a write. I worked that out from how the options are parsed; I did not run sudo.
- **Changes outside the Goal**: the short-option fixes (xargs `-i`/`-l` taken off, ionice `-t` taken off, ionice `-P`/`-u` added) are in the same line and the same file the ticket's Scope names. Each is justified in the final message and each has a row.
- **Option lists**: they match `/usr/bin/timeout` (GNU coreutils 9.4) and `/usr/bin/xargs` (GNU findutils 4.9.0) `--help`, and `nice`, `ionice`, `stdbuf`, `/usr/bin/time` `--help`. Leaving `=` off xargs `--max-lines`, `--replace` and `--eof` follows findutils, where those take a value only after `=`.
- **Size**: the guard file is exactly 200 lines, at the cap and not over it. Commit `e45c0ca2 fix(AR0497): …` follows the convention. No real client or project names appear.

## Checks run

- **`npm ci`**: exit 0.
- **`npm run check`**: `tsc` reported no errors.
- **`npm test`** (one bash call, 1800 s timeout): tests 1279, pass 1217, fail 0, skipped 62. This matches the worker's numbers.
- **Before the fix**: I put the base version of `worktree-guard.ts` back and temporarily made the row loop at `worktree-guard.test.ts:533` print every mismatch instead of stopping at the first. Exactly 29 rows failed: the Goal's `timeout --signal KILL 60 rm …`, all 25 rows that take a value, and xargs `-i`, xargs `-l`, ionice `-t`. Every command the Goal names fails before the change, as the worker claimed.
- **Mutations**: I ran each against the same harness and restored it with `git checkout`. All were caught:

| Mutation | Rows that failed |
|---|---|
| `size === 1` changed to `size !== 0` | `sudo --login`, `xargs --max-` |
| Back to `options.length === 1` | `ionice --class`, `time --output`, `time --out` |
| `--signal=` without `=` | 3 timeout rows |
| ionice `-t` put back as taking a value | `ionice -t` |
| xargs `-i`, `-l` put back | `xargs -i`, `xargs -l` |
| xargs `--max-lines` removed | `xargs --max-` |
| `--output-file=` without `=` | 3 time rows |
| The `long[2] === ""` check replaced by `true` | 4 earlier env/sudo `=` rows |

- **Restore**: `git status --short` was clean after restoring both files.
- Following your instruction, I ran none of the ticket's bypass commands in a shell.

PASS