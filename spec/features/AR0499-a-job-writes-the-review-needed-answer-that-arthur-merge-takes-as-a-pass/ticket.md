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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F1 of AR0404
