# AR0280 - Roadmap 68: evals, the scenarios

```json
{
  "id": "AR0280",
  "title": "Roadmap 68: evals, the scenarios",
  "date": "2026-10-22"
}
```

## Description

This ticket builds roadmap entry 68 in `spec/roadmap.md` in the `develop` plugin.

## Goal

The specification is roadmap entry 68: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 68's Delivers and Done means list: every listed scenario, each in the package of the plugin whose procedure it tests, in the `<package>/evals/<name>/` layout of AR0276 (`scenario.json` and `fixture/`).
- Every scenario runs against the fake agent in `npm test` (the scoring, not the model), and a scenario whose expected outcome is not met fails its test.
- The baseline (`evals/baseline.json`) holds a rate for each scenario.
- Open findings AR0277-AR0279 (turn wording, help pages, context and hour in a run) are separate tickets; a scenario that needs one of them says so in its `scenario.json` instead of faking it.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 68 as built.

## Scope

In:
- `packages/develop` and each plugin package whose procedure a scenario tests (`evals/` folders only, plus their tests), the baseline, README, `arthur.mmd`.

## Decisions

- 2026-10-22: Started by the coordinator; owner: continue Arthur today up to 20% of the weekly limit (8% at 08:40).
- 2026-10-22: Coordinator (free hand) raised the budget by 5 after the worker hit 10 with the scenarios committed and docs/budget edits uncommitted.
- 2026-10-22: Coordinator (free hand) approved the real-model baseline run (19 scenarios x 3 runs, about $9); total budget 25.
