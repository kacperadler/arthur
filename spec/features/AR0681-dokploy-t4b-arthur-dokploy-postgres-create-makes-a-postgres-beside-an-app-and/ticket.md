# AR0681 - Dokploy T4b: arthur dokploy postgres create makes a Postgres beside an app and writes its DATABASE_URL

```json
{
  "id": "AR0681",
  "title": "Dokploy T4b: arthur dokploy postgres create makes a Postgres beside an app and writes its DATABASE_URL",
  "date": "2026-11-10"
}
```

## Description

A whole project from Arthur needs a database: this creates a Postgres in the app's own environment, writes `DATABASE_URL` into the app's env without printing it, and deploys the database.

## Goal

Part T4b of the approved AR0655 plan (`spec/features/AR0655-plan-dokploy-t4-a-whole-project-from-arthur-an-app-built-from-its-git-repository/plan.md`, approved at e3069514, AR-D534): follow its Approach, Files, Risks and How to test for T4b.

- Kind: feat

## Done means

- `arthur dokploy postgres create <app> <name>` and `arthur dokploy postgres status <postgres>` work as the plan says; the password is generated and checked against Dokploy's rule and never printed; each refusal has a test, against a fake Dokploy in its documented shape.
- The argument parsing moves to `dokploy-args.ts` first, and `env set` keeps its behaviour (its tests unchanged and passing).
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/dokploy/src/dokploy-postgres.ts` and `dokploy-args.ts` (new), `dokploy-command.ts`, `dokploy-env.ts` (`setVariable`), the routes, their tests, `packages/dokploy/docs/`.

Out:
- Backups (AR0682).

## Decisions
