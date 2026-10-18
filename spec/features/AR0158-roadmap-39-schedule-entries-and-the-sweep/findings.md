# AR0158 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A registered entry's procedure will be a path the entry check refuses

- Kind: risk
- Found by: 2026-10-18-ar0158-f5a05899 (worker), 2026-10-19
- Where: `packages/schedule/src/entry.ts:38-40`
- What: an action's `procedure` must be a relative `.md` path inside the folder `arthur run` runs in, so a job's edit of `spec/schedule.json` cannot make the coordinator's message carry `.env` or a file outside the checkout. Roadmap entry 40 lets a plugin register entries (orchestration's morning report, whose procedure would sit in its own package, e.g. `packages/orchestration/roles/coordinator/morning-report.md` reached through `import.meta.url`): such a path is absolute and outside the checkout once Arthur is installed, so running registered entries through `entryProblems` as it is refuses them.
- Suggestion: in entry 40, check a registered entry's procedure apart from the file's (an absolute `.md` path the registering plugin hands over, which the styleguide lets schedule read), and keep the relative-path rule for the config and the file. Nothing to change before entry 40.
- Status: open
