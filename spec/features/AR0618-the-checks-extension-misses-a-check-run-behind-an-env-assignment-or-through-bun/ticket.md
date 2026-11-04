# AR0618 - The checks extension misses a check run behind an env assignment or through bun run

```json
{
  "id": "AR0618",
  "title": "The checks extension misses a check run behind an env assignment or through bun run",
  "date": "2026-11-04"
}
```

## Description

A worker's `check` run is recorded only when the command line holds `npm run check` right after a separator. A run behind a variable assignment (`TMPDIR=... npm run check`) or through bun (`bun run check`, the package manager of a bun project such as web-shop.example) records nothing, so `arthur review` refuses the branch with `no check` though the check passed.

## Goal

Seen 2026-11-04 on PG0001 (worker `2026-11-04-worker-4746b4c2`): the job ran `TMPDIR=$PWD/node_modules/.tmp npm run check 2>&1; echo check=$?` on its clean tip, exit 0, and `<home>/delivery/<job>/checks` was never written; `arthur review` printed `... is reviewed only once the job's checks passed on its clean tip (...): no check`. The matcher is `packages/delivery/src/checks-extension.ts:97`: `/(?:^|[;&|(\n])\s*npm\s+(test|t|run\s+(?:test|check|mutate))(?=$|[\s;&|)])/g`, which allows nothing between the separator and `npm`.

- Kind: fix

## Done means

- A run of a declared script recorded when it follows leading `NAME=value` assignments, and when run as `bun run <script>` (not `bun test`, bun's own runner), each with a test in `packages/delivery/test/` that fails on the current matcher.
- A command that only names the script in text (`echo npm run check`, a quoted string) still records nothing; its existing tests pass.
- `docs`: `arthur review-needed --help`'s checks paragraph names the forms recorded.

## Scope

In:
- `packages/delivery/src/checks-extension.ts`: the matcher.
- `packages/delivery/test/checks.test.ts`: the new forms and the text-only refusals.
- `packages/delivery/docs/commands/review-needed.md`: the forms recorded.

Out:
- Other package managers (pnpm, yarn): a later ticket if a project uses one.

## Decisions
