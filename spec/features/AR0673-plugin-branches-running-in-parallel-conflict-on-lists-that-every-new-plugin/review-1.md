# AR0673 - Review 1

- Job: 2026-11-10-review-6242da99
- Branch: arthur/2026-11-10-worker-59d8d359
- Commit reviewed: 9365b1ecb81bed300f6e9f06f7bbfc99c3d4ae45
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what AR0673 asks within its Scope, and every result the worker reported reproduced.

- **`test/option-tables.test.ts:65-118`:** `PLUGINS` is in name order. `WITHOUT_OPTIONS` and `TOOLS` are each one entry per line, in name order, with a blank line after each, as `BUDGETS` is.
- **Test coverage:** The checks still fail when the plugins change. I edited the expected lists by hand: changing `TOOLS.video` to `["curl"]` failed the test, removing `video` from `TOOLS` failed it, and changing `"herdr"` to `"nvm2"` in `WITHOUT_OPTIONS` failed it. I restored the file with `git checkout`.
- **`arthur.mmd`:**
  - Line 3 (the status line) is gone, and so are the date on line 1 and the date in the legend.
  - The four comma-separated `class` lines became 64 lines of `class <node> <state>;`, sorted by name.
  - I compared which state each node had before and after: no node gained, lost or changed one.
- **`arthur.config.example.ts:1-4`:** The hand-kept package list is now a pointer to `packages/`.
- **`git merge-tree`, run on throwaway branches from 9365b1ec:**
  - I made a `kiosk` branch (sorts between herdr and listen) and a `nebula` branch (sorts between models and nvm). Each added a plugin to all three files in their new form.
    - With the plugin calls at different places in `plugins: [`, the merge had no conflict (exit 0).
    - With both calls placed after `herdr(),`, it conflicted in `arthur.config.example.ts` only. The worker's F3 already records this.
  - `moss` and `nebula`, which both sort between models and nvm, conflict in `arthur.mmd` and the test. The new comments and `BUDGETS` state the same limit.
  - On the audit's own pair, AR0645 (f8e2c46e) × AR0553 (e7048efa), the conflict in `arthur.config.example.ts` was in the header list (speak added at line 8 of the old header). This branch removes that list.

## Notes
- (risk) `arthur.config.example.ts:84`: F3 says two new plugins whose calls go in the same place in `plugins: [` still conflict. New: this means Done means point 4 ("no conflict") holds only when the two calls go in different places. The outcome should say that, not "no conflict" without the condition.
- (minor) `test/option-tables.test.ts:147`: Done means said "the test's assertions are unchanged". The tools assertion now compares a per-plugin record instead of a flat list. That is what "keyed by plugin" requires, and it checks at least as much as before.
- (minor) `test/option-tables.test.ts:67`: `PLUGINS` has no blank line between entries; the ticket asks for that only on the two expected lists. My merge-tree runs show insertions with an existing name between them still merge without a conflict.

## Checks (on 9365b1ec)
- `npm run check && npm test`: tsc had no errors; 1716 tests, 1652 pass, 0 fail, 64 skipped.
- `npm run mutate`: 0 mutants, 0 caught, 0 survived. Only a test file and docs changed, so there was nothing to mutate.
- Hand mutations on `test/option-tables.test.ts`, run with `node --import @arthur/core/testing --test test/option-tables.test.ts`: each of the three gave 4 pass, 1 fail. The file is restored and the checkout is clean.
- `git merge-tree --write-tree` in a throwaway clone (since removed):
  - `kiosk` × `nebula`, calls at different places: exit 0.
  - The same pair, both calls after `herdr()`: a conflict in `arthur.config.example.ts`.
  - `moss` × `nebula`: a conflict in `arthur.mmd` and `test/option-tables.test.ts`, as expected.
  - Audit pair f8e2c46e × e7048efa: the old conflict in `arthur.config.example.ts` was in the header.
- Diagram check: the old and new `class` assignments list the same nodes with the same states (64 lines).
- Searched for leftover references to the removed lines (date, status line, legend date, "no other plugin exists", the old header list). The only hit is `docs/setup.md:118`, which still says `'@arthur/docker'`. That is still true while docker is unbuilt, and F2 records it.

PASS