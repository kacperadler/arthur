# AR0706 - Project agents T2: a project chat's messages and its jobs' ends go to its agent, and arthur agent tell (roadmap 86)

```json
{
  "id": "AR0706",
  "title": "Project agents T2: a project chat's messages and its jobs' ends go to its agent, and arthur agent tell (roadmap 86)",
  "date": "2026-11-13"
}
```

## Description

A message in a project's chat and its jobs' ends reach that project's agent, its replies go back there, and the coordinator hands a project agent work with `arthur agent tell`.

## Goal

Part T2 (roadmap 86) of the approved AR0669 plan (`spec/features/AR0669-plan-project-agents-each-project-its-own-agent-in-its-own-chat-roadmap-85-to-88/plan.md`, approved at 8ead6d4c, AR-D670): follow its Approach, Files, Risks and How to test for T2.

- Kind: feat

## Done means

- Where messages go, wakes and plugin messages with `project`, replies and notices, `arthur agent tell`, as the plan's T2 says.
- The plan's How to test for T2 passes; each line budget raise is named in the final message.
- `npm run check`, `npm test` and `npm run mutate` pass on the clean tip.

## Scope

In:
- The files the plan's Files list names for T2 (orchestration, telegram, discord, delivery, github, uptime), their tests and docs, `test/structure.test.ts`.

Out:
- The context (AR0707) and session (AR0708).

## Decisions

