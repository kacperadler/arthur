# AR0238 - A rerun keeps its run id, so its end is never told as `ci-finished`

```json
{
  "id": "AR0238",
  "title": "A rerun keeps its run id, so its end is never told as `ci-finished`",
  "date": "2026-10-20"
}
```

## Description

entry 57 tells `ci-finished` once per run id, as its Delivers and the vision say. GitHub's rerun ("Re-run a workflow", entry 58's `--rerun`) keeps the run's `id` and raises its `run_attempt`, so once a run was told, the end of its rerun is taken as told and the coordinator never hears it [INFERENCE: from GitHub's documented `run_attempt` field; no rerun was exercised].

## Goal

Rerun ends reach the coordinator: the github plugin tells `ci-finished` once per run attempt, so the owner hears a rerun's result (vision: the owner hears the end of every CI run). Built with or after roadmap entry 58 (`--rerun`).

- Kind: risk

Evidence:
- `packages/github/src/github.ts` (`finished`, the ids told), `spec/roadmap.md` entry 58
- Found by: 2026-10-20-ar0236-roadmap-57-github-6bafb88c (worker), 2026-10-20

## Done means

- The fix, with a test that proves it: when entry 58 builds `--rerun`, key what is told by `<id>/<run_attempt>` (the state file's ids become those keys) and test a rerun's end told once; entry 57's "once per run id" then reads "once per run attempt".
- `npm test` and `npm run check` pass.

## Scope

In:
- when entry 58 builds `--rerun`, key what is told by `<id>/<run_attempt>` (the state file's ids become those keys) and test a rerun's end told once; entry 57's "once per run id" then reads "once per run attempt".

## Decisions

- 2026-10-20: Source: F1 of AR0236
- 2026-10-21: Approved by the owner (Telegram, morning report).
- 2026-10-21: Built inside AR0246 (roadmap 58).
