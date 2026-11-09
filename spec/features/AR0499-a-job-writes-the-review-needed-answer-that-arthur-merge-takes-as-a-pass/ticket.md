# AR0499 - A job writes the `review-needed` answer that `arthur merge` takes as a PASS

```json
{
  "id": "AR0499",
  "title": "A job writes the `review-needed` answer that `arthur merge` takes as a PASS",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: high
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/delivery/src/merge-command.ts:170-176` (reads `<home>/delivery/<job>/review-needed` and takes `no review…` for the tip as a PASS), `packages/delivery/src/review-needed.ts:37`, `:41-43` (the answer kept in that folder), `packages/core/src/job-sandbox.ts:72` (the sandbox grants each job `<home>/<plugin>/<job>` for every plugin with an extension), `packages/delivery/src/delivery.ts:92`
- Input: any program a worker runs during its run, its branch's own `npm test` included: one write of `{"answer":"no review: …","commit":"<its tip>"}` to `<home>/delivery/<its id>/review-needed`.
- Why the check misses it: the merge reads the file without asking who wrote it, and the folder it lies in is the one the sandbox (AR0376) opened for the checks extension. AR0311 F6 named this file. AR0357 fixed the review task, and AR0360 documents the `checks` file as the job's own word (`docs/commands/review-needed.md:37`), but the answer file shares that folder and is read as Arthur's own. Probe P1 (`security-review.md`, "A PASS, or `no review`, on the tip"): `arthur merge <job>` refused `no PASS on …'s tip b13bd4f`; after the write, the same command, with no flag, answered `merged arthur/2026-01-01-worker-4d300297 into main: e33832a`.
- What: a worker's unreviewed branch goes into main on the owner's plain `arthur merge`, which the coordinator runs after a wake that says `no review`, and is pushed to origin.
- Suggestion: keep `review-needed`'s answer in a folder no job may write, such as `<home>/delivery/review-needed/<job>.json`, beside `reviews/`, which the sandbox does not grant. Read it only from there. Add a test in `merge.test.ts`: an answer written in the job's own folder is no PASS. Out: the `checks` file, which stays the job's word, as documented.

## Goal

A worker's unreviewed branch cannot reach main by writing the `review-needed` answer itself: `arthur merge` reads that answer only from a folder no job may write.

Evidence: `packages/delivery/src/merge-command.ts:170-176` reads `<home>/delivery/<job>/review-needed` and takes `no review…` for the tip as a PASS; `packages/core/src/job-sandbox.ts:72` grants each job `<home>/<plugin>/<job>`. Probe P1 of AR0404: after one write of `{"answer":"no review: …","commit":"<tip>"}` there, a plain `arthur merge <job>` merged the branch.

- Kind: security

## Done means

- `arthur review-needed` writes its answer to `<home>/delivery/review-needed/<job>.json`, a folder the sandbox does not grant; `arthur merge` reads it only from there.
- A test in `packages/delivery/test/merge.test.ts`: an answer written in the job's own folder `<home>/delivery/<job>/review-needed` is no PASS, and `arthur merge` refuses `no PASS on …'s tip`; it fails on today's code.
- The `checks` file stays where it is, documented as the job's own word.
- `packages/delivery/docs/commands/review-needed.md` names the new place.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/delivery/src/review-needed.ts`: where the answer is written.
- `packages/delivery/src/merge-command.ts`: where it is read.
- `packages/delivery/test/merge.test.ts`, `packages/delivery/test/review-needed.test.ts`.
- `packages/delivery/docs/commands/review-needed.md`.

Out:
- The `checks` file and the sandbox's grants for other plugins.
- AR0502 (an owner's answer tied to his message).

## Decisions

- 2026-10-27: Source: F1 of AR0404
- 2026-11-09: Merge it, in the order of the night summary (AR0659 before AR0499); the owner: "Merge all 11 in order above." (AR-D570)
