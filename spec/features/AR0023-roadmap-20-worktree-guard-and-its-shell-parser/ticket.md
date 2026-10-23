# AR0023 - Roadmap 20: Worktree guard and its shell parser

```json
{
  "id": "AR0023",
  "title": "Roadmap 20: Worktree guard and its shell parser",
  "date": "2026-10-16",
  "after": [
    "AR0022"
  ]
}
```

## Description

Roadmap entry 20 of `spec/roadmap.md`: Worktree guard and its shell parser. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 20 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feat

## Done means

- Everything under entry 20's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 20 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 20 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
