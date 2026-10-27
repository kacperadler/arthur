# AR0469 - Review 4

- Job: 2026-10-27-review-6d516d79
- Branch: arthur/2026-10-27-worker-5893b900
- Commit reviewed: e1e73d2bc53a936caeafc361142d8734b8e13651
- Verdict: PASS

## Final message

## Review of tip `e1e73d2b` (AR0469): merge `4f93d81e` and split into `merge-sweep.ts`

No findings. The merge kept both sides, and moving the sweep into `merge-sweep.ts` changed no behaviour.

**The merge (`4f93d81e`) keeps both sides**
- **`merge-checks.ts` compared with main (`55363241`):** the only differences are AR0469's. `stepRunner(root, slice, log, limitSeconds)` returns `(sandbox) => Run` and takes one `before` per merge. `reinstall(ask, runner, folder, …)` makes its cache with `mkdtempSync(join(folder, "cache-"))` and removes it in `finally`.
- **`merge-checks.ts` compared with the branch (`9fde2667`):** the only differences are AR0466's.
  - `repositories(root, counts)` treats a folder holding a `HEAD` as a repository.
  - `escapes` handles symlinks that point outside.
  - `before` is `repositories(root, () => true)`, and each sweep uses `repositories(root, escapes)`.
- **`merge-checks.test.ts`:** both sides' tests are there. Main's `planted()` additions (`tools/bare.git`, the `tools/beside` and `tools/py` symlinks) are combined with the branch's `runs`/`run` split. The branch's test that the reinstall sweeps a late `.git` sits next to main's symlink and HEAD tests.
- **`merge.md`:** main's "Git also takes a folder holding a `HEAD`…" sentence and its wider "repository" wording are both present, alongside the branch's text on the reinstall's fresh cache, the second `no sandbox:` line and the sweep against the first look.

**The split (`e1e73d2b`) moves code without changing it**
- I compared `repositories`, `escapes`, `READ`, `ATTRIBUTES`, `stamp`, `entries` and `remove` with their versions in `4f93d81e:merge-checks.ts`. The only difference is `export` on `repositories`.
- `sweep(root, before, command, log)` is the old per-step loop, word for word. `stepRunner` still computes `before` once and calls `sweep` after each step.
- Imports were trimmed to what each file still uses, and `tsc` is clean.
- `merge-checks.ts` is 109 lines and `merge-sweep.ts` is 108, both under 200. `cat packages/delivery/src/*.ts | wc -l` gives 1631, which is what `test/structure.test.ts` records and what AR-D172 decided. The split follows AR-D170.

## Notes (not blocking)
- As the worker said, main has moved past `55363241`. The branch needs another `git merge main` before it lands, so that it picks up main's later `BUDGETS` entries.

## Checks run
- `npm run check`: exit 0 (`tsc`).
- `node --test test/structure.test.ts packages/delivery/test/merge-checks.test.ts packages/delivery/test/merge.test.ts` (TAP reporter): 53 tests, 52 pass, 0 fail, 1 skipped. The skipped test is "each step on main runs in a scope of its own under the jobs' slice…" (no systemd user manager here). This matches the worker's 28 + 25.
- **Mutation 1:** removed the `sweep(root, before, command, log)` call in `stepRunner`. `merge-checks.test.ts` had 10 of 12 tests fail, so it is caught. Restored.
- **Mutation 2:** in `sweep`, `repositories(root, escapes)` became `repositories(root, () => true)`. 1 of 12 tests failed (the symlink test), so it is caught. Restored. `git status` is clean.
- I did not run the full `npm test`, as you told me. Your host run reports 1204 tests, 1198 pass, 0 fail, 6 skipped.

PASS