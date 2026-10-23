# AR0021 - Roadmap 18: Ticket board: transitions, after, the digest, and the board's phone commands

```json
{
  "id": "AR0021",
  "title": "Roadmap 18: Ticket board: transitions, after, the digest, and the board's phone commands",
  "date": "2026-10-16",
  "after": [
    "AR0020",
    "AR0012"
  ]
}
```

## Description

Roadmap entry 18 of `spec/roadmap.md`: Ticket board: transitions, `after`, the digest, and the board's phone commands. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 18 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feat

## Done means

- Everything under entry 18's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 18 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 18 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: Coordinator: OK on the worker's status table (merged and dropped final, work starts from planned, merge without review from in-progress or review for the owner's word) and on the new `ticket-after` event (entry 51 lists it).
