# AR0707 - Project agents T3: a project agent's context holds only its own project (roadmap 87)

```json
{
  "id": "AR0707",
  "title": "Project agents T3: a project agent's context holds only its own project (roadmap 87)",
  "date": "2026-11-13"
}
```

## Description

A project agent's context holds its own project only: its role, override, criteria, personality, vision, board, jobs and decisions.

## Goal

Part T3 (roadmap 87) of the approved AR0669 plan (`spec/features/AR0669-plan-project-agents-each-project-its-own-agent-in-its-own-chat-roadmap-85-to-88/plan.md`, approved at 8ead6d4c, AR-D670): follow its Approach, Files, Risks and How to test for T3.

- Kind: feat

## Done means

- `coordinatorContext(host, { project })` as the plan's T3 says.
- The plan's How to test for T3 passes; each line budget raise is named in the final message.
- `npm run check`, `npm test` and `npm run mutate` pass on the clean tip.

## Scope

In:
- The files the plan's Files list names for T3, their tests and docs, `test/structure.test.ts`.

Out:
- The session (AR0708).

## Decisions
- 2026-11-13: AR0707 approved; the owner: "AR-D673 yes" (AR-D673)

