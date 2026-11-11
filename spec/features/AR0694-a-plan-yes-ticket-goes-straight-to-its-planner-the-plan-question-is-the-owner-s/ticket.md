# AR0694 - A Plan: yes ticket goes straight to its planner; the plan question is the owner's one decision

```json
{
  "id": "AR0694",
  "title": "A Plan: yes ticket goes straight to its planner; the plan question is the owner's one decision",
  "date": "2026-11-11"
}
```

## Description

A ticket marked `- Plan: yes` goes straight to its planner, without first asking the owner to approve the ticket. His answer to the plan question is his one decision on it, and still must name its id (AR-D603).

## Goal

Each planned ticket cost two asks this period, one for the ticket and one for its plan: AR0671 (AR-D593, AR-D596), AR0685 (AR-D623, AR-D633), AR0686 (AR-D625, AR-D634), AR0689 (AR-D635, AR-D636, AR-D643), AR0655 (AR-D531, AR-D534), AR0482, AR0483, AR0667. In 60 plan asks the owner refused none. `packages/orchestration/docs/commands/plan.md` step 3 already sets the ticket planned from the plan decision alone. Retro 2026-11-11, proposal 2. Cost: a planner budget may be spent on a ticket he then drops.

- Kind: chore

## Done means

- The coordinator role's `- Plan: yes` bullet says the plan job starts without a first approval ask, within the usage limit he set, and that the plan question's approval sets the ticket planned with `--decision`.
- The planning-ticket bullet under "Tickets and board" names the exception, so the two do not contradict.
- `npm run check` and `npm test` pass (role prose tests included).

## Scope

In:
- `packages/orchestration/roles/coordinator.md`: the Commands bullet on `- Plan: yes`, and the planning bullet under "Tickets and board".

Out:
- AR-D603: every plan still needs the owner's own answer naming its id.
- The plan command's code: unchanged.

## Decisions

- 2026-11-11: Source: retro spec/retro/2026-11-11.md
