# AR0006 - Roadmap 3: Config: env names, .env, and arthur config check

```json
{
  "id": "AR0006",
  "title": "Roadmap 3: Config: env names, .env, and arthur config check",
  "date": "2026-10-16",
  "after": [
    "AR0005"
  ]
}
```

## Description

Roadmap entry 3 of `spec/roadmap.md`: Config: env names, `.env`, and `arthur config check`. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 3 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feat

## Done means

- Everything under entry 3's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 3 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 3 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: Coordinator accepts: a plugin entry is `{ name, options }` with `enabled` inside `options` (entry 4 builds on it); the 18-line `arthur` binary in `packages/core/src/cli.ts` is temporary and entry 6 replaces it with the command registry.
