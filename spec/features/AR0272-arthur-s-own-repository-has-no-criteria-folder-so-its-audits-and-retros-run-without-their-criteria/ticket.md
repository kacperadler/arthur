# AR0272 - Arthur's own repository has no criteria folder, so its audits and retros run without their criteria

```json
{
  "id": "AR0272",
  "title": "Arthur's own repository has no criteria folder, so its audits and retros run without their criteria",
  "date": "2026-10-21"
}
```

## Description

with a config whose project is this repository (`projects({ list: [{ name: "arthur", prefix: "AR", path: ".." }] })`), `arthur roles` prints `criteria .agents/arthur/criteria/retro.md  missing: a spawn warns and starts without it`; `ls .agents/arthur/criteria` says no such folder. Once Arthur runs itself, its retro and audit start without the criteria that say what is worth a proposal; the harness's own files sit in `.agents/harness/criteria/`, where `retro.md` is four bare headings.

## Goal

Arthur's own repository has its criteria folder, so its audits and retros run with the criteria that say what is worth a proposal.

- Kind: security

Evidence:
- `.agents/arthur/criteria/` (missing); `packages/manage/criteria/retro.md`, `packages/manage/criteria/audit.md`
- Found by: 2026-10-21-ar0266-roadmap-63-retro-24c444e9 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: before the switch, copy the criteria manage and orchestration ship (`audit.md`, `retro.md`, `autopilot.md`) and the styleguide and review criteria into `.agents/arthur/criteria/`, or point the project's `prompts.criteriaDir` at `.agents/harness/criteria/` and fill its `retro.md`. Out: changing what the roles read.
- `npm test` and `npm run check` pass.

## Scope

In:
- before the switch, copy the criteria manage and orchestration ship (`audit.md`, `retro.md`, `autopilot.md`) and the styleguide and review criteria into `.agents/arthur/criteria/`, or point the project's `prompts.criteriaDir` at `.agents/harness/criteria/` and fill its `retro.md`. Out: changing what the roles read.

## Decisions

- 2026-10-21: Source: F1 of AR0266
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
