# AR0025 - Roadmap 22: Jobs on another machine: stop, steer, continue, and the machine going offline

```json
{
  "id": "AR0025",
  "title": "Roadmap 22: Jobs on another machine: stop, steer, continue, and the machine going offline",
  "date": "2026-10-16",
  "after": [
    "AR0024"
  ]
}
```

## Description

Roadmap entry 22 of `spec/roadmap.md`: Jobs on another machine: stop, steer, continue, and the machine going offline. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 22 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 22's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 22 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 22 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
