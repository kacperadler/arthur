# AR0681 - Outcome

- Merged: 2026-11-11, `23a43110`
- Branch: arthur/2026-11-11-worker-a59419ba
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $18.98, reviews $2.35; review rounds 2

## What went in

- feat(AR0681): arthur dokploy postgres create and status
- test(AR0681): postgres answers without an id or credentials
- test(AR0681): postgres create takes a lowercase --env name
- refactor(AR0681): each verb's call as one check in dokploy-args.ts
- test(AR0681): hidden args and password, env-gone 404s, version 10
- test(AR0681): the fake's Postgres not-found answers carry their 404
- docs(AR0681): finding F1, a late env refusal after the create

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1660/1731 passed.

## Left open

- Deferred (client summary): F1. postgres create can make the database and then meet env set's refusal of a name inside another value
- Deferred (client summary): F2. `--version` and `--env` are now flags of the whole command, so `env <app> set <NAME> --version` (or `--env`) gives the usage line where the base set the value to that text
