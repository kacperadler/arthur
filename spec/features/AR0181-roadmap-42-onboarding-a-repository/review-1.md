# AR0181 - Review 1

- Job: 2026-10-19-review-ar0181-onboarding-48e58c3e
- Branch: h/2026-10-19-ar0181-onboarding-f9194d6e
- Commit reviewed: aa5c48daf3d3f827b8460d8fe7a358ff497cecca
- Verdict: PASS

## Final message

All clean. Final assessment.

**Findings:** none that block merge.

**Notes:**
- F1–F4 (new findings) are honest, correctly scoped to out-of-Scope entries (54, 84) and non-Scope files (`orchestration/roles/coordinator.md`); appropriately left `open` for the merge step to convert to planning tickets, per `findings.md`'s own protocol.
- `merge.check` as the refusal point (vs. an actual merge command, since entry 54 doesn't exist) is the Decision the task's Focus explicitly says the coordinator pre-approved; not a deviation.
- Budget raise 325→473 is justified in the `structure.test.ts` comment, naming the one cut (`requirement`→`requirements`) first, as Scope requires.
- Disclosed untested gap: swallowing non-`EEXIST` link errors in `writeOnce` — correctly flagged as untestable rather than hidden; acceptable, matches "name it" standard for edge cases that can't be forced in a test.

**Checks run (in this worktree, against the given range):**
- `npm ci`: clean, 11 packages.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 600/600 pass, 0 fail — matches worker's claim and the CI workflow's own `check`+`test` steps verbatim.
- `wc -l packages/projects/src/*.ts`: 473 total, matches the raised budget and the breakdown claimed (init.ts 63, onboarding.ts 83, projects.ts 116).
- Mutation check 1: disabled the symlink refusal in `onboarding.ts` (`outside`) → `merge.check` test failed as expected (caught).
- Mutation check 2: disabled the existing-board pre-check in `init.ts` → the "over an existing board" test failed as expected (caught).
- Reviewed `init.test.ts` and `onboarding.test.ts` in full: every Done-means edge case (unknown project, existing board incl. hand-broken JSON, board appearing mid-run via dangling symlink, empty repo, existing `.nvmrc` kept, repo without `package.json`, `prompts` remapping, wrong usage incl. `--project`, >10 questions cut deterministically across repeated wake builds and across runs, non-finished/other-kind wakes, `merge.check` accept/reject/symlink/unknown-project/unknown-kind/git-failure) has its own test; async waits poll a `state` file to `"ended"`, no fixed sleeps.
- Verified plugin-boundary imports in `init.ts`/`onboarding.ts`: only `node:*` and `./projects.ts`/`./init.ts` (same package) — no cross-plugin or core-internal import.
- Compared `.github/workflows/ci.yml` to the three local commands run — identical steps, so the one Done-means point the worker couldn't check (GitHub `ci` green on push) is otherwise fully reproduced locally.
- `git status --porcelain`: clean after restoring both mutation edits.

PASS
