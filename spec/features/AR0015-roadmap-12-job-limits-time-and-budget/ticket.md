# AR0015 - Roadmap 12: Job limits: time and budget

```json
{
  "id": "AR0015",
  "title": "Roadmap 12: Job limits: time and budget",
  "date": "2026-10-16",
  "after": [
    "AR0014"
  ]
}
```

## Description

Roadmap entry 12 of `spec/roadmap.md`: Job limits: time and budget. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 12 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 12's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 12 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 12 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: Coordinator: OK on final states `limit: time` and `limit: budget` (like `limit: memory` of entry 32); the real omp `--continue` resume is smoked by the coordinator after the merge.
