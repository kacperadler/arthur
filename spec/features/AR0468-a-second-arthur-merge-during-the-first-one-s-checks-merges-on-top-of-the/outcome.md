# AR0468 - Outcome

- Merged: 2026-10-27, `694a4cda`
- Branch: arthur/2026-10-27-worker-7e4ae6b3
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.38, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-command.ts`: `arthur merge` takes a lock per project (core's `takeLock` on `<delivery folder>/<project>/merge.lock`) right after it finds the job, before any refusal reads main, and writes the merging job's id beside it in `merging`. A second merge of the same project while the first runs its checks is refused with `a merge of <job> is in progress on <project>` (or the holder's pid before `merging` is written), main unchanged. Both files are removed in a `finally` on every end; a lock whose pid is dead is taken over.
- `packages/delivery/test/merge.test.ts`: a refused merge releases the lock; a second merge started from inside the first's checks is refused with the first's job; after the first fails its check main is back and the second branch is not on it; a live holder in another process is refused by pid.
- `packages/delivery/docs/commands/merge.md`: the refusal, and what the coordinator does with it.
- `test/structure.test.ts`: delivery's line budget +20, to 1584 on main (AR-D146).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1133/1200 passed.

## Left open

- Review notes: all dropped (findings.md F1 to F3).
