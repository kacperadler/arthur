# AR0005 - Roadmap 2: Config: defineConfig and the core's options

```json
{
  "id": "AR0005",
  "title": "Roadmap 2: Config: defineConfig and the core's options",
  "date": "2026-10-16",
  "after": [
    "AR0004"
  ]
}
```

## Description

Roadmap entry 2 of `spec/roadmap.md`: Config: `defineConfig` and the core's options. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 2 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 2's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 2 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 2 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
