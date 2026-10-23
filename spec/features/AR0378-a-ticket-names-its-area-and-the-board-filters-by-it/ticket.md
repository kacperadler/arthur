# AR0378 - A ticket has a Conventional Commits kind, and the board filters by it

```json
{
  "id": "AR0378",
  "title": "A ticket has a Conventional Commits kind, and the board filters by it",
  "date": "2026-10-23"
}
```

## Description

A ticket's Kind becomes one of the Conventional Commits types plus two of our own: feat, fix, security, perf, refactor, test, docs, build, ci, chore, ux. The board shows each ticket's Kind, and `/board <kind>` on Telegram (and the CLI's `--kind <kind>`) lists only that kind's tickets, so the human sees, for example, every security fix of a project at once.

## Goal

The human asked on 2026-10-23 to group tickets by kind in every project the harness and Arthur run, by extending Kind along Conventional Commits, and approved the list below. Moves vision direction A: the human reviews outcomes, grouped.

- Kind: feat

## Done means

- The template's Kind line lists exactly: feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux; a ticket with any other Kind is refused where the template checks refuse today (`h ticket status`); a test.
- Autopilot accepts Kind fix, refactor, chore, docs, test and refuses the others, with its existing reason text; its tests updated to the new list.
- Every existing ticket is migrated in the same branch: bug -> fix, cleanup -> refactor, improvement -> feat, risk -> security; the merged and dropped ones too, so no old Kind is left; a test that no ticket keeps an old Kind.
- The board digest shows a ticket's Kind after its status; a test.
- `/board <kind>` (Telegram) and the CLI `--kind <kind>` list only tickets of that Kind across every status; a word outside the list answers with the list; a test of each.
- `npm test` and `npm run check` pass.

## Scope

In:
- the ticket template, the board digest and its command, the Telegram board command, autopilot's Kind rule, the migration of every ticket's Kind line, their docs.

Out:
- re-judging old risk tickets that were not about security (the coordinator relabels the open ones to fix by hand).

## Decisions

- 2026-10-23: The human asked for categories on tickets in every project the harness and Arthur run.
- 2026-10-23: The human: extend Kind along Conventional Commits rather than a separate Area; approved the list feat, fix, security, perf, refactor, test, docs, build, ci, chore, ux ("Lista wygląda OK"); autopilot keeps fix, refactor, chore, docs, test.
- 2026-10-23: Coordinator: follows K0271 (the harness), using the same list and migration; Arthur's board command and its Telegram plugin.
