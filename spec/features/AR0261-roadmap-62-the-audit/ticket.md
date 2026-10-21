# AR0261 - Roadmap 62: the audit

```json
{
  "id": "AR0261",
  "title": "Roadmap 62: the audit",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 62 in `spec/roadmap.md` in the `manage` plugin.

## Goal

The specification is roadmap entry 62: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 62's Delivers and Done means list, each refusal and edge case with its test: filing a failed audit is refused; a second audit the same day; a day not in `audit.days` makes no job; no commits since the last audit makes no job; a resume after the budget ran out happens once.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 62 as built.

## Scope

In:
- `packages/manage`, its roles, criteria and docs, tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (4% at 15:xx).
- 2026-10-21: Coordinator (free hand) accepted the core change: `arthur ticket file <job>` files a job of no ticket, `Filing.root`. F1 decided: commits that touch only `spec/build.json`, `spec/features/**` or `spec/quality/**` do not count as commits since the last audit.
