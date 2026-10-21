# AR0246 - Roadmap 58: arthur ci, reruns, pushes, pull request reviews

```json
{
  "id": "AR0246",
  "title": "Roadmap 58: arthur ci, reruns, pushes, pull request reviews",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 58 in `spec/roadmap.md` in the `github` plugin, together with AR0238 (spec/features/AR0238-a-rerun-keeps-its-run-id-so-its-end-is-never-told-as-ci-finished/ticket.md): a rerun keeps its run id, so what is told becomes keyed by run attempt.

## Goal

The specification is roadmap entry 58: its Delivers and Done means, plus AR0238's Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 58's Delivers and Done means list, each refusal and edge case with its test: a second `--rerun` of the same run; a rerun of a passed run; a log too long (its end only); a push rejected as non-fast-forward (one warning line, no prompt); no remote.
- AR0238: `ci-finished` is told once per `<id>/<run_attempt>`; a test shows a rerun's end told once; entry 57's wording says "once per run attempt".
- `arthur ci` reads the newest run that built the branch (57), not only a run on the tip.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 58 as built.

## Scope

In:
- `packages/github`, `packages/delivery` only where the push of the reviewed branch and main needs it, docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

Out:
- entry 59 (`arthur merge --auto`).

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 12% of the weekly limit today. Built with AR0238, which the owner approved the same morning.
