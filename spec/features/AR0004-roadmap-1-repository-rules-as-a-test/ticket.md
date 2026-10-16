# AR0004 - Roadmap 1: Repository rules as a test

```json
{
  "id": "AR0004",
  "title": "Roadmap 1: Repository rules as a test",
  "date": "2026-10-16"
}
```

## Description

Roadmap entry 1 of `spec/roadmap.md`: Repository rules as a test. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 1 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 1's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 1 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 1 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
