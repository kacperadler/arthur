# AR0153 - Review 1

- Job: 2026-10-18-review-ar0153-95b22cae
- Branch: h/2026-10-18-ar0153-0044a3b1
- Commit reviewed: ab63f138676e9b7b2e2d098eda8ed1b1b211524e
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

## Findings

None blocking.

## Notes (non-blocking)

- F1/F2 correctly filed as open findings in `spec/features/AR0153-roadmap-37-restart-guard/findings.md`, consistent with the "state it as a limit" guidance; not required by entry 37's Done means.
- `jobs.ts` is exactly 200 lines (the budget's edge, not over it).

## Checks run

- `npm ci`: installs clean (10 packages).
- `npm run check`: passes, no output.
- `npm test` (full suite, in this worktree): 514/514 pass, 0 fail, 241.9 s. Matches worker's claimed 514/514; no flake observed this run.
- Line budgets: `wc -l` confirms `restart-guard.ts` 80, `session.ts` 98 — both under 200; `structure.test.ts` budgets (core 4859, session 539) match the worker's claimed raises and the ticket's accepted Decisions, with comments explaining each raise.
- Mutation testing on `packages/session/src/restart-guard.ts` (throwaway edits, restored via `git checkout --`), each run against `restart-guard.test.ts` alone:
  - Ignoring `--ignore-restart` (always compute `restartDue` regardless of the flag) → 2 tests fail.
  - Comparing the whole tree instead of the noted `src/` paths (dropped `-- ...paths` from both `git diff` and `git log`) → 3 tests fail (docs/disabled-plugin-doesn't-count test, outside-checkout test, due-list grouping test).
  - Disabling the "undone change" short-circuit (`git diff --quiet` check forced false) → 2 tests fail.
  - Always registering the guard regardless of `restartGuard: false` (in `session.ts`) → the dedicated off-test fails.
  - All four mutations were caught by the existing suite; matches the worker's claim of having broken six behaviors and seen six failures.
- Spot-checked wiring: `spawn-check.ts`'s `refused by <plugin>: ...` / `plugin <plugin>: beforeSpawn failed: ...` formats match what `restart-guard.ts` and its tests expect; `--ignore-restart` threads through `spawn-command.ts` and `job-commands.ts` using the existing `SWITCHES` pattern (same as `prune --all`), not a bespoke hack; `host.code` is computed once in `host.ts` and asserted in `host.test.ts`.
- Docs cross-checked against the diff: `session.md` "The restart guard" section, `spawn.md`/`continue.md` `--ignore-restart` rows, `docs/deploy.md`, README feature table/mermaid, `arthur.mmd`, `arthur.config.example.ts` (comment correction matches worker's claim), roadmap's host API line (only that line touched, confirmed by diff), `coordinator.md` role file (+265 bytes, confirmed by `wc -c` 6908→7173) — all consistent with the final message's description.
- Boundary check: `restart-guard.ts` imports only `@arthur/core/plugin` (a published export, already used pre-existing in `session.ts`); reads only its own `.arthur/session/loaded.json`; `host.code` is core-published data, not another plugin's `.arthur/` folder. No runtime dependency added (no `package.json` touched). No class/enum/index.ts/types.ts/utils.ts introduced.
- Commits: two Conventional Commits, scope `AR0153`, matching the diff's file lists exactly (`git show --stat` on each).

PASS
