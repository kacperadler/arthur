# AR0470 - Review 2

- Job: 2026-10-28-review-c622f113
- Branch: arthur/2026-10-27-worker-7ccfb33a
- Commit reviewed: 81bbee65d2379ba47372841d00928344441c36a4
- Verdict: FAIL

## Final message

I found one blocking finding. The sweep's depth limit protects running merges' caches, and no test fails when that limit is removed.

## Findings

1. **`packages/delivery/src/merge-command.ts:65`: no test catches removing the depth limit on the sweep.**
   - **Mutation:** I removed `"-maxdepth", "1", ` from the `find` call. The new sweep test and the failed-check test still pass (2 passed, 0 failed).
   - **Why this matters:** without the limit, `find` searches the whole of delivery's folder, including a running merge's young `cache_*` folder. It deletes any entry inside named `cache_*` whose modification time is more than a day ago, and package managers often keep old modification times from package tarballs. I reproduced this in a temp folder. With `cache_Runnin/bun/pkg/cache_store.js` dated 1985:
     - with `-maxdepth 1`, nothing matched;
     - without it, that file matched and would be passed to `rm -rf`.
   - **What it breaks:** that would delete files out from under another merge while it runs. The ticket's Done means says younger folders are kept. The last review round failed on exactly this, the scope of what the sweep deletes.
   - **Gap in the test:** `merge.test.ts:162-179` only puts `bun/deep/left` in the young folder. Nothing old and named `cache_*` sits below the top level.
   - **Fix:** put an old `cache_x` inside `cache_Runnin` (or inside a project's folder) and assert that it stays.

## Notes (not blocking)

- **Rename to `cache_`:** this goes against the ticket's "`cache-*`" wording, but I accept it. Project names (`project-options.ts:14`) and job ids (`job-state.ts:17`) cannot contain `_`, and delivery's other folders are `hand-backs` and `reviews`. So the sweep cannot reach a project's folder. The worker's message explains the rename, and `merge-checks.ts`, which is outside the ticket's stated scope, changes only for the same rename. Old `cache-<random>` folders left behind are filed as F2 in the findings.
- **Where the sweep runs:** moving the sweep from the start of the merge into the `finally` after `lock.release()` is not caught either. It behaves almost the same, so this is not a finding. The ticket does say "at each merge's start".
- **Removing `-mindepth 1`** is not caught, but has no effect: delivery's folder is never named `cache_*`.
- **Very long merges:** a merge whose cache folder's direct entries are more than 24h old while it still runs would be swept. That only happens if the owner sets `merge.stepSeconds` very high; the default is 3600.
- **File size:** `merge-command.ts` is exactly 200 lines. The worker reached that by joining two comment lines.

## Checks run

- `npm ci`: 22 packages added.
- `npm run check`: exit 0.
- `npm test`: 1225 tests, 1164 passed, 0 failed, 0 cancelled, 61 skipped. This matches the worker's numbers, and the structure test is part of this run.
- Baseline of the two targeted tests (`--test-name-pattern="older than a day|a failed check resets main"`): 2 passed.
- Mutations, each restored with `git checkout -- packages/delivery/src/merge-command.ts`:

| Mutation | Result |
|---|---|
| `-mmin +1441` | 1 failed (caught) |
| `-mmin +1439` | 1 failed (caught) |
| pattern `cache*` | 1 failed (caught) |
| `find` line deleted | 1 failed (caught) |
| `-maxdepth 1` removed | 0 failed (**not caught**) |
| `-mindepth 1` removed | 0 failed (not caught, no effect) |
| sweep moved to after `lock.release()` | 0 failed (not caught) |

- Ran `find` with and without `-maxdepth 1` in a temp folder (removed afterwards). Without it, the nested old `cache_store.js` inside a young cache folder matched.
- `git status --short` after the restores: clean.

FAIL