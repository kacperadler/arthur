# AR0164 - Review 1

- Job: 2026-10-19-review-ar0164-4d21a782
- Branch: h/2026-10-19-ar0164-4ef46084
- Commit reviewed: 21ec75c88ac9491b212c1ac0240e5ca156cde886
- Verdict: PASS

## Final message

Clean, no leftover edits.

---

**Findings:** none.

**Notes:**
- `packages/orchestration/src/credential.ts` and `packages/session/src/credential.ts` are byte-identical except for their header comments (verified by direct read of both files). Each comment points to the other, satisfying the ticket's "change both together" instruction. This duplication is explicitly sanctioned by the ticket's Done means and the Decision line (orchestration 1146→1163 accepted).
- Doc wording in `coordinator.md` is copied verbatim from `session.md`'s existing redaction-rules sentence — consistent, not misleading.

**Checks run (in this worktree, against the judged range):**
- `npm ci`: installs cleanly (11 packages, 0.6s).
- `npm run check` (tsc): no errors.
- `npm test`: 549 tests, 549 passed, 0 failed, 228.97s — matches worker's claimed 549/549.
- `node --test --test-name-pattern="credential in omp's error" packages/orchestration/test/inbox.test.ts`: 1 passed, 8.0–8.4s — matches worker's claimed 8.1s.
- Mutation 1 (removed `redact(...)` call around `last?.errorMessage`): test fails, raw `sk-ant-api03-AbCdEf123456`, `(hunter-two-secret)`, and `req_011CgAWsav66AwnrHwNLjFA6` appear unredacted in the asserted notice text. Reverted via `git checkout --`.
- Mutation 2 (zeroed out the env-var lookup in `credential.ts`'s `redact`, leaving the vendor-prefix/Bearer/generic-run rules active): test fails, specifically only `(hunter-two-secret)` leaks unredacted (the vendor key and request id are still caught by the other rules) — proves the env-var step is load-bearing and that `ARTHUR_INBOX_TEST_API_KEY`'s value really reaches the fake agent through the real tmux session. Reverted via `git checkout --`.
- `cat packages/orchestration/src/*.ts | wc -l` → 1163, matching the new `BUDGETS` entry and the worker's arithmetic (1146 + 17).
- `git status --short` after both mutation/revert cycles: clean, nothing left behind.

Diff matches the ticket's Done means exactly (own copy of `credential.ts`, test of a key in the error, wording of the notice unchanged — confirmed only the `redact(...)` wrapping call was added to the template string), the ticket's Decision line explicitly accepts the +17 budget raise, and the instruction's determinism requirement (`until` waits for `box.emitted("notice").length === 1`, not a fixed delay). No boundary violation: `credential.ts` is a same-package sibling import, not a cross-plugin import. Scope is tight — no unrelated changes.

PASS
