# AR0468 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. A second merge can be refused with an ENOENT message

- Kind: ux
- Found by: 2026-10-27-review-a16e2570 (review), 2026-10-27
- Where: `packages/delivery/src/merge-command.ts:65`
- What: between the check that `merging` exists and its read, the first merge can remove it; the second is still refused, but its message is a file error.
- Status: dropped (wording only: main is safe and the refusal still stands)

## F2. Just after a dead holder's lock is taken over, a leftover `merging` can name the dead merge's job

- Kind: ux
- Found by: 2026-10-27-review-a16e2570 (review), 2026-10-27
- Where: `packages/delivery/src/merge-command.ts:65`
- What: a refusal in that moment names the wrong job.
- Status: dropped (wording only, for a moment after a killed merge)

## F3. No test that a merge of another project is still allowed meanwhile

- Kind: test
- Found by: 2026-10-27-review-a16e2570 (review), 2026-10-27
- Where: `packages/delivery/test/merge.test.ts`
- What: one global lock path would pass the test; the code keys the lock by project as the ticket asks.
- Status: dropped (the code is per project; with one project on Arthur today, a global lock would change nothing the owner sees)
