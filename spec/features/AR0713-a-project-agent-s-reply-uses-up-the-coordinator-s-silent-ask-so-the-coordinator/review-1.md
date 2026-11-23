# AR0713 - Review 1

- Job: 2026-11-23-review-2f797f8e
- Branch: arthur/2026-11-23-worker-72202bff
- Commit reviewed: 39a7a2305ccbb3b9e0236a449cb8b319eed06d79
- Verdict: PASS

## Final message

I found no blocking findings. Branch `arthur/2026-11-23-worker-72202bff` at `39a7a230` meets each of AR0713's "Done means" points:

- **Per-session ask:** `arthur silent ask` now writes the mark into the folder of the session that ran it. It goes to the coordinator's folder when run outside every session (`silent.ts:113`). `sweep` passes the swept session's folder to `held` (`inbox.ts:176`), so another session's reply stays held and does not use up the ask.
- **Race test:** the new test in `silent.test.ts:167` asks once as the coordinator, sweeps shop's reply, then sweeps the coordinator's question. It asserts the agent's reply is held and the question is sent. With the old shared file, shop's reply would have used up the ask and this assertion fails. I confirmed it fails when the ask is written to the coordinator's folder regardless of session (hand mutation below).
- **Role:** `roles/project.md:45` tells the agent to run `arthur silent ask` first in a turn that asks the owner for a decision.
- **Scope Out:** the global on/off switch and the grants are unchanged.
- **Change outside the Scope, with a reason given:** a one-line move in `inbox.ts:108` hands a removed agent's `silent-ask` to the coordinator at `arthur run`'s start. The worker's message explains why: without it, per-session asks would hold that agent's question, which the shared ask used to let through. It is tested in both directions in `project-routing.test.ts:142`.
- **Docs:** `silent.md` and `coordinator.md` now describe where each session's mark lives, who removes it, and the hand-over at `arthur run`'s start. A search for `silent-ask`, `silent ask` and `one ask` found no stale text.
- **File sizes:** `silent.ts` is 191 lines and `inbox.ts` 184, both green. The structure and budget tests pass.
- **Ticket's findings:** F1 and F2 do not name any other project.

## Notes
- (risk) `packages/orchestration/src/silent.ts:113`: an agent whose project was taken out of the config while `arthur run` keeps sweeping its outbox would have its `arthur silent ask` fall back to the coordinator's folder (`sessionOf` finds no session for it). The coordinator's next reply would then pass and the agent's decision question would be held. The test at `silent.test.ts:195` pins that fallback, but no doc says what happens to such an agent's question. This is close to F1, but this case is a running agent, not the hand-over at start.
- (minor) `packages/orchestration/src/silent.ts:99`: the mutation `rmSync(join(session, ASK), { force: true })` → `{ force: false }` survives. It only matters if the mark disappears between `held`'s read and its remove (a concurrent `silent off`). The option was already there before this branch; the worker reports it.
- (minor) `packages/orchestration/src/silent.ts:17`: `FILE` is exported but nothing imports it. Only `ASK` is used outside the file; the shared `export const [FILE, ASK]` was written to save lines.

## Checks (all on `39a7a230`, in this checkout)
- `npm run mutate`: `mutate: 38 mutants, 37 caught, 1 survived`. The survivor is the `force: false` mutation above.
- Hand mutation 1: in the `ask` command, wrote the mark to `join(folder, ASK)` instead of the session's folder. `silent.test.ts` failed 1 test (`not ok 6`, the AR0713 test); 14 passed.
- Hand mutation 2: removed `!existsSync(join(folder, ASK))` from `inbox.ts:108`. `project-routing.test.ts` failed 1 test (`not ok 6`, the removed agent's ask test); 10 passed.
- Both files restored with `git checkout --`; `git status --short` shows 0 lines.
- `npm run check && npm test`, one call: `tsc` clean; tests 1918, pass 1854, fail 0, cancelled 0, skipped 64. This matches the worker's numbers.

PASS