# AR0342 - Outcome

- Merged: 2026-10-25, `8409266e`
- Branch: arthur/2026-10-25-worker-3de620ca
- Reviews: review-1.md PASS
- Cost: worker $1.49, reviews n/a; review rounds 1

## What went in

- `packages/projects/src/clone.ts`: `shown` prints a repo URL that parses with its username and password removed; both clone refusals (`holds <origin>, not <repo>` and `git clone <repo> failed`) use it, and every word holding an `@` in git's own line becomes `the repo`.
- `packages/projects/test/projects.test.ts`: a failing clone of a `git://` URL with userinfo and an existing folder whose origin holds a token; neither refusal prints the credential.
- `packages/projects/docs/commands/projects.md`: says how these refusals print URLs.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1107/1107 passed.

## Left open

- Tickets from findings: AR0417 (F1), AR0418 (F2); F3, F4 dropped.
