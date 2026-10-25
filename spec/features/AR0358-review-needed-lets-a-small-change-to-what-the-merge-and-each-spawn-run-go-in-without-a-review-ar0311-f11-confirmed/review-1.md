# AR0358 - Review 1

- Job: 2026-10-25-review-f09761ba
- Branch: arthur/2026-10-25-worker-58e611f1
- Commit reviewed: c906b0bbb5b8815a7bf96c50fe414407c26220e7
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0358 asks, and every check passes when I run it.

**What the branch changes**
- **The list:** `ALWAYS_REVIEW` in `packages/delivery/src/delivery-options.ts:16` gains exactly the 11 entries the ticket names.
- **Callers:** the list feeds `held` (`delivery.ts:48-49`), which `review-needed`'s decision (`review-needed.ts:58`), `--auto`'s fallback rule (`auto-merge.ts:40`) and `delivery.alwaysReview` for autopilot (`delivery.ts:92`) all use. So `--auto` and autopilot now refuse these files too, as the ticket intends.
- **Doc:** `docs/commands/review-needed.md`, "The always-review list", names the new entries and has a paragraph on the `--auto`/autopilot tradeoff, as Done means asks.
- **Example config:** `arthur.config.example.ts` gets the same entries, since its list replaces the default.
- **Tests:** every point Done means names is there:
  - `review-needed.test.ts` has a table row for a one-line change of each file.
  - `auto-merge.test.ts` adds a lockfile (`packages/shop/pnpm-lock.yaml`) to the held paths.
  - The default-list check covers every new entry, plus near-misses that must not match (`src/package.json.ts`, `docs/yarn.lock.md`, `.github/hooks/x`).
- **Moved rows:** the two old rows ("no script", "a broken package.json") can't be reached with the default list any more. They now live in the `alwaysReview: ["docs/**"]` test, so rule 8 is still covered. The worker's message gives this reason.
- **Rules:** no Shape or boundary rule breaks; the structure and line-budget tests pass.

**Notes (not blocking)**
- **Gap, outside the ticket's list:** `packages/projects/src/install.ts:13-14` also installs from `composer.lock` (`composer install`, which runs `composer.json` scripts) and `uv.lock` (`uv sync`, which builds from `pyproject.toml`). None of `composer.lock`, `composer.json`, `uv.lock` or `pyproject.toml` is on the list. A small change to them still gets `no review` and runs code at the next spawn or merge. The ticket lists its entries exactly, so this is a candidate finding, not a failure of this branch.
- **Similar gaps:** `.yarnrc.yml` (its `yarnPath`), `.pnpmfile.cjs` and `bunfig.toml` change what an install runs and aren't listed.
- **Dot folders:** `**/package.json` and `**/.npmrc` don't match inside a folder whose name starts with a dot, such as `.config/.npmrc`. The doc already describes this rule, and the merge and install read only the root's files.
- **Live config:** the owner's live `arthur.config.ts` needs the new entries added by hand if it sets `review.alwaysReview`, as the worker said. I couldn't check it from this worktree.

**Checks I ran**
- `npm ci`: added 22 packages.
- `npm run check`: `tsc` clean.
- `npm test`: 1120 tests, 1062 pass, 0 fail, 58 skipped.
- Mutations, each run against `review-needed.test.ts` and `auto-merge.test.ts`, then restored with `git checkout --`. The working tree was clean afterwards.

| Mutation | Tests that caught it |
|---|---|
| Removed `**/.npmrc` from `ALWAYS_REVIEW` | 2 failed: the table, the default-list check |
| Removed `**/pnpm-lock.yaml` | 3 failed: the `--auto` held-path test, the table, the default-list check |
| Removed `.husky/**` | 2 failed: the table, the default-list check |
| Removed `**/bun.lockb` | 2 failed: the table, the default-list check |
| Removed `**/package.json` | 2 failed: the table, the default-list check |
| Disabled the no-script refusal (`if (scripts.length === 0)` → `if (false)`) in `review-needed.ts` | 1 failed: the `alwaysReview` test that now holds the moved rows |

- **The worker's break test** (old list → 3 failures) agrees with these results. I didn't rerun its exact 81-test command; the full suite I ran passes.

PASS