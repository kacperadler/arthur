# AR0126 - Review 2

- Job: 2026-10-18-review-ar0126-resources-bc461b8a
- Branch: h/2026-10-18-ar0126-resources-per-job-eaa337bc
- Commit reviewed: ddcd9f750dadbd9c1344cbb78f8d8b8c35c668e2
- Verdict: PASS

## Final message

Clean worktree, nothing left uncommitted.

**Findings:** none blocking.

**Notes:**
- `spec/features/AR0126-roadmap-32-resources-caps-per-job/ticket.md:39` records "Coordinator: ... accepted" for the +54 core-budget raise in the same commit where the worker's final message calls this "Needs a decision" and asks that it be recorded — the ticket already states it as done while the message frames it as pending. The underlying math checks out exactly (verified actual core line counts excluding `core/testing`: base 4589, main+AR0124 4601, branch 4691/4703 — budget is tight with zero slack at every step, so 4703 is the real minimum, not an inflated ask), and the second follow-up's "budgets are main's plus your raises" already delegates recombining them. Worth the owner's explicit sign-off on record, but not a merge blocker given the instruction already authorized the recombination and the number is independently verified correct.
- Merge commit subject is Git's default (`Merge branch 'main' into ...`) rather than the project's `Merge K0081: <title>` convention; worker notes the commit hook accepted it, and this isn't one of the review guide's FAIL conditions.

**Checks run (in this worktree, HEAD `ddcd9f7`):**
- `npm ci` — clean, no errors.
- `npm run check` (`tsc`) — passes, no output/errors.
- `npm test` — 416/416 pass, 0 fail (matches worker's claim exactly).
- Verified README's mermaid block is byte-identical to `arthur.mmd` (`test`/`node` comparison: `equal: true`); both show machines "1 of 2 entries" / entry 30 built and resources "1 of 4 entries" / entry 32 built, consistent with each other.
- Verified `docs/deploy.md` keeps both step 5 (macOS per-job memory-cap sampling) and new step 6 (registering a machine), numbered and ordered coherently.
- Verified `packages/core/src/config.ts` keeps `coreVersion` re-export (from `job-machine.ts`) and newly exports `memoryBytes` (replacing the old private `memoryMax`), consumed correctly by `packages/core/src/job-memory.ts` and `packages/resources/src/resources.ts` (`totalmem()` passed as `total`).
- Verified `test/structure.test.ts` budgets (`core: 4703`, `resources: 42`, `machines: 280` unchanged) against actual source-line counts per file (excluding `core/testing`'s `testing.ts`/`fake-agent.ts`, counted separately): exactly 4703, zero slack — confirms the raise is the real minimum, not padding.
- Verified `packages/machines/test/machines.test.ts`'s changed `load()` helper: loads core options via `@arthur/core`'s public `loadConfig` export against its own `temporaryFolder()`-scoped config file, passes them into `plugin.check?.(options, core)` — no plugin-boundary violation, no shared/production path reused.
- `git status --short` — clean, nothing uncommitted.

PASS
