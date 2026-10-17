# AR0094 - Roadmap 23: The coordinator's process and arthur attach

```json
{
  "id": "AR0094",
  "title": "Roadmap 23: The coordinator's process and arthur attach",
  "date": "2026-10-17"
}
```

## Description

Roadmap entry 23 of `spec/roadmap.md`: The coordinator's process and `arthur attach`. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 23 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 23's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 23 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-17: Cut from `spec/roadmap.md` entry 23 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-17: The owner resumed Arthur's build; this entry is next.
- 2026-10-17: Worker: line budgets in `test/structure.test.ts`: orchestration 300 (276 at the commit); 8 lines move from core (4804) to core/testing (276) for the fake agent's `tool_call` handlers, which the env-guard test of the coordinator needs.
