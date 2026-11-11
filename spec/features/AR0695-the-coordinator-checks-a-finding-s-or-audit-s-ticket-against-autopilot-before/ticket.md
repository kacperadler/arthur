# AR0695 - The coordinator checks a finding's or audit's ticket against autopilot before asking the owner

```json
{
  "id": "AR0695",
  "title": "The coordinator checks a finding's or audit's ticket against autopilot before asking the owner",
  "date": "2026-11-11"
}
```

## Description

Before asking the owner to approve a bug or cleanup ticket made from a finding or an audit, the coordinator checks it against the autopilot criteria and pre-approves it with `--autopilot` when it meets them. Only a ticket that fails them waits for the owner.

## Goal

AR0672 (a fix from audit 2026-11-10, 3 Scope files, none held, budget at the cap) was still asked as AR-D608, and AR0692 (a test ticket from F2 of AR0647) as AR-D648. Autopilot pre-approved none of the 48 merged tickets this period and 8 ever; the owner never refused a ticket approval in 60 asks. Retro 2026-11-11, proposal 3.

- Kind: chore

## Done means

- The coordinator role's "The one exception" bullet says a finding's or audit's bug or cleanup ticket is judged against the autopilot criteria before the owner is asked, pre-approved with `arthur ticket status <id> planned --autopilot` when it meets them, and asked only on a refusal.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/roles/coordinator.md`: the "Tickets and board" bullet "The one exception…".

Out:
- The autopilot criteria and the `--autopilot` checks: unchanged.
- Features and tickets not from a finding or audit: still his.

## Decisions

- 2026-11-11: Source: retro spec/retro/2026-11-11.md
- 2026-11-11: AR0695 approved; the owner: "AR-D649 1, AR-D650 1, AR-D651 1, AR-D652 1, AR-D653 1" (AR-D651)
