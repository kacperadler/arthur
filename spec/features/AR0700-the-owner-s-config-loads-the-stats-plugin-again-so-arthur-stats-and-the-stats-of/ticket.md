# AR0700 - The owner's config loads the stats plugin again, so arthur stats and the Stats of audits and retros come back

```json
{
  "id": "AR0700",
  "title": "The owner's config loads the stats plugin again, so arthur stats and the Stats of audits and retros come back",
  "date": "2026-11-13"
}
```

## Description

AR0651 moved `arthur stats` and the merged-ticket report from the manage plugin to the stats plugin, and the owner's `arthur.config.ts` does not load stats. Since that merge his Arthur has no `arthur stats`, and every audit and retro prompt reads `### Stats: none: the stats plugin is not loaded`. Loading the stats plugin in his config brings both back. The config is his file, so the change goes in only on his word.

## Goal

Until AR0651 merged, the owner had `arthur stats` and the Stats section in every audit and retro. The move took both away on his own server, and nothing told him.

Evidence:
- `b74f171e`: the `stats` command and its report move from manage to the stats plugin. `packages/manage/src/audit.ts:84` and `retro.ts:120` now fall back to `none: the stats plugin is not loaded`.
- `/home/kacper/arthur/arthur.config.ts:1-18`: the imports include manage, herdr and others, but no `@arthur/stats`. `grep stats` there finds nothing.
- The 2026-11-13 audit's own prompt reads `### Stats: none: the stats plugin is not loaded`. Today is Friday, so the retro (`retro: { day: "fri", at: "22:30" }`, config line 43) gets the same.

- Kind: chore

## Done means

- `arthur.config.ts` imports `stats` from `@arthur/stats` and lists `stats()` among its plugins; `arthur config check` passes.
- After the restart, `arthur stats` prints the merged-ticket report and `arthur stats --help` answers.
- The next audit or retro prompt carries a `### Stats` section with numbers, not `none: the stats plugin is not loaded`.

## Scope

In:
- `arthur.config.ts` (the owner's, not committed): one import and one plugin line, on his word.

Out:
- No code change.

## Decisions

- 2026-11-13: Source: audit spec/quality/2026-11-13.md
- 2026-11-13: AR0700 approved: load the stats plugin in the owner config; the owner: "AR-D667 approve" (AR-D667)
