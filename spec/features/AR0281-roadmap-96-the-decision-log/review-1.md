# AR0281 - Review 1

- Job: 2026-10-22-review-ar0281-decision-l-3fd0b3fe
- Branch: h/2026-10-22-ar0281-decision-log-fa71d0e0
- Commit reviewed: 1a40898017c9b5db5f724b746a1828053d865436
- Verdict: PASS

## Final message

## Review: AR0281 — the decision log

### Verification performed

**Spec compliance (roadmap entry 96, Done means)** — read the full roadmap entry 96 text and cross-checked every refusal/edge case against `packages/orchestration/test/decisions.test.ts` (17 tests, 442 lines): in-job refusal, empty question, bad kind, ticket off-board, bad `--recommend`, unknown-id/empty-answer/no-`--decided`/bad-`--picked` answer refusals, hand-edited line refusal (naming the line, file untouched), two concurrent asks, second answer to one id, crash-then-repair, human-edited ticket line never rewritten, deleted-line rewrite, redaction of key/job-id/commit-hash, long-answer cut, `arthur decisions` search/filter/no-log behavior, context's open-questions-with-similar-answered section, fresh-conversation context. All present and matching the spec's wording (`decisionLine`, `ticketLines`, `repair`, `change` in `decision-log.ts`).

**Boundary/shape** — new files only import `@arthur/core/plugin` and `@arthur/core/lock` (published exports), no other plugin, no core-internal path; no classes/enums; files 185/171/38/47 lines, all ≤200; no new runtime dep (`package.json` unchanged); no `docs/plugin-api.md` change, and indeed no new host member was added (grep confirms no `packages/core` diff). Budget raise to 1991 is pre-recorded in the ticket's own Decisions, as the task's Focus required.

**Checks reproduced in this worktree:**
- `npm ci`, `npm run check` — clean.
- `npm test` — 985/985 pass (matches worker's claim exactly).
- `node --test packages/orchestration/test/decisions.test.ts` — 17/17 pass.

**Mutation testing (my own, in this worktree, reverted after each):**
- Disabled `ARTHUR_JOB` in-job refusal → caught (`AC-D2` returned instead of refusal).
- Disabled hand-edit detection (`problem()` forced to return `undefined`) → caught (different error, but still fails loudly, log stays unreadable gracefully degrading to a crash rather than silently accepting a corrupt line — acceptable, test still red).
- Forced `repair()` to always treat ticket lines as missing (defeats "never rewritten") → caught (duplicate line asserted away, "a cut line counts as written" assertion fails).
- Removed `withLock` from `change()` and ran the real 4-process concurrency test 5×: caught 3/5, missed 2/5 — reproduces the worker's own self-reported **F1** almost exactly (they reported 2-of-3 failures to catch). This is a disclosed, open finding (`findings.md`), not a hidden gap, and the underlying code genuinely uses the lock (verified by reading `decision-log.ts`); the weakness is in the test's power to catch a removed lock deterministically, which the worker flagged with a correct proposed fix (hold the lock from another process).

**F2** (synchronous `withLock` inside `job-state`/`ticket-moved` handlers could stall the event loop under contention) is inferred from `packages/core/src/lock.ts`'s `Atomics.wait`-based blocking `withLock`, correctly described, not reproduced, and correctly flagged as a suggestion (`queueLock`) rather than hidden.

**Cross-file consistency** — `blockedNotice` emits the notice even when the log write throws (verified against `events.ts`'s per-handler try/catch, so the `throw failed` after emit doesn't crash `arthur run`); redaction of a full 40-char commit hash vs. a kept 7-char `%h` confirmed against `credential.ts`'s `[\w-]{20,}` rule, matching the worker's "plan approvals must use `%h`" note. Docs (`decision.md`, `decisions.md`, `coordinator.md`, `plan.md`), roles/procedures (`coordinator.md`, `plan-ended.md`, `review-limit.md`), README table and `arthur.mmd` all updated consistently with the shipped behavior; `job-states.test.ts`/`plans.test.ts` updates are minimal and match the new output shape.

### Notes (non-blocking)
- F1/F2 are legitimate, already disclosed in `findings.md` as open; a follow-up ticket should harden the concurrency test (deterministic lock-holder) and consider `queueLock` for the hook handlers.
- No other issues found in the diff's scope.

PASS
