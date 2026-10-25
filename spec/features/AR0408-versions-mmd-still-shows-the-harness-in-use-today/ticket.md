# AR0408 - versions.mmd still shows the harness in use today

```json
{
  "id": "AR0408",
  "title": "versions.mmd still shows the harness in use today",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0307 (spec/features/AR0307-the-switch-arthur-runs-on-the-vps-and-takes-its-own-tickets/findings.md).

- Kind: docs
- Found by: 2026-10-25-worker-5da05172 (worker), 2026-10-25
- Where: `docs/architecture/versions.mmd:1`
- What: the diagram's comment and its first node say "The harness in use today, takes only fixes"; after the switch Arthur runs its own repository, so the diagram's starting point is out of date.
- Suggestion: redraw the start as the switch done (Arthur on its own repository, other projects to follow); leave the first-version and later groups as they are.

## Goal

docs/architecture/versions.mmd matches the switch (AR0307, merged 2026-10-25): its comment (line 1) and first node (line 3) say "The harness in use today, takes only fixes", while Arthur now runs its own repository.

- Kind: docs

## Done means

- The diagram's start shows the switch done (Arthur on its own repository, other projects to follow); its first-version and later groups are unchanged; the project's checks pass.

## Scope

In:
- `docs/architecture/versions.mmd`: the comment and the starting node.

Out:
- The first-version and later groups, and any other diagram.

## Decisions

- 2026-10-25: Source: F1 of AR0307
- 2026-10-25: AR0408 approved by the owner; worker starts in turn; the owner: "ok, go with AR0407 now, and i approve the AR0408–AR0411 tasks, you can go to a 60% usage so when you complete this tasks take another one, always go with your recommendations and do not ask me about them, go to 60% usage and complete as many tasks as you can" (AR-D7)
