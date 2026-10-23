# AR0378 - A ticket names its area, and the board filters by it

```json
{
  "id": "AR0378",
  "title": "A ticket names its area, and the board filters by it",
  "date": "2026-10-23"
}
```

## Description

A ticket gets an optional area line (`security`, `ci`, `client`, ...) next to its Kind, and `/board <area>` on Telegram and `h ticket --area <area>` (Arthur: `arthur ticket --area`) list only that area's tickets. The human sees, for example, every security fix across a project at once.

## Goal

The human asked on 2026-10-23 to group tickets by area across every project the harness and Arthur run ("np tutaj zrobić security"). Kind (bug, risk, cleanup, improvement) stays as it is, because autopilot reads it (`src/autopilot.ts:29`); the area is a separate free label, not a fifth Kind. Moves vision direction A: the human reviews outcomes, and needs them grouped.

- Kind: improvement

## Done means

- `_template/ticket.md` shows `- Area: <word>` under Kind, optional; a ticket without it is unchanged and still passes the template checks; a test.
- The board digest shows a ticket's area after its status; a test.
- `/board <area>` (Telegram) and the CLI `--area <area>` list only tickets of that area, across every status; an unknown area lists none and says so; a test of each.
- Autopilot's rules and their tests are unchanged.
- `npm test` and `npm run check` pass.

## Scope

In:
- the ticket template, the board digest, the board command and its Telegram command, their docs.

Out:
- filling the area of old tickets (the coordinator does it for open ones).

## Decisions

- 2026-10-23: The human asked for areas on tickets in every project the harness and Arthur run; options sent (keep as is, an Area line with a filter, a fifth Kind), Area line recommended; waiting for the human's choice.
