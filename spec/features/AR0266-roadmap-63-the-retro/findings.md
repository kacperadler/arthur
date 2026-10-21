# AR0266 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Arthur's own repository has no criteria folder, so its audits and retros run without their criteria

- Kind: risk
- Found by: 2026-10-21-ar0266-roadmap-63-retro-24c444e9 (worker), 2026-10-21
- Where: `.agents/arthur/criteria/` (missing); `packages/manage/criteria/retro.md`, `packages/manage/criteria/audit.md`
- What: with a config whose project is this repository (`projects({ list: [{ name: "arthur", prefix: "AR", path: ".." }] })`), `arthur roles` prints `criteria .agents/arthur/criteria/retro.md  missing: a spawn warns and starts without it`; `ls .agents/arthur/criteria` says no such folder. Once Arthur runs itself, its retro and audit start without the criteria that say what is worth a proposal; the harness's own files sit in `.agents/harness/criteria/`, where `retro.md` is four bare headings.
- Suggestion: before the switch, copy the criteria manage and orchestration ship (`audit.md`, `retro.md`, `autopilot.md`) and the styleguide and review criteria into `.agents/arthur/criteria/`, or point the project's `prompts.criteriaDir` at `.agents/harness/criteria/` and fill its `retro.md`. Out: changing what the roles read.
- Status: ticket AR0272
