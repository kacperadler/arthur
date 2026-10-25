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

The header of arthur.config.example.ts (lines 1-2) says "Nothing here runs yet, and the `@arthur/*` packages do not exist"; every plugin but discord, docker, voice, whatsapp, signal, slack and server exists under `packages/` today, and a copy fails only on the first missing one (`Cannot find package '@arthur/discord'`).

- Kind: docs

## Done means

- The header says which plugins exist today and which are planned (the `first`/`later` marks on each import stay), and keeps the "Illustrative" warning for the planned ones; `npm run check` and the project's checks pass.

## Scope

In:
- `arthur.config.example.ts`: its header comment only.

Out:
- Any option or import in the file.

## Decisions

- 2026-10-25: Source: F2 of AR0307
- 2026-10-25: AR0409 approved by the owner; worker starts in turn; the owner: "ok, go with AR0407 now, and i approve the AR0408–AR0411 tasks, you can go to a 60% usage so when you complete this tasks take another one, always go with your recommendations and do not ask me about them, go to 60% usage and complete as many tasks as you can" (AR-D8)
