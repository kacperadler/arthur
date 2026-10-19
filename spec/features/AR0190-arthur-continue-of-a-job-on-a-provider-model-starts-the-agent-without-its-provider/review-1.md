# AR0190 - Review 1

- Job: 2026-10-19-review-ar0190-models-job-edfd7a33
- Branch: h/2026-10-19-ar0190-models-jobs-batch-f89d6b5b
- Commit reviewed: e4ffd1517cc7b021acf6ec1f8bc3852931828521
- Verdict: PASS

## Final message

Clean, no leftover mutations.

**Findings:** none blocking.

**Notes (non-blocking):**
- `packages/core/src/wrapper.ts` F1 (log recreation during `rm -r` can still `ENOTEMPTY`) is correctly left as an open finding, not required by AR0202's Done means (which only covers a failed `use`, no retry).
- AR0190 correctly skipped with a concrete, reproducible-by-reading rationale (commit-rules hook self-exec loop via `core.hooksPath`) and recorded as `findings.md` F1, per instruction's "skip it and say why."

**Checks run:**
- `npm ci`: installs cleanly (16 packages).
- `npm run check` (tsc): passes, no errors.
- `npm test` (full suite, `node --test`): 698/698 pass, matches worker's claimed count exactly.
- Mutation check, AR0191 (`packages/models/src/probe.ts`): disabled `queueLock` around the probe → cross-process test `two processes probing at once…` fails (`['/api/tags','/api/tags']` vs expected one request). Restored.
- Mutation check, AR0202 (`packages/core/src/wrapper.ts`): reverted `gone()` to ignore the `pid` check → new test times out with `timed out waiting for the agent's end`, matching the worker's claimed pre-fix failure. Restored.
- Mutation check, AR0198 (`packages/core/src/roles.ts`): dropped `warnings.push(...more)` → `roles.test.ts` prompt-sections test fails (`job.warnings` empty vs populated). Restored.
- Manually diffed `spec/roadmap.md`, `packages/machines/src/machine-check.ts`, `packages/machines/test/machines.test.ts`: roadmap corrected from `a1e5` to `a1e0`, machines plugin already at `a1e0` and untouched — AR0192 resolves the disagreement in the direction it claims, consistently across `models` docs/comment/test too.
- Confirmed `host.jobs.machines()` includes `"local"` by construction (`job-machine.ts`'s `machineRegistry`), so AR0193's unified local/remote doctor-line loop is sound; verified via the new `models.test.ts` doctor test (passed in full run) that `critical: true` holds for all three lines while the unreachable one still reports `ok (not reached: …)`, matching the Focus-stated coordinator decision.
- Confirmed line-budget arithmetic: `wc -l packages/core/src/*.ts` = 5798, minus `testing.ts`+`fake-agent.ts` (344) = 5454 = declared core budget; `packages/models/src/*.ts` = 506 = declared models budget. Matches the recorded reasons in `test/structure.test.ts`.
- Diff scope confined to `commit-rules`, `core`, `models`, `spec/roadmap.md`, two `findings.md`, `test/structure.test.ts` — no touch to `telegram`, `orchestration`, `resources` as instructed.
- All 8 commits carry `Signed-off-by`; scoped by ticket id in Conventional Commits form.

PASS
