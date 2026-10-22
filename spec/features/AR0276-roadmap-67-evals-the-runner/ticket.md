# AR0276 - Roadmap 67: evals, the runner

```json
{
  "id": "AR0276",
  "title": "Roadmap 67: evals, the runner",
  "date": "2026-10-22"
}
```

## Description

This ticket builds roadmap entry 67 in `spec/roadmap.md` in the `develop` plugin.

## Goal

The specification is roadmap entry 67: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 67's Delivers and Done means list, each edge case with its test: a scenario whose fixture is missing fails alone while the others run; a turn that never ends hits the scenario's timeout and is scored failed; the recording stub never reaches the live home folder (asserted with a sentinel file in a fake home).
- Every `arthur` command refuses to run inside an eval session, naming why; a test shows the refusal.
- A scenario is scored only by what the run left behind (files, refs, the stub's log); pass rates are compared against a stored baseline and the output says which scenarios moved.
- `arthur eval` has its doc page; its options are in `arthur.config.example.ts` and develop's option table.
- The scenarios themselves are entry 68, not this ticket; one fixture scenario for the tests is enough.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 67 as built.

## Scope

In:
- `packages/develop`, the core only for the eval-session refusal, docs, tests, `arthur.config.example.ts`, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-22: Started by the coordinator; owner: continue Arthur today up to 20% of the weekly limit (8% at 08:40).
