# AR0254 - Roadmap 64: prune and temporary folders on a schedule

```json
{
  "id": "AR0254",
  "title": "Roadmap 64: prune and temporary folders on a schedule",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 64 in `spec/roadmap.md` in the `manage` plugin.

## Goal

The specification is roadmap entry 64: its Delivers and Done means.

- Kind: feat
- Budget: 8

## Done means

- Everything entry 64's Delivers and Done means list, each refusal and edge case with its test.
- A running job's folder is never removed; a folder another user owns is skipped with a line; a missed day runs once at start.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 64 as built.

## Scope

In:
- `packages/manage`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (2% at 12:29).
- 2026-10-21: Coordinator (free hand) accepted the worker picks: a fixed 03:00 in `core.timeZone`; temporary folders are `arthur-*` directly in `os.tmpdir()`, older than a day by mtime; without `prune.keepJobsDays` neither step runs.
