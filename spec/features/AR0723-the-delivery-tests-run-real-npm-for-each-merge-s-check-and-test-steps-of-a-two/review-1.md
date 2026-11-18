# AR0723 - Review 1

- Job: 2026-11-18-review-e4efd012
- Branch: arthur/2026-11-18-worker-5df5d69b
- Commit reviewed: 9aaf7a7fd06b6005afa00b3e68ec499845b5e3f8
- Verdict: PASS

## Final message

No blocking findings. The branch meets the ticket's Done means:

- **Fake npm on PATH:** `merge-setup.ts` and `auto-merge.test.ts` put a fake `npm` first on the PATH that the merge's steps get. `fake-npm.ts:12-22` runs the named script with `exec sh -c`, so npm's exit status and signal handling are the script's own.
- **Fake held against real npm:** `fake-npm.test.ts` compares the two on the same calls: output, exit status 0 and 3, death by SIGTERM, arguments after `--`, and a SIGTERM that the script traps.
- **Merge outputs unchanged:** no expected merge output changed in any test. The worker's report keeps both its before and after counts, so the outcome can give them: 154 real npm starts before, 30 after.
- **Real npm kept in one merge test:** the `nvm.path` test (`merge-steps.test.ts:179-199`). It asserts `npm() === ""`, so the scripts there ran through real npm and not the fake.
- **`merge-checks.test.ts` was not changed, as the worker says:** it starts no npm. It only checks the `$npm_config_cache/_npx` folder that the merge's environment sets (`merge-checks.test.ts:33,44`). The ticket's reason for keeping real npm there does not apply.
- **Files outside the In list:** `fake-npm.ts` and `fake-npm.test.ts`, both explained in the final message. No source file changed zone, the boundaries hold, nothing uses a production resource name, and no stale comments mention the old cost of real npm (I searched `packages/delivery` and `docs`).

## Notes
- (minor) packages/delivery/test/fake-npm.ts:19: when a script is missing, the fake runs the command `undefined` and exits 127; real npm prints "Missing script" and exits 1. A merge only calls scripts that package.json declares (`merge-checks.ts:64`), so a merge never reaches this.
- (minor) packages/delivery/test/fake-npm.ts:20: the banner prints `> <script>` only. Real npm prints `> <name>@<version> <script>` when package.json has a name and version. The fixtures have neither.
- (minor) packages/delivery/test/merge-steps.test.ts:197: switching the `nvm.path` answer to the module's start-up `PATH` behaves the same as before. `process.env.PATH` was still the original at that point because no agent had run yet. Harmless, and it guards against a later reorder of the test.

## Checks (all on 9aaf7a7f)
- `npm run mutate`: 0 mutants, 0 caught, 0 survived. The branch changes only files under `test/`, which mutate does not take, so I tried mutations by hand:
  - **`exec` removed** in `fake-npm.ts`: `fake-npm.test.ts` failed both tests (0 pass, 2 fail).
  - **Fake bin moved after PATH** in `merge-setup.ts`: `merge.test.ts` gave 1 pass, 8 fail.
  - I restored both with `git checkout --`; `git status --short` printed nothing afterwards.
- `npm run check`: `tsc` printed nothing.
- `npm test`: 1909 tests, 1845 pass, 0 fail, 64 skipped. This matches the worker's numbers.

PASS