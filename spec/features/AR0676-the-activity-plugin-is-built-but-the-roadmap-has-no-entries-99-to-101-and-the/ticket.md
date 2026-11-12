# AR0676 - The activity plugin is built, but the roadmap has no entries 99 to 101 and the vision and diagrams do not show it

```json
{
  "id": "AR0676",
  "title": "The activity plugin is built, but the roadmap has no entries 99 to 101 and the vision and diagrams do not show it",
  "date": "2026-11-10"
}
```

## Description

The roadmap, the vision and the diagrams show the activity plugin and the other built parts they miss, so planners and the owner see what exists.

## Goal

the roadmap and vision are where the owner and every planner read what exists and what comes next. A built plugin missing from them gets planned against as if it were not there.

Evidence (audit 2026-11-10):
- `packages/activity/docs/activity.md:3` and the header comment of `packages/activity/src/activity.ts` cite "spec/roadmap.md, entry 100". `spec/roadmap.md` has no `### 99`, `### 100` or `### 101`; the activity log appears only in a sentence at `:19`.
- The entries are already written in the approved plan: `spec/features/AR0527-…/plan.md:146-148`. AR0639 and AR0648 did this same job for releases and stats; no ticket does it for activity. AR0530's Scope is `packages/activity/` only.
- The site's roadmap page is built from `spec/roadmap.md` (AR0634), so the activity log does not appear on it.
- Activity is missing from:
  - The vision's plugin table: no `| activity` row next to `:86` (stats).
  - `docs/architecture/core-and-plugins.mmd`, which also has no uptime.
  - `docs/architecture/versions.mmd`.
- `spec/vision.md:77`: the dokploy row still stops at uploads and deploys, without AR0654's create, setup and env.
- `spec/vision.md:36`: the roles a model can be set for leave out `plan-reviewer` and `pyramid`. Both have role files: `packages/orchestration/roles/plan-reviewer.md` and `packages/manage/roles/pyramid.md`.

- Kind: docs

## Done means

- `spec/roadmap.md` has entries 99, 100 and 101 from the AR0527 plan, with AR0528, AR0529 and AR0530; the site's roadmap page builds with them.
- `spec/vision.md`: an `activity` row, the dokploy row naming create, setup and env, and the role list at line 36 with `plan-reviewer` and `pyramid`.
- `docs/architecture/core-and-plugins.mmd` and `versions.mmd` show activity and uptime; `arthur.mmd` has an activity node.
- `npm test` passes on the clean tip.

## Scope

In:
- Add roadmap entries 99, 100 and 101 from the AR0527 plan, with their tickets AR0528, AR0529 and AR0530.
- Add a vision row for activity, complete the dokploy row, and complete the role list at `:36`.
- Add activity, and uptime where it is missing, to `core-and-plugins.mmd` and `versions.mmd`, plus an activity node in `arthur.mmd`.

Out:
- any other wording. After AR0673, which rewrites `arthur.mmd`'s class lines.

## Decisions
- 2026-11-10: Source: audit spec/quality/2026-11-10.md
- 2026-11-10: Source: F2 of AR0529
- 2026-11-10: Source: F2 of AR0654
- 2026-11-10: Source: F2 of AR0563
- 2026-11-10: AR0676 approved; the owner: "approve all five" (AR-D611)
- 2026-11-10: Merge AR0676 once its review passes and CI is green; the owner: "AR-D631: 1" (AR-D631)
