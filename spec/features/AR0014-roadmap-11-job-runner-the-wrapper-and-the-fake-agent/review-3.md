# AR0014 - Review 3

- Job: 2026-10-16-review-ar0014-wrapper-an-1f93af5f
- Branch: h/2026-10-16-ar0014-wrapper-and-fake-e707fea6
- Commit reviewed: 4ef1f32077ecd9c32642637a4973b101cd94d9c3
- Verdict: PASS

## Final message

## Review: round 3 (merge-only), commit 4ef1f32

**Scope.** New work since the PASSed d1b32cc is only the merge commit `4ef1f32` (merge main → branch), resolving conflicts in `README.md`, `packages/core/docs/commands/spawn.md`, `packages/core/test/spawn.test.ts`.

**Findings:** none.

**Verification against the Focus list**

1. **Wrapper + process-group stop kept** — `wrapper.ts` still sends `SIGTERM` to `-process.pid` (the job's process group) in `stopAgent`; `wrapper.test.ts` still has the real-grandchild test (`sleep 100` backgrounded by a fake `omp`) and the `until()`-based polling fix for the earlier flaky assertion. Mutation: reverted the group-kill to a plain `process.kill(process.pid, ...)` → both "record deleted" tests failed/timed out as expected. Reverted (`git checkout -- packages/core/src/wrapper.ts`, clean diff after).
2. **AR0048 ticket check and its tests kept** — `host.ts`'s `jobs.beforeSpawn("core", ...)` refusal logic unchanged by the merge; `spawn.test.ts`'s ticket-check tests are untouched (diff vs main shows only one new test added, the background-agent one). Mutation: forced the refusal's condition to always return `[]` (no refusal) → `"a worker on a ticket that cannot move to in-progress is refused..."` failed as expected. Reverted (`git checkout -- packages/core/src/host.ts`, clean diff after).
3. **`readEvents` from `event-log.ts` everywhere, no shim** — grep across `src/` and `test/` confirms every import is `from "../src/event-log.ts"` (or `./event-log.ts`); `events.ts` does not re-export `readEvents`.
4. **`spawn.md` has both** — merged doc keeps the branch's wrapper paragraph, the `base` record field, and main's AR0048 ticket-refusal bullet in the "Refused" list (confirmed by diffing merged file against both parents).
5. **No test lost** — `169 + 18 + 20 = 207`; `npm test` ran exactly 207, all passing.
6. **`npm test` passes** — 207/207, 0 failures.
7. **No leftover wrapper/agent process** — `pgrep -af "wrapper.ts"` and `pgrep -af "fake-agent|starts.jsonl"` empty after the full suite run.

**Checks run**

- `npm ci`: clean, 5 packages added.
- `npm run check`: passes, no output.
- `npm test`: 207 total, 207 pass, 0 fail.
- `pgrep -af wrapper.ts` / `pgrep -af "fake-agent|starts.jsonl"` after the run: empty.
- `git grep "<<<<<<<\|=======\|>>>>>>>"` on the three conflicted files: none.
- Diffed `README.md`, `spawn.md`, `spawn.test.ts` against both merge parents (`d01447b` main, `d1b32cc` branch): merge keeps every piece of content from both sides; `spawn.test.ts`'s only net addition is the new background-agent test, AR0048's ticket tests present unchanged.
- Mutation 1 (wrapper.ts `-pid` → `pid`): caught by `wrapper.test.ts`'s two "record deleted" tests. Reverted, verified clean.
- Mutation 2 (host.ts ticket-refusal condition forced to `true`/no-op): caught by `spawn.test.ts`'s ticket-cannot-move test. Reverted, verified clean.
- `git status --porcelain`: clean; `HEAD` at `4ef1f32077ecd9c32642637a4973b101cd94d9c3`, matching the task's commit.

**Notes (non-blocking)**

- Carry-forward from round 2 PASS (not re-litigated here per Focus): `arthur spawn` with a real `omp` is still an outstanding human-run need, correctly named in the final message.

PASS
