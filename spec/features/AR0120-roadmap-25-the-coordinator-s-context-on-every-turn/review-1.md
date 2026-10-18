# AR0120 - Review 1

- Job: 2026-10-18-review-ar0120-coordinato-19ae802b
- Branch: h/2026-10-18-ar0120-coordinator-conte-623670be
- Commit reviewed: ab259400d2d6c854d87b9ab1f3af501e0f45059b
- Verdict: PASS

## Final message

## Review: AR0120 — the coordinator's context on every turn

### Findings
None that block merging.

### Notes (non-blocking)
- `README.md`/`arthur.mmd` still show entry 25 unbuilt (worker's F2); that's the coordinator's post-merge bookkeeping, not this ticket's Done means.
- The 60 s `execFile` timeout in `context-extension.ts` has no test, acknowledged by the worker; a real timeout test would be flaky/slow — reasonable to skip.

### Focus check 1 — orchestration budget raise 718→805
Walked every new/changed line in `packages/orchestration/src/`:
- `context.ts` (44 lines) and `context-extension.ts` (32 lines) are new, one job each, no duplication with each other or with `coordinator.ts`'s `CONTEXT_COMMAND` (that's reused, not re-derived).
- `coordinator.ts` (+5 net), `orchestration.ts` (+3 net), `spawn-rules.ts` (+5 net), `orchestration-options.ts` (+1) are minimal wiring for role registration, the `context` subcommand, and `coordinator.model`/`thinking` reaching `arthur roles`.
- No helper bag, no speculative option, no dead branch. Nothing is cuttable without losing a Delivers/Done-means item (role lookup by `host.jobs.registerRole`, the `collect("coordinator.context")` loop, per-project vision/board loop, night-across-midnight logic). Ticket's decision log already conditions the raise on "review finds nothing that could be cut" — confirmed.

### Focus check 2 — F1 against real omp
Built a scratch rig (own tmux socket `ar0120-f1-review-$$`, own folder under `/tmp`, removed after): started real `omp --continue --auto-approve -e env-guard -e inbox-extension.ts -e context-extension.ts` in a tmux session, with one inbox message carrying **no channel** (`{"text": "Job test-job-1 ended..."}`, i.e. Arthur's own message, exactly inbox.ts's `wake()` shape) pre-queued, and `ARTHUR_ORCHESTRATION_CONTEXT` pointed at a marker script instead of the real CLI (to observe firing, not re-test content already covered by `context.test.ts`).

Result: the inbox extension picked up the message via `sendUserMessage` after the 1 s idle-settle, the hook fired, the marker ran exactly once (`marker.log`: one line), and the model's own reply stated the marker text appeared in its context. This directly disproves the risk the worker flagged as `[INFERENCE]`: a turn holding only Arthur's own message does get the per-turn hook, hence the role, through `before_agent_start` in omp 18.3.0/18.12.1. No FAIL from F1.

### Checks run (in this worktree, not the main checkout)
- `npm ci` — clean, 7 packages.
- `npm run check` (`tsc`) — clean, no output.
- `npm test` — `401 tests, 401 pass, 0 fail` (matches worker's claim exactly).
- Real-omp F1 rig as above — hook fires on an Arthur-only turn; scratch tmux server killed and `/tmp` folder removed afterward.
- Spot-read `context.test.ts`, `roles.test.ts`, `host.test.ts`, `options.test.ts`, `coordinator.test.ts` diffs: each covers the edge case it's named for (missing/empty/symlinked vision, broken board JSON, throwing/non-string/empty `coordinator.context` answers, night across midnight both directions, `prompts` escaping via `..`/absolute/wrong-key, `roles.coordinator` refusal, subagent `--mode json` getting no injected context).
- Boundary check: `context.ts` imports only `@arthur/core/plugin`; `context-extension.ts` imports only `node:*`; projects/core changes stay inside their own packages; `@arthur/core/cli` is a proper new published export, not a path import.

PASS
