# AR0208 - Roadmap 47: Telegram receive and send text, and the silent mode

```json
{
  "id": "AR0208",
  "title": "Roadmap 47: Telegram receive and send text, and the silent mode",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 47 in `spec/roadmap.md`:
- the `telegram` plugin, which receives and sends text;
- in orchestration, the silent mode (`arthur silent` and `/silent`).

From here the owner can talk to Arthur instead of the harness.

## Goal

The specification is roadmap entry 47: its Package, Delivers and Done means with every edge case. Its dependencies 24, 25, 27 and 7 are merged.

- Kind: improvement
- Budget: 12

## Done means

- Everything that entry 47's Delivers and Done means list, each refusal and edge case in its own test.
- The tests use a fake Telegram Bot API on an OS-chosen loopback port and never the real bot or the harness's bot token.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time.
- README's table and `arthur.mmd` show 47 as built.
- `npm test` and `npm run check` pass, and the work is committed. The coordinator pushes the branch.

## Scope

In:
- `packages/telegram`;
- orchestration's silent mode, as the entry names;
- docs, README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- youtrack, which another job (AR0206) is changing now;
- the outbox and retries (48).

## Decisions

- 2026-10-19: The coordinator starts this under the owner's 85% usage ceiling (79% used).
- 2026-10-19: The coordinator accepts the budget raises: orchestration 1213 to 1334 (5 lines cut first), telegram 243. Replies and notices go from the unnamed bot (else the first), finding F2. /silent from Telegram waits for entry 50; the 429 retry_after wait is accepted.
