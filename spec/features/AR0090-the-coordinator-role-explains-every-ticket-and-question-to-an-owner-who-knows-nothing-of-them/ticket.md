# AR0090 - The coordinator role explains every ticket and question to an owner who knows nothing of them

```json
{
  "id": "AR0090",
  "title": "The coordinator role explains every ticket and question to an owner who knows nothing of them",
  "date": "2026-10-17"
}
```

## Description

Arthur's coordinator role and its morning report must write for an owner who does not know the tickets, did not see the night's work, and cannot answer a question whose background lives only in the coordinator's context. The harness gets the same rule in K0264; this ticket carries it into Arthur.

## Goal

The owner, 2026-10-17: the morning report is a wall of ids and shorthand ("AR0087 … LA i LB … pathPrepend") he cannot act on. Arthur's coordinator role file is delivered by roadmap entry 23 and the morning report by its own entry, so the rule must be in their Done means before they are built.

- Kind: improvement

## Done means

- `spec/roadmap.md`: entry 23 (the coordinator's role file) and the entry that delivers the morning report each carry in Done means: every ticket, finding, job, or project a reply names gets at least one plain sentence on what it is and what the owner will see change; every question to the owner says what is decided, why it came up, the options with what each means, and the coordinator's recommendation, answerable from the message alone; an id never stands alone.
- The wording matches the rule K0264 lands in the harness's `roles/coordinator.md`, translated to Arthur's names.

## Scope

In:
- `spec/roadmap.md`: the two entries' Done means.

Out:
- Building the role file itself: roadmap entry 23.

## Decisions

- 2026-10-17: the owner asked that the communication fix also work in Arthur.
- 2026-10-17: The owner approved it.
