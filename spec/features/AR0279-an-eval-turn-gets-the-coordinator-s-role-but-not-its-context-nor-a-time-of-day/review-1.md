# AR0279 - Review 1

- Job: 2026-10-22-review-ar0279-12ea3161
- Branch: h/2026-10-22-ar0279-ba46bace
- Commit reviewed: f7560b3d784fc00e84cba6bb4b9ed30ce43093ac
- Verdict: PASS

## Final message

Clean. All mutation restores verified committed state unchanged.

---

**Findings:** none blocking.

**Notes:**
- `atHour`'s second DST-catch-up pass is untested (worker-acknowledged limit); low risk, rare (only matters when a run straddles a DST transition within the 12h window).
- `zoneAt` (eval-run.ts) derives its TZ offset from real wall-clock `new Date()`, independent of the host's (possibly fake) clock used for `atHour`/the context's `## Time`; both are engineered to hit the same target `hour` by construction, so they agree in practice, but they are two unrelated clock sources — worth a comment if this surprises a future reader. Not a defect given current tests pass and the design is intentional ("the local hour is that one, as the predecessor's evals did").
- F1/F2 findings are accurately filed, `Status: open`, consistent with the diff's actual behavior (verified `coordinator.checkoutContext` still calls `collectEach("coordinator.context")` unconditionally, and no fixture ships `spec/vision.md`).

**Checks run (in this worktree, range `5fae8255..f7560b3`):**
- `npm ci`: 22 packages, clean.
- `npm run check`: `tsc` clean, no errors.
- `npm test`: 1017/1017 passed, 0 failed — matches worker's claim exactly.
- Line-budget arithmetic verified independently with `wc -l`: core src (excluding `testing.ts`+`fake-agent.ts`) = 5753, orchestration = 2231, develop = 650 — exact match to the Decisions recorded on `main` and to `test/structure.test.ts`'s `BUDGETS`.
- Mutation testing (applied in-tree, each reverted via `cp`/restored, confirmed by `git status --short` clean afterward):
  - `board.digest` ignoring `checkout` → caught by `core/test/board.test.ts` ("a copy of the repository is read where it is").
  - Removed `hour` range/type validation in `eval-scenario.ts` → caught by `develop/test/eval.test.ts` (wrong-hour scenarios wrongly passed 2/2 instead of being refused).
  - Removed the `{ root, at }` shape check in `coordinator.checkoutContext` → caught by `orchestration/test/context.test.ts` ("Missing expected exception").
  - Un-guarded the `checkout === undefined` exclusions for jobs/open-decisions/silent in `context.ts` → caught by the same `checkoutContext` test (live jobs/decisions/silent leaked into the checkout text).
- Verified no plugin-boundary violations: `develop` and `orchestration` talk only through `host.call`/`host.provide("coordinator.checkoutContext", …)`; no cross-package file imports introduced.
- Verified every touched file stays under the 200-line cap (`board.ts` 196, others well under).
- Docs (`plugin-api.md`, `eval.md`, `coordinator.md`) read consistent with the code's actual behavior (host member table, scenario `hour` field, `coordinator.checkoutContext` numbering referencing the existing enumerated context sections).
- Scenario fixups verified: `night-one-line`/`morning-report` dropped their `AR0279` `needs` and gained `hour: 23`/`hour: 8`; the two session scenarios' `needs` lines now read `AR0279 F1: …`, matching the regex relaxation in `scenarios.test.ts` (`/^AR027[789]( F\d+)?: /`); `findings.md` keys match (`AR0279 F1`, `AR0279 F2`) exactly.

Ticket's Done means (context for a given checkout with board/vision, no live jobs; develop appends it for the fixture's copy; scenario `hour` driving `TZ`) are all met and tested. Decisions block (plugin API change, budget raises) matches what's on `main` per the task's Focus note, not introduced unilaterally. No scope creep beyond the ticket; the two new findings and two scenario-file touch-ups are in-scope cleanup the Done means implies.

PASS
