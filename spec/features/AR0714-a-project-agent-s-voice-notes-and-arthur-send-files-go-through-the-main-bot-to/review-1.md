# AR0714 - Review 1

- Job: 2026-11-24-review-f3e4dd78
- Branch: arthur/2026-11-23-worker-dabd19ca
- Commit reviewed: b72500990a7c6d42c395b344062fd1f95effb277
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0714 asks in telegram, discord, orchestration and the core, and my runs of the checks and mutations reproduced the worker's numbers.

**Done means, point by point:**
- **`channel.send` takes `instance`:** `packages/telegram/src/telegram.ts:73` and `packages/discord/src/discord.ts:91` now pick the bot with `named(asRecord(message).instance)`, which falls back to the main bot. Each channel has a test covering a named bot with and without a place, no `instance`, and an `instance` no bot has (`packages/telegram/test/media.test.ts`, `packages/discord/test/media.test.ts`).
- **The voice note goes where the reply's text goes:** `packages/orchestration/src/voice-reply.ts:18-19` passes the reply's `place` and `instance`. It is tested directly, and also end to end from a project's chat through the outbox (`packages/orchestration/test/voice-reply.test.ts`).
- **`arthur send` from a project agent goes to its chat:** `packages/core/src/send-command.ts:31-35` asks `actor.chat`. Orchestration answers it from `sessionOf(sessions)?.chat` (`packages/orchestration/src/orchestration.ts:102`), and that chat's fields are already checked by `chatProblem`. `packages/core/test/cli.test.ts` covers:
  - an agent's chat with a bot, and one without;
  - `--place`;
  - the coordinator's session;
  - a send that fails;
  - a chat on a plugin with no channel, which gets the new refusal.

  The `actor.chat` answers are tested in `packages/orchestration/test/actor.test.ts`.
- **Docs:** `send.md` and both channels' docs state the `instance` contract, and so do `plugin-api.md`, `coordinator.md`, `speak.md`, the project role and roadmap entry 86. I searched for the old wording ("sends files at once by the unnamed", `{ files, caption?, place? }`, every `arthur send` mention in the docs and roles) and found nothing stale. The coordinator role's "every enabled channel" is still true for the coordinator.
- **Scope and shape:** nothing outside the Scope changed beyond the docs and budgets the worker named. No boundary or Shape rule is broken: every changed source file is green (179 lines at most), budgets are raised as reported (core 7617, orchestration 3244), and the test names are made up (`shop`, `blog`, `docs`).
- **The one surviving mutant** (`send-command.ts:19`) only changes a parameter's type, which Node strips at run time. I put the old signature back by hand and `tsc` failed with `TS2339: Property 'chat' does not exist …`, so `npm run check` catches it. Then I restored the file.
- **Two choices for the owner,** both documented in `send.md` and acceptable: `--place` in an agent's session still sends through every channel by the main bot, and an `instance` no bot has falls back to the main bot (that one is already F3).

## Notes
- (minor) packages/core/src/host.ts:106: the core does not check the shape of the `actor.chat` answer (`as Chat`). An answer that is not an object would be spread into the message. Only orchestration provides the name, and it answers a checked chat.
- (minor) packages/telegram/src/media-out.ts:20, packages/discord/src/media-out.ts:19: the comment on `outgoing` still lists `{ files, caption?, place? }`. That is still what `outgoing` itself reads, since the bot is picked in `telegram.ts`/`discord.ts`.

## Checks (all on b72500990a7c6d42c395b344062fd1f95effb277)
- `npm run check && npm test`: tsc clean; `tests 1927, pass 1863, fail 0, skipped 64`.
- `npm run mutate`, run four times until no `not run (time)` was left: final summary `36 mutants, 35 caught, 1 survived`. The survivor is `packages/core/src/send-command.ts:19: hunk reverted to the base`, covered by `tsc` as described above.
- `npx arthur send --help`: prints the updated page, including "In a project agent's session the files go to that agent's chat alone".
- `git status --short` after the checks: empty.
- Twelve test processes were still running from the mutate runs cut short by time (`wrapper.ts` and `fake-agent.ts` under `/tmp/arthur-test-*`). I stopped them with `kill`, and `ps` showed 0 left.

PASS