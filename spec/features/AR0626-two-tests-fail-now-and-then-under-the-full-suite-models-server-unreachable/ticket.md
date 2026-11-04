# AR0626 - Two tests fail now and then under the full suite: models server unreachable, discord refused slice

```json
{
  "id": "AR0626",
  "title": "Two tests fail now and then under the full suite: models server unreachable, discord refused slice",
  "date": "2026-11-04"
}
```

## Description

<!-- Two or three sentences: what changes, and for whom. -->

## Goal
The AR0616 worker saw, on the same clean tip, `packages/models/test/models.test.ts` "a list skips a model whose server is unreachable" fail once and `packages/discord/test/discord.test.ts` "a refused slice (404, a channel gone)" fail once under `npm test`; each passed alone. Also AR0616 F1: `npm run mutate` leaves `sleep 300` processes behind.

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: <!-- feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux -->

## Done means
Both tests wait for the state they assert instead of a fixed time, pass 10 full `npm test` runs in a row, and no `sleep 300` process is left after `npm run mutate -- --max 4`.

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope
`packages/models/test/models.test.ts`, `packages/discord/test/discord.test.ts`, the test that starts `sleep 300`.

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
