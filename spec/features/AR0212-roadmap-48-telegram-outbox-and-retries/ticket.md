# AR0212 - Roadmap 48: Telegram outbox and retries

```json
{
  "id": "AR0212",
  "title": "Roadmap 48: Telegram outbox and retries",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 48 in `spec/roadmap.md`, the telegram outbox and its retries. With it comes the finding ticket AR0211, which is in the same files: a message to a named bot is answered by that bot.

## Goal

The specification is roadmap entry 48: its Delivers and Done means with every edge case, plus AR0211's Goal. No reply or notice to the owner is lost when Telegram is briefly unreachable.

- Kind: feat
- Budget: 10

## Done means

- Everything that entry 48's Delivers and Done means list, each refusal and edge case in its own test, plus AR0211 with a test.
- The tests use a fake Bot API on an OS-chosen loopback port and never the real bot. No token-shaped literal is in the repository: `git grep -nE "[0-9]{6,12}:[A-Za-z0-9_-]{20,}"` prints nothing.
- Tests wait for the very state they assert, never for a fixed time (2-core CI).
- README's table and `arthur.mmd` show 48 as built.
- `npm test` and `npm run check` pass, and the commits are signed off. The coordinator pushes the branch.

## Scope

In:
- `packages/telegram`, its docs and tests;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- orchestration, which the AR0154 batch changes now;
- the core.

## Decisions

- 2026-10-19: The coordinator starts this under the owner's 85% usage ceiling (80% used).
- 2026-10-19: The coordinator accepts telegram's budget 401 (the new outbox.ts) and the reading of the cut text: the refused-slice notice is cut with a note; /board and /findings cuts come with entry 50.
