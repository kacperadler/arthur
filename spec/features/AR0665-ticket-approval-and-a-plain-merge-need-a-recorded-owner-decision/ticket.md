# AR0665 - Ticket approval and a plain merge need a recorded owner decision

```json
{
  "id": "AR0665",
  "title": "Ticket approval and a plain merge need a recorded owner decision",
  "date": "2026-11-08"
}
```

## Description

Option E of the AR0482 plan: setting a ticket `planned` by hand and merging after a PASS each need a recorded owner decision with message proof, as merge flags already do.

## Goal

The approved AR0482 plan (spec/features/AR0482-the-coordinator-writes-the-owner-s-answer-itself-so-every-decision-gated-step-is/plan.md at 2f6f3959, option E): `arthur ticket status <id> planned` (`board().move` in `packages/core/src/ticket-command.ts`) and `arthur merge` after a PASS have no owner check today.

- Kind: security

## Done means

- `arthur ticket status <id> planned` without `--autopilot` takes `--decision <id>`, a `plan`-kind decision of that ticket with proof; the core asks `decision.owner` by name, as it asks `ticket.autopilot` (`core/src/host.ts:91`).
- `arthur merge <job>` after a PASS takes `--decision <id>`, a `merge` decision of its ticket; `--auto` stays policy.
- `plans.ts` `unplanned` checks the approval line's `(AR-Dn)` has a proved answer in the log.
- Tests for each refusal and pass, failing before the change; `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- core `ticket-command.ts`, `host.ts`; delivery `merge-command.ts`; orchestration `decision-use.ts`, `plans.ts`
- docs `merge.md`, `ticket.md`, `plan.md`, the coordinator role
- tests in core, delivery and orchestration

Out:
- The message proof itself: AR0664.

## Decisions

- 2026-11-09: Approve AR0665; the owner: "Approve AR0663 to AR0667" (AR-D578)
- 2026-11-10: Merge AR0665 once CI is green; the owner: "AR-D602 - 1" (AR-D602)
