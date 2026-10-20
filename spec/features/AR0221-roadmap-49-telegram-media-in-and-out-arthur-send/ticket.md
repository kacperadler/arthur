# AR0221 - Roadmap 49: Telegram media in and out, arthur send

```json
{
  "id": "AR0221",
  "title": "Roadmap 49: Telegram media in and out, arthur send",
  "date": "2026-10-20"
}
```

## Description

This ticket builds roadmap entry 49 in `spec/roadmap.md`: photos, videos, voice notes, audio and files reach the coordinator as the `parts` of `message-received`, and `arthur send` sends them out, with the optional `place` from AR0098.

## Goal

The specification is roadmap entry 49: its Delivers, Done means with every refusal and edge case, and Also delivers (`place`). The owner can send Arthur media from the phone and Arthur can send media back.

- Kind: improvement
- Budget: 10

## Done means

- Everything that entry 49's Delivers, Done means and Also delivers list, each refusal and edge case in its own test.
- The tests use a fake Bot API on an OS-chosen loopback port and never the real bot. No token-shaped literal is in the repository: `git grep -nE "[0-9]{6,12}:[A-Za-z0-9_-]{20,}"` prints nothing.
- Tests wait for the very state they assert, never for a fixed time (2-core CI).
- README's table and `arthur.mmd` show 49 as built.
- `npm test` and `npm run check` pass, and the commits are signed off. The coordinator pushes the branch.

## Scope

In:
- `packages/telegram`, its docs and tests;
- the core's `message-received` `parts` contract, `channel.send`, and `arthur send`, as entry 49 names them;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- `packages/youtrack`, which AR0220 changes now;
- phone commands and the menu (entry 50).

## Decisions

- 2026-10-20: The owner approved it with AR0220 and raised the usage ceiling to 90% of Claude 7 Day (85% used at the start).
