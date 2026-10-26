# AR0454 - Review 1

- Job: 2026-10-26-review-2884ea9d
- Branch: arthur/2026-10-26-worker-b75a162b
- Commit reviewed: 4ac62f73e3eef9741ab2eb89943b97e4d077f9b3
- Verdict: FAIL

## Final message

**AR0454 review: FAIL.** The fix itself works and its main tests catch the regressions I tried. It fails on one gap: two of the five cache variables have no test that breaks when they are removed.

## Findings

1. **`packages/core/src/job-sandbox.ts:107`: two of the cache variables in `cached()` are not tested.** I removed `PNPM_HOME=…` and `COMPOSER_CACHE_DIR=…` from `cached()` and ran `sandbox.test.ts` with `merge-checks.test.ts`: 13 pass, 0 fail, 4 skipped. No test noticed.
   - The ticket's Done means names `COMPOSER_CACHE_DIR` as one of the variables that must point into the job's or merge's own folder.
   - `PNPM_HOME` takes the place of the `~/.local/share/pnpm` path that `caches()` used to make writable. pnpm keeps its store there. Without `PNPM_HOME`, pnpm would use the shared store, which the sandbox no longer lets it write, so every pnpm install in a job or merge would fail [INFERENCE: from pnpm's documented `storeDir` default; pnpm was not run].
   - Only `npm_config_cache` and `XDG_CACHE_HOME` are checked, by the test without python3 (`sandbox.test.ts:174-175`). `BUN_INSTALL_CACHE_DIR` is covered by the fake `bun` in `merge.test.ts`.
   - The styleguide asks for a test that fails when each behavior is removed, and the review criteria count an uncaught mutation as a FAIL. The fix is small: check all five variables in that test's `echo`.

## Notes (do not block)

- **The install's cache, `<record>/cache`:** the record was already writable, so the install gets no new writable path. Two things that list the record are unaffected:
  - `remote-job.ts:113` skips anything that is not a file.
  - `ci-wait.ts:31` only looks at entries named like a job id, so the merge's `cache-*` folders are ignored.
- **The merge's cache:** `host.folder` always exists because `host.ts:61` creates it, so `mkdtempSync` cannot fail there. Job agents cannot write the delivery folder, so a job cannot plant anything in a merge's cache.
- **F1 in the new `findings.md`:** the reinstall after a failed check uses the cache the branch's install just wrote. The ticket accepts one cache per merge, so this is the worker's open finding, not a requirement it missed.
- **F2:** a merge killed with SIGKILL leaves its `cache-*` folder behind. It costs disk only.
- **Accepted by the ticket's Decisions:** the API change `sandbox(folder, cache, note)` (AR-D107, recorded in `docs/plugin-api.md`) and the line budgets, core 6327 and delivery 1442.
- **pnpm's store location:** if the store sits on a different filesystem from the project, pnpm uses a store of its own on that filesystem instead, outside both caches. That only applies to unusual layouts [INFERENCE].

## Checks I ran

- `npm run check`: tsc passes.
- Five test files (`sandbox.test.ts`, `merge-checks.test.ts`, `merge.test.ts`, `test/structure.test.ts`, `test/plugin-api.test.ts`): 58 tests, 53 pass, 0 fail, 5 skipped. Four skip because this process cannot open a Unix socket, one because there is no systemd user manager. The Landlock install test from Done means did run and passed. I did not run the full suite, as you asked.
- **Mutations**, each restored with `git checkout`; the tree was clean at the end:
  - Shared `$HOME/.npm` added back to the install's writable paths (`wrapper.ts:123`): the install test fails. Caught.
  - `cache` removed from `stepSandbox`'s writable paths: the `merge-checks.test.ts` test and "a merge step writes main…" in `sandbox.test.ts` fail. Caught.
  - `rmSync(cache…)` removed from the merge's `finally`: `merge.test.ts` tests 1 and 15 fail. Caught. This run overlapped the next mutation, but the failing assertions are the ones about removing the cache.
  - `mkdirSync(cache)` removed from `stepSandbox`: "without python3…" and "a merge step writes main…" fail. Caught.
  - `PNPM_HOME` and `COMPOSER_CACHE_DIR` removed from `cached()`: not caught (finding 1).

FAIL