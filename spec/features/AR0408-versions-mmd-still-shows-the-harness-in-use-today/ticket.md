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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: docs

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0307
