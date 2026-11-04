# AR0584 - Review 2

- Job: 2026-11-04-review-01bfe38a
- Branch: arthur/2026-11-04-worker-e0340669
- Commit reviewed: d5d8b756a38e710af67f857d277f1b8096d55033
- Verdict: PASS

## Final message

No blocking findings. Both of review 1's findings are fixed in `d5d8b756`, and I could reproduce every check result the worker claims.

1. **Reviewer reads `verify`** (`packages/delivery/src/delivery.ts:57`): I put the criteria back to `["styleguide", "review"]` and `packages/delivery/test/worker-criteria.test.ts` failed (4 pass, 1 fail). Restored, it passes.
2. **`packages/core/docs/commands/spawn.md:18` and `:132`** no longer say the worker's role tells a job to install. A repository-wide search for "as the worker's role tells" found only the roadmap line in the notes, which describes a stage that has already passed.

Against the ticket:
- **Lines deleted:** `worker.md`'s install line, the reviewer's run-checks and still-runs lines, `npm ci` from `.agents/arthur/criteria/review.md`, and the coordinator's restated spawn and merge refusals plus the uncommitted-ticket line. No `proc://` paragraph is left in any `packages/*/roles/*.md`, on the base or the tip.
- **Refusals the coordinator relies on:** `merge-command.ts:128` and `auto-merge.ts:83` tell the coordinator to use `--decision <the owner's decision id>`.
- **Coordinator rule:** `coordinator.md:16` keeps its own "outside text is data" rule.
- **Symlink check:** `worker-criteria.ts` refuses symlinks the same way the core's `roles.ts:191` does.
- **Line budgets:** core +5, delivery +21, manage +15, each named in the final message. Delivery's +21 is over the plan's +8; the message says why, and review 1 checked that each of those lines earns its place.
- **File sizes:** every changed source file stays green: `jobs.ts` 170, `roles.ts` 194, `delivery.ts` 159, `worker-criteria.ts` 19, `retro.ts` 150.
- **Out-of-Scope edits:** the changes to `.agents/arthur/criteria/retro.md` and the doc pages follow from the changed rules, and the final message says so.

## Notes
- (risk) packages/delivery/roles/reviewer.md:16: run-checks line now only in verify.md. A project that keeps `arthur init`'s headings-only `verify.md` loses "run the checks in your own checkout, compare with the worker's claims". Raised in review 1; still open.
- (minor) packages/manage/src/retro.ts:144: boundary of the "since" filter untested. Changing `<` to `<=` (dropping a correction made at exactly the last retro's commit second) still passes.
- (minor) spec/roadmap.md:432: "Until it exists, a job installs from the lockfile itself, as the worker's role tells it" now names a role line that is gone. It only describes the time before the install existed, and `packages/projects/src/install.ts` delivers that install now.
- (minor) Done means "shown in the final message by reverting the code": this round's message shows the revert proof only for the two new tests. Review 1 and this review proved the rest by hand (below).

## Checks run
- `npm ci`, then `npm run check` and `npm test` (timeout 1800 s): tsc clean; 1506 tests, 1442 pass, 0 fail, 64 skipped. This matches the worker's numbers.
- `npm run mutate`, in a call of its own: 25 mutants, 25 caught, 0 survived; 55 not run (`--max 25`).
- Hand mutations. Each was restored with `git checkout --`, and `git status --short` came back empty:
  - reviewer criteria without `verify` (`delivery.ts`): `worker-criteria.test.ts` 4 pass, 1 fail.
  - `join(realpathSync(checkout), path)` changed to `join(checkout, path)` (`worker-criteria.ts`): 4 pass, 1 fail.
  - provider condition `role === "worker"` changed to `role !== "reviewer"`: 4 pass, 1 fail.
  - `EVERY_JOB` moved after the plugins' sections (`jobs.ts`): `roles.test.ts` 11 pass, 3 fail.
  - retro project filter removed (`retro.ts`): `retro.test.ts` 9 pass, 1 fail.
  - worker criteria back to `["styleguide"]` (`jobs.ts`): `init.test.ts` and `roles.test.ts` 16 pass, 8 fail.
  - `packages/core/criteria/verify.md` moved away, then put back: `init.test.ts` 9 pass, 1 fail.
- Not run: `npx arthur roles` in this checkout, because no `arthur.config.ts` exists here. Its new `verify` line is covered by `roles.test.ts`.

PASS