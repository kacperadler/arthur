# AR0151 - Review 1

- Job: 2026-10-19-review-ar0151-docs-docto-e5c6ee26
- Branch: h/2026-10-19-ar0151-docs-doctor-batch-1ae178d5
- Commit reviewed: 01eb7145239a75081a231ee3cdaf996112aaae43
- Verdict: PASS

## Final message

Worktree clean, all throwaway mutations reverted.

Findings: none blocking.

Notes:
- `01eb714` (AR0200 F1) is a new finding, correctly filed under `spec/features/AR0200.../findings.md` per the findings-file convention, `Status: open`; not part of Done means, fine to leave for the coordinator/owner.
- AR0152's roadmap move is implemented by relocating entries 82/39/40/41 earlier rather than 93/94 later; net ordering is identical and still satisfies "either move 93 and 94 after 41" in spirit (41 now precedes 93/94). Worker's final-message description ("Entries 93 and 94 moved to right after 41") is imprecise about mechanics but the observable outcome matches the Done means.

Checks run (in this worktree, range `0f11c8e2..01eb7145`):
- `npm ci`: clean.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 697 pass, 0 fail, 0 cancelled — matches worker's claim exactly.
- Roadmap dependency-order script (walks `### N.` headings, checks every `Depends on` against entries above it): 0 problems after the branch (reproduces worker's claim); confirmed `93 -> 41` violation existed before AR0152 in `main`'s predecessor state and is now gone, with no new ordering violation introduced by relocating entries 82/39/40/41 earlier (each of their own dependencies, e.g. 41→6,17, still precedes them).
- AR0200 regex (`^(?=.{1,72}$)(feat|…)(\([\w-]+\))?!?: .+$`): a 72-char subject matches, a 73-char subject refused — confirmed directly.
- Mutation (AR0172): removed the `local` doctor line (`return listed` instead of conditionally prepending `here(...)`) → exactly the new `machines.test.ts` test fails, all others pass. Restored via `git checkout`.
- Mutation (AR0186a): replaced `criteria: () => [...new Set(...)]` with `criteria: () => []` → two `init.test.ts` tests fail with the expected vs. actual skeleton lists. Restored.
- Mutation (AR0186b): forced `criterion()` to always synthesize the title fallback, never read the shipped skeleton → `init.test.ts`'s first test fails (shipped styleguide/autopilot bodies not written). Restored.
- Scope check: diff touches only `arthur.config.example.ts`, two `.mmd` docs, `spec/roadmap.md`, `packages/machines/*`, `packages/core/{jobs,plugin,roles}.ts` + docs, `packages/projects/{init,onboarding,projects}.ts` + tests/docs, `test/structure.test.ts`, and the new findings file — no `packages/telegram` or `packages/orchestration` touched, respecting the stated keep-away constraint.
- Budget raises (machines 415→446, core 5448→5452, projects 475→480) each carry a one-line reason comment above `BUDGETS` in `test/structure.test.ts`, and AR0151's ticket Decisions log already records the coordinator's acceptance of exactly these numbers.
- Signed-off-by present on all six commits; AR0177/AR0178/AR0180 correctly absent from this branch per instruction and ticket decisions on `main`.

PASS
