# AR0716 - A project agent is never told where its after-restart steps go, and its handoff request calls it the coordinator

```json
{
  "id": "AR0716",
  "title": "A project agent is never told where its after-restart steps go, and its handoff request calls it the coordinator",
  "date": "2026-11-17"
}
```

## Description

After a restart, the `Restarted.` notice carries the steps the owner must take, read from `after-restart.md` in the session's own folder. A project agent's role never names that file, so its notice never carries any, and the handoff request it gets says "the coordinator restarts". After this, the project role names its own file and the handoff texts speak of "this session".

## Goal

Part of the AR0708 (roadmap 88) restart flow, the owner's steps after a project agent restarts, is documented but no agent can reach it.

Evidence (audit 2026-11-17):
- `packages/session/src/restart.ts:143-144`: the `Restarted.` notice reads `after-restart.md` from the session's own folder, for an agent `<home>/session/agents/<project>/` (`packages/session/docs/session.md:110`).
- `packages/orchestration/roles/coordinator.md:9` names `.arthur/session/after-restart.md`; `packages/orchestration/roles/project.md` names no after-restart file. An agent that copies the coordinator's convention writes into the coordinator's file.
- `packages/session/roles/coordinator/handoff-{fresh,restart}.md` say "the coordinator restarts", and the same text goes to every project agent (`handoff-extension.ts:91-94`).

- Kind: fix

## Done means

- `packages/orchestration/roles/project.md` tells the agent to write the owner's steps after a restart to `$ARTHUR_SESSION_FOLDER/after-restart.md`.
- The handoff request texts say "this session" instead of "the coordinator", so they read right for the coordinator and for a project agent.
- The `session/after-restart-plan` eval scenario is extended, or a new one added, for a project agent, and it checks the file lands in the agent's own folder.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/roles/project.md`.
- `packages/session/roles/coordinator/handoff-fresh.md`, `handoff-restart.md`.
- The `session/after-restart-plan` eval scenario.

Out:
- The coordinator's own restart flow, which stays as it is.

## Decisions

- 2026-11-17: Source: audit spec/quality/2026-11-17.md
- 2026-11-17: Source: F2 of AR0708
