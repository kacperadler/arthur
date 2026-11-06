# AR0639 - Roadmap entries 104 to 107 and the vision lines for releases, installing and updating, from the AR0128 plan

```json
{
  "id": "AR0639",
  "title": "Roadmap entries 104 to 107 and the vision lines for releases, installing and updating, from the AR0128 plan",
  "date": "2026-11-06"
}
```

## Description

The owner approved the AR0128 plan on 2026-11-06 (AR-D514): Arthur is released as Git tags and GitHub releases, one version for the core and every plugin, first release 0.1.0, installed by cloning and checking out the newest tag, updated by `arthur update` and `arthur machines update`. This ticket writes that plan into the roadmap and the vision, so the next tickets can be cut from them; it builds nothing.

## Goal

The roadmap and the vision say how Arthur is released, installed and updated, as `spec/features/AR0128-plan-releases-installing-and-updating-arthur/plan.md` (Approach, section 7) lays out. Evidence: `spec/roadmap.md:308`, entry 30, still names `npm i -g arthur` as a machine's fix, which cannot work (the plan's "Not available directly": Node refuses `.ts` under `node_modules`, `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, and the npm name `arthur` is taken).

- Kind: docs

## Done means

- `spec/roadmap.md` has entries 104 to 107 as the plan's section 7 names them (what each delivers, its packages, what it depends on, its size), each pointing at the AR0128 plan's section for the detail.
- Entry 30's machine fix names `arthur machines update` (from 106) instead of `npm i -g arthur`; no line of `spec/roadmap.md`, `README.md` or `docs/` tells a reader to install Arthur from npm.
- `spec/vision.md` says, in a line or two where it fits ("What stays true" or "How it is built"): one version for the core and every plugin, released as a Git tag and a GitHub release, not on npm, first release 0.1.0; installed from a clone at the newest tag, updated by `arthur update`.
- The roadmap page the site generates still builds, and its counts are unchanged for every existing entry (the new entries show not started).
- `npm run check` and `npm test` pass.

## Scope

In:
- `spec/roadmap.md`: entries 104 to 107, entry 30's fix.
- `spec/vision.md`: the release and install lines.
- `README.md` or a file in `docs/` only where it tells a reader to install from npm.

Out:
- Any code: entries 104 to 107 become their own tickets, cut from the roadmap after this one, each asked of the owner.
- The `@arthur` npm scope: not needed under the approved option.

## Decisions
- 2026-11-06: Start AR0639 now, budget $4; the owner: "AR-D515 - 1" (AR-D515)

