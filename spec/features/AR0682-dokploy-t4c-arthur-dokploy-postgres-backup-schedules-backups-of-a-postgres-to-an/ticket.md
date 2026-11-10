# AR0682 - Dokploy T4c: arthur dokploy postgres backup schedules backups of a Postgres to an S3 destination

```json
{
  "id": "AR0682",
  "title": "Dokploy T4c: arthur dokploy postgres backup schedules backups of a Postgres to an S3 destination",
  "date": "2026-11-10"
}
```

## Description

Schedules backups of a Postgres made by AR0681 to the instance's S3 destination, with how many to keep.

## Goal

Part T4c of the approved AR0655 plan (`spec/features/AR0655-plan-dokploy-t4-a-whole-project-from-arthur-an-app-built-from-its-git-repository/plan.md`, approved at e3069514, AR-D534): follow its Approach, Files, Risks and How to test for T4c.

- Kind: feat

## Done means

- `arthur dokploy postgres backup <postgres> --destination <name> --schedule "<cron>" --keep <n>` creates the backup; a missing or unknown destination, a bad schedule or keep is refused with its line; destination keys never printed (added to `SECRETS`); tests against a fake Dokploy in its documented shape.
- README, `spec/roadmap.md` entry 113 and the vision's dokploy row name the Git source and Postgres.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/dokploy/src/dokploy-postgres.ts` (or `dokploy-backup.ts` past 200 lines), the routes, their tests, `packages/dokploy/docs/`, `README.md`, `spec/roadmap.md`, `spec/vision.md`.

Out:
- Restoring a backup.

## Decisions
- 2026-11-10: AR0682 approved; the owner: "AR-D614 - yes" (AR-D614)
