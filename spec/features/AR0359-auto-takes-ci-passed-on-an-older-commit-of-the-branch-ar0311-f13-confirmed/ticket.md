# AR0359 - `--auto` takes CI passed on an older commit of the branch (AR0311 F13, confirmed)

```json
{
  "id": "AR0359",
  "title": "`--auto` takes CI passed on an older commit of the branch (AR0311 F13, confirmed)",
  "date": "2026-10-23"
}
```

## Description

a branch whose last commits no run built (pushed with `[skip ci]`, skipped by a workflow's `paths-ignore`, or pushed before the run of the tip was listed) merges with `--auto` on a run of an ancestor: the review is of the tip, CI of what came before it, and the commits between are checked by the merge's own `check` and `test` on the VPS only.

## Goal

`--auto` merges only on CI passed for the tip itself, or for a commit whose later changes CI does not build; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/auto-merge.ts:56-68` (a run counts when `below < own`), `packages/delivery/src/ci-wait.ts:75` (a wait wakes for the same), `packages/delivery/docs/commands/merge.md:34`, pinned by `packages/delivery/test/auto-merge.test.ts:203` rows 217-224
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: take a run with `below === 0` only; for a tip with no run, wait as for none (`startWait`), and say `no run built the tip yet`; `ciEnded` wakes for `below === 0` only. The cost: a workflow with `paths-ignore` never passes the tip of a docs-only commit, so such a branch waits for the owner's `--no-ci`; name it in `docs/commands/merge.md`, "--auto". Tests: `auto-merge.test.ts:203` inverted (a run 1 below refused and waiting); `:226` an end 1 below the tip wakes nobody.
- `npm test` and `npm run check` pass.

## Scope

In:
- take a run with `below === 0` only; for a tip with no run, wait as for none (`startWait`), and say `no run built the tip yet`; `ciEnded` wakes for `below === 0` only. The cost: a workflow with `paths-ignore` never passes the tip of a docs-only commit, so such a branch waits for the owner's `--no-ci`; name it in `docs/commands/merge.md`, "--auto". Tests: `auto-merge.test.ts:203` inverted (a run 1 below refused and waiting); `:226` an end 1 below the tip wakes nobody.

## Decisions

- 2026-10-23: Source: F3 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
