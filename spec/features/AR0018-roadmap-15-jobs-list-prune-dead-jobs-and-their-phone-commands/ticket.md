# AR0018 - Roadmap 15: Jobs list, prune, dead jobs, and their phone commands

```json
{
  "id": "AR0018",
  "title": "Roadmap 15: Jobs list, prune, dead jobs, and their phone commands",
  "date": "2026-10-16",
  "after": [
    "AR0017"
  ]
}
```

## Description

Roadmap entry 15 of `spec/roadmap.md`: Jobs list, prune, dead jobs, and their phone commands. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 15 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 15's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 15 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 15 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: Coordinator: core line budget raised by the 139 lines of entry 15 (jobs, prune, stopall, the sweep), on the condition that the review finds nothing in them to cut; contract comments elsewhere are not cut for it. A separate ticket reviews the whole core for what can move to plugins or be cut before the next core entries.
