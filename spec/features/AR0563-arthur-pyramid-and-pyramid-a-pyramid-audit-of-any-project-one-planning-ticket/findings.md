# AR0563 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A finished pyramid audit left unfiled raises no health line

- Kind: feat
- Found by: 2026-11-07-worker-0af70689 (worker), 2026-11-07
- Where: `packages/manage/src/health-checks.ts`, `packages/manage/docs/commands/health.md:24`
- What: the "report not filed" check covers only `audit` and `retro` jobs and their folders (`spec/quality/`, `spec/retro/`). A `pyramid` job that ended `finished` and was never filed (the coordinator missed its wake) is pruned later with its result, and nothing says so.
- Suggestion: add the kind `pyramid` and `spec/pyramid/` to the check's list of kinds and report folders, and its doc line; nothing else changes.
- Status: deferred (client summary)

## F2. The vision's list of roles a model can be set for leaves out the newer roles

- Kind: docs
- Found by: 2026-11-07-worker-0af70689 (worker), 2026-11-07
- Where: `spec/vision.md:36`
- What: the settings table names "worker, reviewer, planner, auditor, retro, onboarding" as the roles of `roles`; `plan-reviewer` and now `pyramid` are roles too, which `roles.pyramid` sets like the rest. The vision is the owner's, so the worker left it.
- Suggestion: the owner adds `plan-reviewer` and `pyramid` to the list, or ends it with "...".
- Status: deferred (client summary)
