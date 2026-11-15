# AR0708 - Project agents T4: compaction, the fresh start and the handoff for every project agent (roadmap 88)

```json
{
  "id": "AR0708",
  "title": "Project agents T4: compaction, the fresh start and the handoff for every project agent (roadmap 88)",
  "date": "2026-11-13"
}
```

## Description

Every project agent gets compaction, the daily fresh start, the handoff, `/restart` and the restart guard, as the coordinator has them.

## Goal

Part T4 (roadmap 88) of the approved AR0669 plan (`spec/features/AR0669-plan-project-agents-each-project-its-own-agent-in-its-own-chat-roadmap-85-to-88/plan.md`, approved at 8ead6d4c, AR-D670): follow its Approach, Files, Risks and How to test for T4.

- Kind: feat

## Done means

- `orchestration.sessions`, the session plugin's folder per agent, compaction one session at a time, as the plan's T4 says.
- The plan's How to test for T4 passes; each line budget raise is named in the final message.
- `npm run check`, `npm test` and `npm run mutate` pass on the clean tip.

## Scope

In:
- The files the plan's Files list names for T4 (session, orchestration), their tests and docs, `test/structure.test.ts`.

Out:
- Nothing else of AR0669.

## Decisions
- 2026-11-13: AR0708 approved; the owner: "AR-D674 yes" (AR-D674)

