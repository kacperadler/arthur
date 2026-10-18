# AR0152 - Roadmap entry 93 depends on 41 but sits before it

```json
{
  "id": "AR0152",
  "title": "Roadmap entry 93 depends on 41 but sits before it",
  "date": "2026-10-18"
}
```

## Description

the roadmap says the coordinator starts an entry once everything in its "Depends on" is merged, in file order; 93 is listed before 41 but needs it, so the file order and the dependencies disagree. It was so before AR0134: a throwaway node script that walks the `### N.` headings and checks every number in `- Depends on:` against the entries above it printed `93 -> 41` on `git show HEAD:spec/roadmap.md` (main before this branch), and the same on this branch.

## Goal

Every roadmap entry sits after the entries it depends on, so building in order never needs something not yet built.

- Kind: cleanup

Evidence:
- `spec/roadmap.md`, entry 93 (under `## Session`, after 80), `- Depends on:` naming 41, which sits later under `## Projects`.
- Found by: 2026-10-18-ar0134-d1d258df (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: either move 93 and 94 after 41, or say in the Order paragraph that 93 waits for 41 although listed before it. Roadmap text only.
- `npm test` and `npm run check` pass.

## Scope

In:
- either move 93 and 94 after 41, or say in the Order paragraph that 93 waits for 41 although listed before it. Roadmap text only.

## Decisions

- 2026-10-18: Source: F2 of AR0134
