# AR0682 - Outcome

- Merged: 2026-11-11, `ec4e6a01`
- Branch: arthur/2026-11-11-worker-ecc8d982
- Reviews: review-1.md PASS
- Cost: worker $6.10, reviews $0.87; review rounds 1

## What went in

- README.md: the dokploy line names backups to an S3 destination beside the Git source and Postgres.
- arthur.config.example.ts: the dokploy comment names `postgres backup`.
- docs/setup.md: the dokploy paragraph names `postgres backup` and the S3 destination set up once in the panel.
- packages/dokploy/docs/commands/dokploy.md: usage line, the `postgres backup` entry with its request, output and `already set`, its refusals before and after the reads, and its wrong-usage cases.
- packages/dokploy/docs/dokploy.md: the summary names `postgres backup`, the token's permissions, and the owner's one-time S3 destination.
- packages/dokploy/src/dokploy-args.ts: the usage line and parsing of `postgres backup <postgres> --destination --schedule [--keep]`; each `postgres` sub-verb takes only its own flags.
- packages/dokploy/src/dokploy-command.ts: sends `postgres backup` to `backupPostgres` on the instance `pick` chooses; header names AR0682.
- packages/dokploy/src/dokploy-postgres.ts: `backupPostgres` with its refusals, `backup.create` and the re-read; `backupLine` shared with `postgres status`.
- packages/dokploy/src/dokploy.ts: header comment names the backups (AR0682).
- packages/dokploy/test/dokploy-postgres.test.ts: tests for the backup body and output, `already set`, each refusal, Dokploy's refusal, a backup Dokploy does not list, usage, and that `SECRETS` holds the S3 keys.
- packages/dokploy/test/dokploy-shapes.json: records the `destination-all` shape and its v0.30.10 sources; notes that `backup.create` answers no JSON.
- packages/dokploy/test/dokploy.test.ts: the expected usage line includes `postgres backup`.
- packages/dokploy/test/fake-dokploy.ts: `destinations` option, a `destination.all` route with S3 keys, a `backup.create` route with its required keys (400 on an unknown id), and the S3 keys in `SECRETS`.
- packages/dokploy/test/fake-shapes.test.ts: the shape test covers `destination.all`.
- packages/orchestration/roles/coordinator.md: the Dokploy write line names `postgres backup`, only on the owner's word.
- spec/features/AR0682-dokploy-t4c-arthur-dokploy-postgres-backup-schedules-backups-of-a-postgres-to-an/findings.md: F1, cron field ranges not checked.
- spec/roadmap.md: entry 113's title names the Git source and Postgres with backups; adds AR0682 to its tickets and its Delivers line.
- spec/vision.md: the dokploy row names `source` and `postgres` with backups.
- test/structure.test.ts: dokploy line budget 826 → 887.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1673/1744 passed.

## Left open

- Deferred (client summary): F1. A cron field out of its range passes `postgres backup` and Dokploy never runs the backup
