# AR0608 - The plan guard ignores a Plan line it cannot read, so a misspelt one lets a worker start without a plan

```json
{
  "id": "AR0608",
  "title": "The plan guard ignores a Plan line it cannot read, so a misspelt one lets a worker start without a plan",
  "date": "2026-11-02"
}
```

## Description

The owner, 2026-11-02, found `- Plan: tak` (Polish) in AR0128's ticket. 14 tickets written on 2026-10-16 to 2026-10-23 carried it; the plan guard reads only `- Plan: yes` (`packages/orchestration/src/plans.ts:17`), so for it those tickets had no plan line at all, and a worker could have started on the six still open (AR0086, AR0128, AR0129, AR0131, AR0214, AR0216) without an approved plan. The coordinator changed all 14 to `- Plan: yes` (ae81d01d for the six open ones, then the eight merged or dropped).

## Goal

A `- Plan:` line under a ticket's Goal that is not exactly `yes` is refused instead of read as no plan, so no spelling or language lets a worker skip the plan.

- Kind: fix

## Done means

- A worker's spawn on a ticket whose `- Plan:` line is anything but `yes` (`tak`, `Yes`, `no`, empty) is refused, naming the ticket, the line and the one accepted form; a ticket with no `- Plan:` line is unchanged.
- A test per refused form and one for the unchanged ticket, each failing when its line of code is removed.

## Scope

In:
- `packages/orchestration/src/plans.ts` and its test; the plan doc page if it lists the form.

Out:
- Rewriting the merged and dropped tickets' history.

## Decisions
