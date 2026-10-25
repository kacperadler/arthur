# AR0307 - Review 1

- Job: 2026-10-25-review-3b6eab5a
- Branch: arthur/2026-10-25-worker-5da05172
- Commit reviewed: 1e3db04a653827ff3c2c9ffd877a0cb8fecd9fb2
- Verdict: PASS

## Final message

No blocking findings. The branch does the cleanup the ticket and plan ask for, the doc fixes match what the real run in phases 1 and 2 recorded, and every claim in the worker's final message reproduces.

**Findings**

None.

**Notes (not blocking)**

- The README status rewrite and removing only the test that compared the two criteria copies (`test/arthur-criteria.test.ts`) are both the owner's decisions (ticket Decision 2026-10-25). The AR0272 and AR0273 tests stay and pass.
- The setup.md step 8 `PATH` change the plan listed was correctly left out: the phase 1–2 Decision records that the coordinator started without `node_modules/.bin`.
- The only `.agents/harness` strings left outside `spec/` are the plan's temporary-folder fixtures in `packages/core/test/roles.test.ts` and `packages/projects/test/project-options.test.ts`. The only other remaining "harness" text is in `docs/architecture/versions.mmd`, which is F1 in `findings.md`.
- No test was added, which fits the change: it only edits docs and deletes files. No key code behavior changed, so there was nothing to mutate.
- The ticket's "one real ticket end to end" (review, merge, after-merge) is this branch going through Arthur. A branch review cannot judge that part; it is settled by the merge.
- The new text names no client or other project. The README says only "its owner's VPS", and the examples use `shop` / `acme`. The commit `chore(AR0307): …` is one Conventional Commit with the ticket as scope.

**Checks run**

- **`npm run check`:** `tsc` passed, exit 0.
- **`node --test test/arthur-criteria.test.ts test/readme.test.ts`:** 3 tests, 3 pass, 0 fail. This matches the worker's claim.
- **`npm test`:** not run, as the task told me.
- **Step 5 config:** I wrote setup.md's config into a temporary folder in this checkout, with a temporary `shop` repo, and ran it through `arthur zzz`, an unknown command that prints why the config did not load.
  - Without the token, the only problem was `ARTHUR_GITHUB_TOKEN is missing`, which is what step 5's Check expects.
  - With a token and an `origin` remote, every plugin loaded. A bogus `findings` option was refused, so the config is validated for real.
  - I could not run `arthur config check` itself: inside a job it is refused, and I did not get around that guard.
- **`arthur projects`** (it may run inside a job): printed `SH shop\n  <path>; 0 open tickets; install: none` and exited 0. That is the shape step 6's Check shows.
- **Step 6's refused name:** with `tokenEnv: "GITHUB_TOKEN"` the config is refused with `github.instances[0].tokenEnv: expected ARTHUR_GITHUB_<WHAT>, got GITHUB_TOKEN`, word for word what the doc quotes.
- **Exit code claim:** in `packages/core/src/config-check.ts:41`, `ok` is false while any variable is missing, which backs "exits 0" once every line says `set`.
- **Step 4 lines:** run twice in a temporary `HOME`, the `PATH` line went into `.bashrc` once. With a repository already at `~/arthur`, the clone was skipped.
- **Doc references:** the five plugin doc pages and `deploy.md#updating` exist, and every `--help` command step 5 names (`coordinator`, `projects`, `schedule`, `review`, `merge`) is in the loaded command list.
- **Leftovers:** `grep -rn "agents/harness"` outside `spec/` and `node_modules` finds only the two fixture files.
- I removed the temporary folder; `git status --short` is clean.

PASS