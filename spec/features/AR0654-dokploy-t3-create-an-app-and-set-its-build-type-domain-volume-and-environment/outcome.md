# AR0654 - Outcome

- Merged: 2026-11-07, `53dbde54`
- Branch: arthur/2026-11-06-worker-a8614f6b
- Reviews: review-1.md PASS
- Cost: worker $8.12, reviews $1.11; review rounds 1

## What went in

- feat(AR0654): arthur dokploy create, setup and env, on the owner's word
- docs(AR0654): dokploy create, setup and env in role, README, roadmap
- refactor(AR0654): unknown project check back in its place in target

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1537/1608 passed.

## Left open

- Deferred (client summary): F1. An env value set with `arthur dokploy env <app> set` stays in the coordinator's session
- Deferred (client summary): F2. The vision's dokploy row does not name creating and setting up an app
- Deferred (client summary): F3. Node's `parseEnv` is not dotenv
