# AR0706 - Review 1

- Job: 2026-11-14-review-464eadc0
- Branch: arthur/2026-11-14-worker-8a88fde0
- Commit reviewed: f4588e4cf37b64c413ead11af76aa47954a1be58
- Verdict: FAIL

## Final message

## Findings

1. **Untested key behavior: a project agent's reply to a turn with no owner message can go to every channel.** `packages/orchestration/src/inbox.ts:171`. The sweep swaps an agent's reply `channels` for `[chat.plugin]`. The plan's Risks section depends on this: "a reply from a project agent names `channels: [chat.plugin]`, and the other channels ignore a `place` that is not theirs". It only changes anything when `file.channels` is `[]`, which happens when an agent's turn held only Arthur's messages (a job's end, a plugin message, a tell). An empty `channels` means every channel sends the reply. So without this swap, shop's reply to its job's end would also reach Discord's main channel and every other channel. No test catches it, so it is a FAIL under review.md:
   - Mutation: `channels: channel === undefined ? file.channels : [channel]` → `channels: file.channels`.
   - Result: `node --import @arthur/core/testing --test "packages/orchestration/test/**/*.test.ts"` gave 235 tests, 196 pass, 0 fail, 39 skipped. The mutant survives. File restored with `git checkout`.
   - Why it is missed: project-routing.test.ts's "an agent's reply and notice go to its chat" writes its `channels: []` reply only while silent mode is on, so it is held and never emitted. Shop's other reply already has `channels: ["telegram"]`, which is the same with or without the swap.

2. **When every bot has a name, the owner's messages in a project chat on the main bot go to the coordinator.** `packages/orchestration/src/sessions.ts:50`. `sessionFor` requires `chat.instance === to.instance`. A chat that names no `instance` means the plugin's main bot, which is the first bot when every bot has a name (telegram.md, "Project chats"; `main` at `telegram.ts:39` and `discord.ts:45`). But a named bot's messages always carry `instance: bot.name` (`poll.ts:79`, `receive.ts:74`), so they never match that chat.
   - Probe: `sessionFor([coordinator, { project: "shop", chat: { plugin: "telegram", place: "42" } }], { channel: "telegram", instance: "first", place: "42" })` returned `coordinator`.
   - Effect: the agent's replies still go to topic 42 by the main bot, but the owner's messages there reach the coordinator, and its reply goes to the main chat.
   - Roadmap 86 asks that a message whose channel, instance and place a chat names goes to that agent. This is that requirement's edge case.

## Notes
- (minor) spec/roadmap.md:906: Discord entry 89's Delivers line still reads "until the project agents (86) route by place, a message from a project's channel reaches the coordinator". It is bounded by "until", but entry 86 now does the routing.
- (minor) packages/orchestration/docs/commands/coordinator.md:34: "What reaches it" still lists `coordinator-message` as `{ text }`. `project?` and its routing appear only under "Project agents" and in docs/plugin-api.md.
- (risk) packages/orchestration/src/inbox.ts:169: a removed agent's unsent `outbox/*.json` (a reply or notice written before the restart) is never swept. `sweep` only walks the current sessions. The start-time recovery moves `queued/` and `turn/` but not the outbox, so that reply is never sent.

## Checks (all on f4588e4c)
- `npm run check`: `tsc`, no errors.
- `npm test`: 1863 tests, 1799 pass, 0 fail, 0 cancelled, 64 skipped. The skipped tests need tmux, which this sandbox can't start.
- `npm run mutate`, run three times until nothing was left "not run (time)":
  - Final summary: `100 mutants, 99 caught, 1 survived; 335 not run (--max 100)`.
  - Survivor: `packages/orchestration/src/inbox.ts:24: hunk reverted to the base`. It puts back the unused `const RESULT_LINES = 15;`, which nothing reads since `wake()` moved to `wake.ts`, so no test can catch it. This matches the worker's claim.
- Hand mutation of `inbox.ts:171` (finding 1): orchestration tests 196 pass, 0 fail, so the mutant survives; restored.
- `sessionFor` probe (finding 2): a named main bot's message in topic 42 was routed to the coordinator.
- The worker's claims match what I see:
  - Budget raises, named in its earlier final message: orchestration 3070→3183, telegram 702→705, discord 977→981, delivery 2327→2328.
  - No changed source file is over 200 lines; `inbox.ts` is 176.
  - findings.md F1 to F3 are on the branch.
- The checkout is clean at the end (`git status --short` empty).
- Two test processes my runs left behind (pids 3943463 and 3943612: a fake job's wrapper and its fake agent) are stopped.

FAIL