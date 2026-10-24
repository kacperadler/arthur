# AR0380 - Review 1

- Job: 2026-10-24-review-ar0380-git-config-165e375b
- Branch: h/2026-10-24-ar0380-git-config-progra-2bc459e3
- Commit reviewed: 290f5703da615ba6ef7cc614cf1c62b66d92c79a
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `packages/core/src/git-config.ts`: `remote.<name>.url`/`pushurl` stay in the allowed set unchecked for value content, so a job could plant `remote.origin.url = ext::sh -c ...` and have `github.push` run an arbitrary program via `git-remote-ext`. Worker found this, documented it as open finding F2 (and the check-then-call race as F1) in `findings.md` and `docs/deploy.md`, consistent with this repo's established pattern of chained, incrementally-resolved AR03xx security tickets (AR0330 → this ticket → F1/F2). Not a blocker given that precedent and the explicit, disclosed limitation.
- Commit `43db3131` message says "unfinished"; harmless, squashed history not required by the review guide.

## Checks run (in this worktree, against the given range)

- `git diff`/`git log` over `2a0331ff7..290f5703d`: reviewed in full (git-config.ts, its four call sites, all touched tests, docs, structure-test budgets, decisions/findings entries).
- `npm ci`: clean.
- `npm run check`: passes, no output.
- `npm test`: 1085/1085 pass, 0 fail — matches worker's claim exactly.
- Verified `extensions.refStorage` claim: local git is 2.43.0 (worker said that row is skipped on 2.43 — confirmed consistent).
- Verified line-budget arithmetic directly: `cat packages/core/src/*.ts | wc -l` = 6336 (−349 testing/fake-agent = 5987, matches `BUDGETS.core`); delivery = 1317; github = 651 — all match `test/structure.test.ts`'s `BUDGETS` and the worker's stated numbers.
- Verified boundary rule: delivery and github import `configRefusal` via `@arthur/core/git-config` (published export in `packages/core/package.json`); core's own `git.ts`/`job-machine.ts` import the relative `./git-config.ts`. No plugin-to-plugin or path-into-core import.
- Verified git behavior claims with a throwaway repo: `include.path` pointing at a nonexistent file is still listed by `git config --list --show-scope` (so the "sets include.path" refusal path, not a Git-error path, is correctly exercised by the github test).
- Mutation testing (applied and reverted with `git checkout --` each time; `git status --short` clean afterward):
  - `(scope === "local" || scope === "worktree")` → `false` in `git-config.ts`: `git-config.test.ts` fails (2 assertions).
  - Dropped the read-failure branch: `git-config.test.ts`'s "config Git cannot read" test fails.
  - Disabled the pre-merge `configRefusal` call in `merge-command.ts`: `merge.test.ts`'s refusal test fails, showing the merge landing and reaching the reset-race scenario instead of refusing up front.
  - Disabled the `configRefusal` call in `github-git.ts`: `github.test.ts`'s new push-refusal test fails (✖).
  - Disabled the `configRefusal` call in `git.ts` (`addWorktree`): `job-records.test.ts`'s spawn-refusal test fails ("Missing expected rejection").
  - Disabled the `configRefusal` call in `job-machine.ts` (`gitOver`): `machine.test.ts`'s push/fetch-refusal test fails ("Missing expected rejection").
  - All five mutations caught by exactly the tests the worker named; none silently passed.
- Confirmed docs updated and consistent with code: `docs/deploy.md` ("Threat model"), `docs/plugin-api.md` (new `@arthur/core/git-config` export section + Decisions-changes entry), `packages/core/docs/commands/spawn.md`, `packages/delivery/docs/commands/merge.md`, `packages/github/docs/github.md`.
- Confirmed the Decisions line required by `docs/plugin-api.md` for a new core export is present in `spec/features/AR0380.../ticket.md` (added in the branch's last commit, dated 2026-10-25), so the worker's "needs action" note in the final message is already resolved on this branch.
- Confirmed `alias.lfs` was moved out of the LFS-push test into the new push-refusal test (no longer present in the `git lfs push` test body).

PASS
