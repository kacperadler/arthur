# AR0600 - Split the five source files that leave their zone once a line counts once per 160 characters

```json
{
  "id": "AR0600",
  "title": "Split the five source files that leave their zone once a line counts once per 160 characters",
  "date": "2026-10-31"
}
```

## Description

AR0582 makes a source line count once per 160 characters begun (`max(1, ceil(length/160))`) toward a file's size zone. Under that count five files leave green, one of them above 250, so AR0582 cannot merge until they are back in green. This ticket splits them, before AR0582, with no change of behaviour.

## Goal

Source: the AR0582 worker `2026-10-31-worker-6cc4fb61` measured, with the count of its commit c4a85d42 (`test/structure.ts`, `lineCount`), on main at ea32dcc9:

- `packages/core/src/worktree-guard.ts`: 273 counted (191 physical), above 250, fails listed or not.
- `packages/core/src/jobs.ts`: 229 counted.
- `packages/core/src/shell-words.ts`: 229 counted.
- `packages/delivery/src/delivery.ts`: 225 counted.
- `packages/orchestration/src/decision-log.ts`: 222 counted.

Each file is split along a seam it already has (one job per file, as the styleguide says) until it and every new file count at most 200 lines under the width count; a long line may also be shortened. No behaviour, message, export or test assertion changes; imports follow the moved functions.

- Kind: refactor

## Done means

- Each of the five files, and every file split from them, counts at most 200 lines with `max(1, ceil(length/160))` per line, shown in the final message by a one-line `node -e` measurement over them.
- The existing tests of the moved code pass unchanged (no assertion edited); `npm run check` and `npm test` pass on the physical count main has now.
- The package line budgets in `test/structure.test.ts` change only by the lines the split adds (imports), named in the final message.

## Scope

In:
- The five files above, the new files split from them, and the imports of their moved functions.
- `test/structure.test.ts`: only the budget numbers the split moves.

Out:
- `test/structure.ts` and the width count itself: AR0582.

## Decisions
- 2026-10-31: Approve AR0600 and add it to tonight's batch; the owner: "go with recomendations" (AR-D415)
