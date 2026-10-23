# AR0138 - Plan and review jobs must name their ticket on a `Ticket:` line to be placed by its labels

```json
{
  "id": "AR0138",
  "title": "Plan and review jobs must name their ticket on a `Ticket:` line to be placed by its labels",
  "date": "2026-10-18"
}
```

## Description

placement finds a job's ticket only through the `Ticket:` paths of its task (the core's `tickets`). The plan and plan-review kinds (entry 28) and the review kind (entry 52) are not built yet; a task of theirs that names the ticket another way (an id, a branch) is placed by its project's labels only, so a review of an iOS ticket whose labels sit in the ticket, not the project, may run on a machine without Xcode.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: security

Evidence:
- `packages/machines/src/machine-place.ts` (`need`), roadmap entries 28 (plan kinds) and 52 (review)
- Found by: 2026-10-18-ar0125-machine-placement-7dd32646 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: entries 28 and 52 write `Ticket: spec/features/<id>-<slug>/ticket.md` into every task they spawn, with a test that such a job lands on the ticket's machine.
- `npm test` and `npm run check` pass.

## Scope

In:
- entries 28 and 52 write `Ticket: spec/features/<id>-<slug>/ticket.md` into every task they spawn, with a test that such a job lands on the ticket's machine.

## Decisions

- 2026-10-18: Source: F1 of AR0125
