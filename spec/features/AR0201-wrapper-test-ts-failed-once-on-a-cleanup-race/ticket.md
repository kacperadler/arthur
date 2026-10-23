# AR0201 - wrapper.test.ts failed once on a cleanup race

```json
{
  "id": "AR0201",
  "title": "wrapper.test.ts failed once on a cleanup race",
  "date": "2026-10-19"
}
```

## Description

one full `npm test` run of the review failed there with `ENOTEMPTY` from `rmSync`, with no change under `packages/core/test/wrapper.test.ts` or the wrapper on this branch; not reproduced by the worker.

## Goal

`wrapper.test.ts` never fails on its cleanup: the folder is removed only after every process writing into it has ended, so CI stays green.

- Kind: fix

Evidence:
- `packages/core/test/wrapper.test.ts:206`
- Found by: review 1 of AR0188, 2026-10-19

## Done means

- The fix, with a test that proves it: find what still writes into the folder when the test removes it, and wait for that state before `rmSync`.
- `npm test` and `npm run check` pass.

## Scope

In:
- find what still writes into the folder when the test removes it, and wait for that state before `rmSync`.

## Decisions

- 2026-10-19: Source: F5 of AR0188
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
