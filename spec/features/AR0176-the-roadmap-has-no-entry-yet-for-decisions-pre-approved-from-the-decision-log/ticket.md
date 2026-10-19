# AR0176 - The roadmap has no entry yet for decisions pre-approved from the decision log

```json
{
  "id": "AR0176",
  "title": "The roadmap has no entry yet for decisions pre-approved from the decision log",
  "date": "2026-10-19"
}
```

## Description

AR0174's Done means asks for "a later step, its own entry" that lets a class of decisions the owner always answers the same way be proposed as pre-approved, like autopilot (29), never without the owner's approval; the same Done means asks for one new entry, so entry 96 only names that step as a later entry and the roadmap has no entry for it.

## Goal

A class of decisions the owner always answers the same way can be proposed, from the decision log (96), as pre-approved, and becomes so only on the owner's approval: the next step to a more autonomous Arthur.

- Kind: improvement

Evidence:
- `spec/roadmap.md`, entry 96
- Found by: 2026-10-19-ar0174-decision-log-road-db3b3fa9 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: a roadmap entry after 96 (and after the evals, 67, whose agreement rate between the coordinator's recommendation and the owner's answer is the evidence for a class): the coordinator proposes a class (a kind and what its questions share, with the decisions that back it), the owner approves or refuses it through `arthur decision`, and an approved class answers its questions by policy, each recorded as such in the log and the ticket's Decisions, revocable by the owner. Out: the decision models (AR0129).
- `npm test` and `npm run check` pass.

## Scope

In:
- a roadmap entry after 96 (and after the evals, 67, whose agreement rate between the coordinator's recommendation and the owner's answer is the evidence for a class): the coordinator proposes a class (a kind and what its questions share, with the decisions that back it), the owner approves or refuses it through `arthur decision`, and an approved class answers its questions by policy, each recorded as such in the log and the ticket's Decisions, revocable by the owner. Out: the decision models (AR0129).

## Decisions

- 2026-10-19: Source: F1 of AR0174
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
