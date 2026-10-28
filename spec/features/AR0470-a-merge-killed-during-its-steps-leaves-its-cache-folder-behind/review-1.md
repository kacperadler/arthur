# AR0470 - Review 1

- Job: 2026-10-28-review-1600b1c1
- Branch: arthur/2026-10-27-worker-7ccfb33a
- Commit reviewed: d93b1ec384636166b3511b61f2f4261ef516dbe3
- Verdict: FAIL

## Final message

I'm failing this branch: the new sweep also deletes delivery's per-project folders, not just cache folders. That throws away the `last-merge` record that the "only a merge puts code on main" check relies on.

## Findings

1. **`packages/delivery/src/merge-command.ts:65`: the sweep deletes a project's own folder.** `find <host.folder> -name 'cache-*' -mmin +1440 -exec rm -rf` matches every entry in delivery's folder whose name starts with `cache-`. Delivery keeps more there than caches: `<host.folder>/<project>/` holds that project's `last-merge`, `merge.lock` and `merging` (`take-main.ts:18`, `merge-command.ts:62`). The projects plugin accepts names like `cache-service` (`packages/projects/src/project-options.ts:14`, `/^[a-z0-9][a-z0-9.-]*$/`). That folder's date only changes when a merge of that project runs, so a day after its last merge, any later merge, of any project, deletes it.
   - **What is lost:** the `last-merge` record. `lastMerge` (`take-main.ts:27`) then returns `undefined`, and the AR0441/AR0361 check falls back to main's newest merge commit as its starting point. A merge commit made outside `arthur merge` then hides direct commits made before it. That weakens a protection without anyone asking for it.
   - **The project's own merge:** `mkdirSync(own)` doesn't change an existing folder's date, so the sweep deletes `own` right before `takeLock(join(own, "merge.lock"))`. I expect `takeLock` to throw ENOENT when it writes its temporary file there [INFERENCE: from `core/src/lock.ts`, not run].
   - **Reproduced twice:** running the exact `find` arguments on a temp folder with `cache-shop/last-merge` dated 25 hours ago removed it. A throwaway test added to `merge.test.ts` (restored afterwards) created `<host.folder>/cache-shop/last-merge` dated 25 hours ago and ran a real merge of `acme`: the merge passed and printed `last-merge of cache-shop still there: false`.
   - **Why this fails the ticket:** it asks to remove "its own `cache-*` folders", meaning the merge cache folders that `mkdtempSync(join(host.folder, "cache-"))` makes. A project folder isn't one of them. A tighter name pattern alone won't be enough: `mkdtemp` adds six letters and digits, which a lowercase project name can also have. The sweep needs to skip the configured projects, or the caches need a name or place that can't collide.

2. **`packages/delivery/test/merge.test.ts:163`: the test doesn't pin the one-day limit to the minute.** Its folders are 25 and 23 hours old, so moving the limit by one minute either way goes unnoticed. With `-mmin +1441` the test still passed, and with `-mmin +1439` it also passed. Only shifts of about an hour were caught: `+1560` failed and `+1370` failed. Folders just over and just under 1440 minutes old (for example 24h + 2 min and 24h − 2 min) would pin it.

## Notes (not blocking)

- The worker's claims hold: the new test catches the `find` line being removed and the limit being moved to 26 hours. Delivery is at exactly its 1631-line budget, `merge-command.ts` is exactly 200 lines, and the two joined comments change no code. The only doc change is in the "Checks on main" sentence.
- F1 in `findings.md` (read-only subfolders making the `rmSync` in `finally` throw) is a fair, separate finding.
- The worker reported 1161 passed / 3 failed. The full suite passed for me (1164 passed), which matches their "timing flakes under load" explanation.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check` (`tsc`): exit 0.
- `npm test`: 1225 tests, 1164 passed, 0 failed, 61 skipped.
- `wc -l packages/delivery/src/*.ts`: 1631 total; `merge-command.ts` has 200 lines.
- Mutations, each run against the new test by name and then restored with `git checkout`:

  | Mutation | New test |
  |---|---|
  | none (baseline) | passed |
  | `find` line removed | failed (caught) |
  | `-mmin +1560` | failed (caught) |
  | `-mmin +1370` | failed (caught) |
  | `-mmin +1441` | passed (missed) |
  | `-mmin +1439` | passed (missed) |

- `git status --short` was clean after the mutations and the throwaway test.

FAIL