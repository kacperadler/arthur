# AR0359 - Outcome

- Merged: 2026-10-25, `41b2b86a`
- Branch: arthur/2026-10-25-worker-e400170e
- Reviews: review-1.md PASS
- Cost: worker $1.09, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/auto-merge.ts`: `--auto` counts a run only on the tip itself; with none it waits and says `no run built the tip yet`, naming the nearest run below; a plain merge still reads the branch's own commits.
- `packages/delivery/src/ci-wait.ts`: a CI wait wakes the coordinator only for a run on the tip.
- `packages/delivery/docs/commands/merge.md`: the refusal, the wake, and the accepted cost: a tip no run builds (`[skip ci]`, `paths-ignore`) waits for the owner's `--auto --no-ci`.
- `packages/delivery/test/auto-merge.test.ts`: a run one below the tip is refused with a wait; its end answers `[false]` with no message.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1128/1128 passed.

## Left open

- Tickets from findings: AR0437 (F1 and the review's sha note; approved under AR-D31, group 2).
