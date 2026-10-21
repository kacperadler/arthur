# AR0262 - Roadmap 69: free disk space per machine

```json
{
  "id": "AR0262",
  "title": "Roadmap 69: free disk space per machine",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 69 in `spec/roadmap.md` in the `resources` plugin.

## Goal

The specification is roadmap entry 69: its Delivers and Done means.

- Kind: feature
- Budget: 8

## Done means

- Everything entry 69's Delivers and Done means list, each refusal and edge case with its test.
- Free space exactly at the floor starts a job, one KiB under refuses it; floor 0 is no floor; the floor hit mid-job emits one disk-low and one notice; hovering emits one per fall; two paths on one filesystem count once; a missing provider path skipped with one line; tests use a fake df on PATH.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 69 as built.

## Scope

In:
- `packages/resources`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (5% at 14:52).
- 2026-10-21: Coordinator (free hand) accepted the worker picks: `keepFree.disk` defaults to 0 (no floor, no df); the failed-check notice says "its room is unknown"; a missing provider path shows its own skipped line; the host member `host.jobs.home(machine)` and the provided name `resources.disk`, recorded in docs/plugin-api.md.
