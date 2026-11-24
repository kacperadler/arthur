# AR0714 - Review 2

- Job: 2026-11-24-review-953209e8
- Branch: arthur/2026-11-23-worker-dabd19ca
- Commit reviewed: 09d78b3f3615671a49db45f525fa41f468d61d82
- Verdict: PASS

## Final message

No blocking findings. Every point in the ticket's "Done means" holds on `09d78b3f`:

- **`channel.send` picks the bot by `instance`:** `packages/telegram/src/telegram.ts:73` and `packages/discord/src/discord.ts:91` now send by the bot `named(asRecord(message).instance)` returns. With no `instance`, it is the main bot as before. Each channel's `media.test.ts` checks a named bot, a named bot with a place, no instance, an unknown name and the main bot with a place. The fake APIs assert the token, chat and topic for each send.
- **Voice note by the reply's bot and place:** `packages/orchestration/src/voice-reply.ts:18-19` passes the reply's `place` and `instance` to `channel.send` and to the `voice note not sent` line. `voice-reply.test.ts` checks this directly and through the whole plugin, from the project's file to the outbox to `channel.send`.
- **`arthur send` from a project agent's session:** `packages/core/src/send-command.ts:31-35` sends to the agent's chat alone. Orchestration answers `actor.chat` from `sessionOf(sessions)?.chat`, and `chatProblem` checks that chat's shape when the project loads. `cli.test.ts` covers:
  - a named-bot chat: the other channel's refusal does not hold the send
  - a chat that names no bot
  - `--place`
  - the coordinator's session
  - a failing send
  - a chat on a plugin that is no channel (the new refusal)

  `actor.test.ts` covers the agent's own session, another agent's, the coordinator's, an unknown folder and outside any session.
- **Docs:** `send.md`, `telegram.md`, `discord.md`, `coordinator.md`, `speak.md`, `docs/plugin-api.md`, roadmap entry 86 and `roles/project.md` are updated. A search for the old contract `{ files, caption?, place? }` and "main bot" wording finds nothing stale. The two `media-out.ts:19-20` comments still describe what `outgoing` itself reads, which is correct.
- **Size and budgets:** every changed source file is green (all 179 lines or fewer). Raising the core budget to 7617 and the orchestration budget to 3244 passes `test/structure.test.ts`. The styleguide records a budget raise in the merge's outcome.md, not in the ticket's Decisions.
- **Boundaries:** no plugin imports another, the core imports no plugin, and there is no new dependency. All test resources sit in temporary folders.
- **Worker's claims:** the check and test counts and the mutate summary below match the worker's exactly.

## Notes

- (risk) packages/core/src/send-command.ts:33: `--place` from a project agent's session on a named bot goes by the main bot. With `--place`, the chat is ignored and every channel's main bot sends to that place. An agent that passes its own topic number recreates the bug this ticket fixes: the main bot's chat with the agent's topic. `send.md` documents this and the role never tells the agent its place, so it only happens through a slip.
- (minor) packages/orchestration/docs/commands/coordinator.md:101: "A check against a slip too, not a boundary" is hard to parse. It means `actor.chat` trusts `ARTHUR_ORCHESTRATION_FOLDER`. That is acceptable, but the sentence could say it plainly.
- (minor) outside the range: the core job tests in this checkout's mutate runs left four `wrapper.ts` and four `fake-agent.ts` processes under `/tmp/arthur-test-*` (fixtures `2026-10-16-worker-*`). I killed them; `pgrep` then counted 0. The worker saw the same leak.

## Checks (all on `09d78b3f`)

- `npm run mutate`, run four times until nothing was left `not run (time)`: final summary `36 mutants, 35 caught, 1 survived`. The one survivor is `packages/core/src/send-command.ts:19: hunk reverted to the base`, which is a comment plus `sendCommand`'s parameter type. I reverted that hunk by hand and `npx tsc --noEmit -p .` reported 5 `error TS` lines, so `npm run check` catches it. Restored with `git checkout -- packages/core/src/send-command.ts`; `git status --short` was empty afterwards.
- `npm run check`: tsc printed no errors.
- `npm test`: `tests 1929, pass 1865, fail 0, cancelled 0, skipped 64`, exit 0. The yellow lines printed are all files outside this range.

PASS