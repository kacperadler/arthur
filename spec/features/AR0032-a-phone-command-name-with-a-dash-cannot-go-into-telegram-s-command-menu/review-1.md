# AR0032 - Review 1

- Job: 2026-10-16-review-ar0032-phone-comm-688f1165
- Branch: h/2026-10-16-ar0032-phone-command-das-c4283e06
- Commit reviewed: 5d4c8dac3ffcabc0558615f7c90301559bb48bb1
- Verdict: PASS

## Final message

## Findings

None blocking.

**Investigated and dismissed:** the focus item about `PHONE_NAME` disallowing underscores/digit-starts relative to Telegram's documented `[a-z0-9_]{1,32}` (confirmed via `core.telegram.org/bots/api/types/botcommand` and `bots/features`: command chars are letters, digits, underscores, no stated start restriction). This looked like an over-restriction, but probing it empirically shows the pre-existing base `NAME` regex (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, untouched by this diff) already forbids underscores and digit-starts for *every* command, phone or not — `my_cmd` and `7days` are refused by that base check before `PHONE_NAME` is ever reached. So `PHONE_NAME` is a strict, harmless subset of what's already achievable in this codebase; it adds exactly the two things the ticket asks for (no dash, ≤32 chars) and nothing more. Not a functional bug.

**About limit (1–256 vs ticket's stated 3–256):** worker verified against the live Bot API doc (`BotCommand.description`: "1-256 characters") and used the correct, current value, flagging the discrepancy transparently in the final message. Correct call, not a silent deviation.

**Verified independently**
- `npm ci`, `npm run check`, `npm test` in this worktree: tsc clean; 154/154 tests pass — matches the worker's claim.
- Mutation 1: disabled the `PHONE_NAME` refusal (`if (false && !PHONE_NAME.test(name))`) → new test fails with `Missing expected exception` for `review-needed`. Restored.
- Mutation 2: disabled the `about` refusal similarly → new test fails for the empty-`about` case. Restored.
- `git status --short` clean after each mutation restore.
- Confirmed no phone command is registered anywhere else in the repo yet (`grep phone:\s*\{` across `packages` → no matches), so nothing existing is broken; roadmap-named phone commands (`jobs`, `steer`, `stopall`, `board`, `task`, `findings`, `plan`, `projects`, `restart`) are all ≤32 chars, no dashes.
- Non-phone commands still accept dashes: test registers `command("review-needed")` with no `phone` and it succeeds; `commands.names()` includes it with the dash intact.
- Refusal message format (`plugin <owner>: setup failed: command <name>: ...`) matches the pre-existing wrapping convention used by every other registry refusal test in the suite (`commands.test.ts:58,62,70,104`, `cli.test.ts:116`).
- `help.md` updated to describe the new refusals; file sizes and structure tests (line-budget, no-index/types/utils, boundary tests) all pass as part of the 154.

## Notes (non-blocking)
- `PHONE_NAME`'s own exclusion of underscores/digit-starts is redundant with the base `NAME` check given current call sites, but it's self-documenting at the point where the phone-specific limit is asserted; not worth the churn of deriving it from `NAME` instead.

PASS
