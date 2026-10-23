# AR0346 - Review 1

- Job: 2026-10-23-review-ar0346-copy-names-f485fda2
- Branch: h/2026-10-23-ar0346-copy-names-b6580c1f
- Commit reviewed: 8516f33ae6ba29af3f13b6fd5d89ae563e8b6aa3
- Verdict: PASS

## Final message

Worktree clean, at the reviewed commit.

**Findings:** none.

**Notes**
- `packages/core/test/machine.test.ts:452-456`: the worker's final message claims "even plain keys of other jobs in the same answer are not written," but the test's fake `records` answer only ever contains one job's key (`job.id`); the multi-job-in-one-answer case isn't exercised. Reading `machine-sync.ts:58` confirms the loop (`for (const id of ids) for (const name of Object.keys(answer[id]?.files...))`) does validate every id before any write, so the claim holds in the code, just untested at that granularity. Ticket's Done means doesn't require a multi-job test, so not a blocker.
- Allowed-name regex also refuses `mcp.yml`; confirmed via `remote-job.ts` `records` handler and `job-record.ts` that `mcp.yml` is only ever written when `writeRecord` is called with `mcp`, which `remote-job.ts`'s `add` always omits — so `mcp.yml` never appears in a remote job's folder and is never sent. No live regression.
- Ticket's line-budget Decision (5815→5817) is already recorded in `spec/features/AR0346.../ticket.md`, so the worker's "needs action" item is resolved.

**Checks run**
- `npm ci`: clean.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 1055/1055 pass, 0 fail — matches worker's claim exactly.
- `node --test --test-name-pattern="plain record key" packages/core/test/machine.test.ts`: baseline passes.
- Mutation 1 (delete the check line): test fails with "Missing expected exception" — matches claim.
- Mutation 4 ($ anchor dropped): test fails on the first key (`sub/../../<id>/branch` no longer refused) — matches claim.
- Mutation 5 (check moved into per-file write loop): test fails, diff shows the earlier plain `cost` key got written before the bad key threw — matches claim.
- File restored after each mutation (`diff` against saved original showed no change); `git status --porcelain` clean at the end.
- Verified by reading `job-record.ts`, `job-control.ts`, `job-state.ts`, `machine-sync.ts`, `job-scope.ts`, `wrapper.ts` that every record-file name ever written matches `^[a-z][a-z0-9-]*$`, so the new check introduces no false refusal of a legitimate key.
- Docs diff in `spawn.md` read against the code: accurate.
- Structure-test budget diff (+2, 5815→5817) matches the +2 lines actually added to `machine-sync.ts`.

PASS
