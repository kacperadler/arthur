# AR0054 - Roadmap entry 23 does not say the coordinator loads the env guard

```json
{
  "id": "AR0054",
  "title": "Roadmap entry 23 does not say the coordinator loads the env guard",
  "date": "2026-10-16"
}
```

## Description

entry 19 says the env guard is loaded "in every job and in the coordinator". AR0022 loads it in every job (`wrapper.ts` passes `-e`) and publishes it as `@arthur/core/env-guard`, but no coordinator exists yet, and entry 23 (the coordinator's `omp`) does not mention the guard, so its builder can start the coordinator without it and the coordinator's tool calls would read `.env` freely.

## Goal

The coordinator, which holds the most context, never reads a secrets file: entry 23 says it loads the env guard like every job.

- Model: haiku
- Kind: risk

Evidence:
- `spec/roadmap.md` entry 23; `packages/core/package.json` (`./env-guard`)
- Found by: 2026-10-16-ar0022-env-guard-8ff85c28 (worker), 2026-10-16

## Done means

- `spec/roadmap.md` entry 23, Delivers: the coordinator's agent is started with `-e` on `@arthur/core/env-guard` like every job; Done means gains the edge case: a coordinator tool call naming a secrets file is refused with the guard's line.
- `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md` entry 23.

## Decisions

- 2026-10-16: Source: F1 of AR0022
