# AR0715 - Review 1

- Job: 2026-11-23-review-5e66b551
- Branch: arthur/2026-11-23-worker-4ce32038
- Commit reviewed: b700858f1d5e4ce58bea96a030fd30196b11b918
- Verdict: PASS

## Final message

No blocking findings. I checked the branch at b700858f against AR0715 and every Done means point is met:

- **Both orders refused:** the critical doctor line `orchestration chat of <project>` (`packages/orchestration/src/orchestration.ts:113-133`) now asks `sessionFor` which project's agent gets the chat's messages, using the main bot `channel.main` names. The later project of the pair gets `missing: its chat <chat> is project <other>'s too, <plugin>'s main bot being <name>; …`. That line names both projects and the chat, including its place, and it stops `arthur run`.
- **Each order's test fails without the fix:** with the base's `packages/orchestration/src` checked out, the order tests and the first-project test fail; with the branch's sources they pass.
- **Separate places, bots and channels still load:** this is tested, including a named bot beside an unnamed main bot, and the same bot name on another channel.
- **The load-time check is unchanged:** `sessions.ts` still compares bot names as written, and a comment now says so. Doing the check in doctor is one of the two options the ticket allows: a channel can set up after orchestration, so `channel.main` has no answer at load.
- **Routing behaves as before:** `inbox.ts` only swaps its local `main` lookup for the shared `mainBots`, which reads `channel.main` the same way. The worker's message explains the move.
- **Docs are updated:** `coordinator.md` "Project agents", the `channel.main` row of `docs/plugin-api.md` and roadmap entry 85. A search for the changed messages and `channel.main` found no stale text elsewhere.
- **Budget:** `orchestration` goes from 3225 to 3242 lines in `test/structure.test.ts`; the worker asks for the raise. Changed source files stay green (`orchestration.ts` has 175 lines).
- **No boundary or style-rule breaks:** no plugin imports another, no runtime dependency, no class or enum.
- **The worker's claims match:** the test counts, the mutation result and the files changed are all what I see. The branch has no `findings.md`.

Bypasses I looked for and found none:
- Three projects with one in between (tested).
- A named bot that is not the main one in the same place (tested).
- An unnamed main bot (tested).
- No `channel.main` answer yet: both chats are taken as written and pass, and the load check still refuses two exact copies.
- A non-string `channel.main` value: it compares the same way in routing and in the doctor line, so the two can't disagree.
- A chat always finds itself in `sessionFor`, so the coordinator is never wrongly named as the other project.

## Notes
- (minor) packages/orchestration/src/inbox.ts:35: the one mutation that survived, "hunk reverted to the base", only puts back the old unused local `main` lookup. Behavior is identical (an equivalent mutant), so no test is missing.
- (minor) packages/orchestration/src/orchestration.ts:128: the `fix` getter calls `channel.main` again instead of reusing the answer `check` got. If a channel's main bot changed between the two reads, the fix could disagree with the line it explains.
- (minor) packages/session/src/sessions.ts:24 (outside the range): this still has its own copy of the `channel.main` lookup that `mainBots` now holds.

## Checks (on b700858f)
- `npm run check`: `tsc` clean.
- `npm test`: tests 1920, pass 1856, fail 0, skipped 64.
- `npm run mutate`: 25 mutants, 24 caught, 1 survived (`packages/orchestration/src/inbox.ts:35: hunk reverted to the base`).
- With the base's `packages/orchestration/src` checked out, `node --import @arthur/core/testing --test --test-name-pattern="doctor:" packages/orchestration/test/project-agents.test.ts` gave pass 2, fail 3: both order tests and the first-project test failed. I restored the sources with `git checkout HEAD -- packages/orchestration/src`; `git status --short` was clean.

PASS