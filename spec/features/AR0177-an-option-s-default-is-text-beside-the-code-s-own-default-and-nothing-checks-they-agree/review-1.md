# AR0177 - Review 1

- Job: 2026-10-19-review-ar0177-options-do-d41b08ac
- Branch: h/2026-10-19-ar0177-options-doctor-ba-804540bb
- Commit reviewed: c4ea6c833d62faf0de2ee4de2483900c5ddfaac0
- Verdict: PASS

## Final message

Worktree clean, all mutations restored. Final assessment complete.

**Findings:** none blocking.

**Notes (non-blocking):**
- `valueDefaults` helper is duplicated verbatim across 10 test files (core, machines, models, orchestration, projects/resources style, session, telegram, youtrack). Styleguide explicitly prefers this over a shared `utils.ts`/helper bag, so not a FAIL, but worth a one-line mention for the owner.
- `packages/session/src/service.ts`'s `serviceRequirements` keeps its old 0-arg signature while assigned to `Plugin.doctor: (options, core) => …`; harmless (TS allows fewer params) and documented by the ticket's "constants/functions shared" allowance, but slightly inconsistent with the explicit `(options, core)` signatures elsewhere (orchestration, telegram-style doctor fns use `()=>` too for static lists, so this is the established pattern, not a real inconsistency).

**Checks run (in this worktree, against `dc1e1ea..c4ea6c8`):**
- `npm ci`: installs cleanly.
- `npm run check` (`tsc`): exit 0, no errors.
- `npm test`: 720/720 pass, 0 fail — matches the worker's claimed numbers exactly.
- Mutation tests (throwaway edits, reverted with `git checkout --`):
  - Removed the `enabled === false` skip in `core/src/doctor.ts`'s `ownAnswers` → `doctor.test.ts` and `setup.test.ts` both fail (disabled plugin's own-doctor line leaks through). Caught.
  - Swapped the own-vs-provided order in `host.ts`'s `checks()` → `doctor.test.ts`'s ordering test fails. Caught.
  - Bumped `youtrack`'s `TIMEOUT_SECONDS` constant by 1 → AR0177's new youtrack default test fails. Caught (same pattern verified representative of the other 9 per-package default tests).
- Verified AR0215's regex by hand: `72 true 73 false`, matching the worker's claim; confirmed `arthur.config.example.ts` already carries the identical lookahead regex (no drift) and `spec/vision.md` was correctly left untouched per ticket Scope.
- Verified AR0176 roadmap entry 97 is placed exactly where the Done means requires (after entry 68/evals-67, i.e. closing the Develop section), carries `Depends on: 96, 67`, excludes AR0129 as required, and follows the exact `Covers: none (new: the owner approved it on <date>, AR0176)` convention used by every other new entry in the file; entry 96's dangling "A later entry" cross-reference was correctly updated to "Entry 97".
- Verified AR0180's F1 finding claim by reading `machines.ts`/`projects.ts`/`models.ts`/`nvm.ts` source: all four still only use `host.provide("doctor", …)` (needs setup), consistent with the finding and with AR0177's Decisions line pre-approving exactly this limit.
- Confirmed line-budget raises in `test/structure.test.ts` match the numbers AR0177's Decisions pre-approved verbatim (machines 448, models 487, session 877, telegram 403, youtrack 466, core 5477); no touched file exceeds the 200-line per-file budget.
- Confirmed no `packages/core/src/jobs.ts` changes, no `package.json`/dependency changes, no `index.ts`/`types.ts`/`utils.ts`, no plugin-to-plugin or plugin-to-core-internal imports (boundary tests in the suite pass).
- Spot-checked that the worker's "I removed each new piece once and its test failed (5 of 5)" and "changed one default in each package … 10 packages, 11 changes" claims are consistent with what the diff actually contains (one exported constant + comparison test per listed package, plus core/orchestration/resources/schedule/projects using computed-value comparisons as the ticket's Done means alternates permit).

All four tickets' Done means are met end-to-end, the plan/ticket Decisions are honored exactly (including the pre-approved budget raises and AR0180's scope limit), docs (`doctor.md`, `setup.md`, `commit-rules.md`, `roadmap.md`) are updated consistently with the code, and the final message's claims reproduce.

PASS
