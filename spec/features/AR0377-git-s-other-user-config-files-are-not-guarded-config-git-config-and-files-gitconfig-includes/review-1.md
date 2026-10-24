# AR0377 - Review 1

- Job: 2026-10-24-review-ar0377-git-config-026900e2
- Branch: h/2026-10-24-ar0377-git-config-guard-55ed335e
- Commit reviewed: 070f6e738c70f3b7a730a17febc7072e344ea251
- Verdict: PASS

## Final message

No package.json changes, no out-of-scope files. All files are directly relevant to the ticket's fix, its tests, docs, and findings.

Summary of review:

**Findings:** none that block merge.

**Notes:**
- `job-place.ts:23`'s `places` array mixes array-literal tuples without `as const`; TypeScript infers `(string[])[]`, losing the tuple shape, but `tsc` still passes since downstream destructuring (`[key, path]`) works regardless. Not a type-safety regression worth blocking on; purely cosmetic compared to the original `Object.entries` approach.
- F1's systemd gap is real but correctly filed as a separate finding rather than silently expanded into this ticket's scope — matches the ticket's `Scope: In: guard ~/.config/git/` boundary.

**Checks run (in this worktree, not the main checkout):**
- `npm ci`: clean, 22 packages.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1076 tests, 1075 pass, 1 fail — `test/ticket-kinds.test.ts` (AR0387's Kind line). Confirmed via `git show 8940bb85...:spec/features/AR0387.../ticket.md` that this ticket's offending line already exists at base, unrelated to this branch's diff. Matches worker's claim exactly.
- `node --test packages/core/test/worktree-guard.test.ts`: 9/9 pass.
- `node --test test/structure.test.ts`: 15/15 pass (line budgets, boundaries, no runtime deps — all hold).
- Mutation: removed the `~/.config/git` (`gitxdg`) entry from `guardedPlaces` in `job-place.ts`, reran `worktree-guard.test.ts` → the new "refuses writes into Arthur's install…" assertion failed as expected (write to `~/.config/git/config` passed through unguarded). Restored with `git checkout -- packages/core/src/job-place.ts`; tree clean afterward.
- Direct smoke of `guardedPlaces()`: with `XDG_CONFIG_HOME=/tmp/xdgtest` emits two `gitxdg` lines (`~/.config/git` and `/tmp/xdgtest/git`); unset emits only the home one. Matches worker's claim and the ticket's goal.
- Direct smoke of `worktreeRefusal`: a `write` to `~/.config/git/config` is refused naming "the user's Git config"; a bash append to the same path is refused likewise. Behavior matches the new test's expectations and docs/deploy.md's updated threat-model text.
- `worktree-guard.ts`'s actual diff is comment-only (no logic change) — the new guard works purely because `job-place.ts`'s generic `guarded` list/`refusal()` loop already handled arbitrary guarded paths; correctly minimal, no duplicated logic.
- Ticket's Done means ("guard `~/.config/git/` … say in the threat model that includes outside it are not followed … tested") fully met: `docs/deploy.md` lines 34 now state the XDG path and the include-elsewhere exception; tests cover allowed/refused cases for both the default and `XDG_CONFIG_HOME`-set paths.

No boundary violation, no secret, no production-resource reuse in tests (`temporaryFolder()` used throughout), no file outside scope, no stubbed work.

PASS
