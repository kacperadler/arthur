# AR0626 - Two tests fail now and then under the full suite: models server unreachable, discord refused slice

```json
{
  "id": "AR0626",
  "title": "Two tests fail now and then under the full suite: models server unreachable, discord refused slice",
  "date": "2026-11-04"
}
```

## Description
(see Goal)

## Goal
The AR0616 worker saw, on the same clean tip, `packages/models/test/models.test.ts` "a list skips a model whose server is unreachable" fail once and `packages/discord/test/discord.test.ts` "a refused slice (404, a channel gone)" fail once under `npm test`; each passed alone. Also AR0616 F1: `npm run mutate` leaves `sleep 300` processes behind.

Two tests fail now and then under the full `npm test` and pass alone: `packages/models/test/models.test.ts` "a list skips a model whose server is unreachable" and `packages/discord/test/discord.test.ts` "a refused slice (404, a channel gone)" (seen by the AR0616 worker; a discord menu test by AR0623's). And `npm run mutate` leaves `sleep 300` processes behind (AR0616 F1, AR0621, AR0622 workers).

- Kind: test

## Done means
Both tests wait for the state they assert instead of a fixed time, pass 10 full `npm test` runs in a row, and no `sleep 300` process is left after `npm run mutate -- --max 4`.

- Both tests wait for the state they assert instead of a fixed time, and pass 10 full `npm test` runs in a row.
- No `sleep 300` process is left after `npm run mutate -- --max 4`; the test that starts it ends it.
- The project's checks pass.

## Scope
`packages/models/test/models.test.ts`, `packages/discord/test/discord.test.ts`, the test that starts `sleep 300`.

In:
- `packages/models/test/models.test.ts`, `packages/discord/test/discord.test.ts`, the discord menu test, the test that starts `sleep 300`.

Out:
- Production code, unless a test shows a real defect (then a finding).

## Decisions

