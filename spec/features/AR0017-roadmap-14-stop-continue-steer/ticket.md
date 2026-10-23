# AR0017 - Roadmap 14: Stop, continue, steer

```json
{
  "id": "AR0017",
  "title": "Roadmap 14: Stop, continue, steer",
  "date": "2026-10-16",
  "after": [
    "AR0014",
    "AR0016"
  ]
}
```

## Description

Roadmap entry 14 of `spec/roadmap.md`: Stop, continue, steer. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 14 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feat

## Done means

- Everything under entry 14's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 14 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 14 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: Coordinator: OK on the three calls: steer works on any running job (read-only kinds too); on continue the cost carries over and --budget replaces the budget (no --budget after a budget stop stops again at once), the timeout restarts; the agent runs in its own process group so the wrapper can SIGKILL it and tell arthur stop from its own signals.
- 2026-10-16: Coordinator: core line budget raised from 4000 to 4224 for stop, continue and steer (374 lines on top of main's 3850), on the condition that the round-3 review finds nothing in them that can be cut.
