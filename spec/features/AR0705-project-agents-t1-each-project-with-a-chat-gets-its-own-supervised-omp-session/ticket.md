# AR0705 - Project agents T1: each project with a chat gets its own supervised omp session and arthur attach <project> (roadmap 85)

```json
{
  "id": "AR0705",
  "title": "Project agents T1: each project with a chat gets its own supervised omp session and arthur attach <project> (roadmap 85)",
  "date": "2026-11-13"
}
```

## Description

Each project whose project file has `orchestration.project({ chat })` gets its own interactive omp, supervised like the coordinator, with `arthur attach <project>`; a project without a chat changes nothing.

## Goal

Part T1 (roadmap 85) of the approved AR0669 plan (`spec/features/AR0669-plan-project-agents-each-project-its-own-agent-in-its-own-chat-roadmap-85-to-88/plan.md`, approved at 8ead6d4c, AR-D670): follow its Approach, Files, Risks and How to test for T1.

- Kind: feat

## Done means

- The piece, `sessions.ts`, `supervise` per session with `ARTHUR_PROJECT` and `ARTHUR_ORCHESTRATION_SESSION`, `roles/project.md`, the extensions per session, `arthur attach|coordinator stop|coordinator context [<project>]` in `coordinator-commands.ts`, `actor` as `agent:<project>`, the spawn guard and the doctor checks, all as the plan's T1 says.
- `packages/core/src/cli.ts` reads `ARTHUR_PROJECT` as the default of `--project`, with its test and doc line (the plan's Not available directly, option 2).
- The plan's How to test for T1 passes; each line budget raise is named in the final message.
- `npm run check`, `npm test` and `npm run mutate` pass on the clean tip.

## Scope

In:
- The packages and files the plan's Files list names for T1 (orchestration, telegram, session, stats, `packages/core/src/cli.ts`), their tests and docs, `test/structure.test.ts` (the raises the plan's table gives for T1).

Out:
- Routing (AR0706), context (AR0707), session (AR0708).

## Decisions

