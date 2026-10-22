# AR0277 - Review 1

- Job: 2026-10-22-review-ar0277-eval-turn-edc0f089
- Branch: h/2026-10-22-ar0277-eval-turn-wording-9459b77a
- Commit reviewed: 0f47fd2bb6a463e80c68f6938d93c32fa877c23b
- Verdict: PASS

## Final message

Findings (none blocking):

- None. Implementation matches ticket's Done means exactly: orchestration provides `coordinator.turn(event name, data, result)` via `host.provide`, backed by the shared `hand-over.ts` (new file, 12 lines) that both `inbox-extension.ts` and `inbox.ts`'s `turn()` call — no duplicated wording. `develop/eval-scenario.ts` drops its hand-built copy and calls `host.call("coordinator.turn", …)` for all three turn kinds; `readScenario`/`eval-command.ts` correctly made async and awaited.
- Refusals match the ticket's three named cases and are each asserted with the exact `coordinator.turn: …` prefix in `inbox.test.ts`; mutating the non-text-part check (removing it) turns the dedicated test red, confirming the test actually guards it.
- No side effects on a claimed (non-text) part: `turn()` checks `message.parts` for a non-"text" kind and throws before calling `turnText`, so `claim()`/`message.part` is never invoked and no `coordinator-replied` is emitted — verified by the test's explicit `coordinator-replied` count and empty `inbox/queued`+`inbox/turn` assertions.
- Shared-source wiring verified by mutation: stripping the `[via <channel>]` branch in `hand-over.ts` breaks 9/11 `inbox.test.ts` tests (both the extension's live path and `coordinator.turn`), proving one real shared source, not two copies that happen to agree.
- `develop` correctly forwards `turn.result` as `coordinator.turn`'s third argument; mutating that call to pass `undefined` instead breaks the dedicated `eval.test.ts` turn-building test.
- Boundaries respected: `develop` never imports `orchestration`; `hand-over.ts`/`inbox.ts` only import `@arthur/core`'s published exports (`describe`, `/parts`) plus local orchestration files.
- Shape rules hold: all touched files ≤200 lines (hand-over.ts 12, inbox.ts 184, inbox-extension.ts 195, eval-scenario.ts 98); no class/enum/index.ts/types.ts/utils.ts; no new runtime deps. Line budgets (`orchestration` 2020, `develop` 577) match `cat packages/<pkg>/src/*.ts | wc -l` exactly, and match the ticket's approved 1991→2020 decision; the comment above `BUDGETS` explains the delta per file.
- Docs updated and accurate: `docs/plugin-api.md` row, `coordinator.md` bullet, `eval.md` wording all describe the real behavior (checked against code).
- `findings.md` is well-formed (F1, F2, `Status: open`), scoped to this ticket's folder, no real client/project names, no secrets.
- Second commit touches only `findings.md` (+9 lines), as claimed; first commit carries all code/doc/test changes.

Notes (non-blocking):
- `inbox.test.ts` still hardcodes the `ARTHUR` literal for assertions rather than importing it from `hand-over.ts`; harmless since the test compares against the shared function's actual output, not against itself.

Checks run (in this worktree, on the reviewed commit):
- `npm ci` — clean.
- `npm run check` — clean (tsc, no errors).
- `npm test` (full suite) — 986/986 passed, 0 failures (includes the telegram menu test the worker flagged as flaky elsewhere — passed here, consistent with it being an unrelated intermittent race per F2).
- Mutation 1: removed the non-text-part refusal in `inbox.ts` → `inbox.test.ts`'s `coordinator.turn …` test fails (✖); restored, `git diff` clean.
- Mutation 2: dropped the `[via <channel>]` branch in `hand-over.ts` → 9/11 tests in `inbox.test.ts` fail; restored, `git diff` clean.
- Mutation 3: replaced `turn.result` with `undefined` in `eval-scenario.ts`'s job-ended call → `eval.test.ts`'s turn-building test fails; restored, `git diff` clean.
- Verified line budgets via `cat packages/orchestration/src/*.ts | wc -l` = 2020 and `cat packages/develop/src/*.ts | wc -l` = 577, matching `structure.test.ts`'s `BUDGETS`.
- `git status --short` clean at end (no leftover mutation artifacts).

PASS
