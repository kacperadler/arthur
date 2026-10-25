# AR0409 - arthur.config.example.ts says nothing in it runs yet

```json
{
  "id": "AR0409",
  "title": "arthur.config.example.ts says nothing in it runs yet",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0307 (spec/features/AR0307-the-switch-arthur-runs-on-the-vps-and-takes-its-own-tickets/findings.md).

- Kind: docs
- Found by: 2026-10-25-worker-5da05172 (worker), 2026-10-25
- Where: `arthur.config.example.ts:1`
- What: the header says "Nothing here runs yet, and the `@arthur/*` packages do not exist"; all but discord, docker, voice, whatsapp, signal, slack and server exist under `packages/` today, and copying the file fails only on the first missing one (`Cannot find package '@arthur/discord'`).
- Suggestion: say in the header which plugins exist today and which are planned (the `first`/`later` marks already sit on each import); keep the "Illustrative" warning for the planned ones.

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

- 2026-10-25: Source: F2 of AR0307
