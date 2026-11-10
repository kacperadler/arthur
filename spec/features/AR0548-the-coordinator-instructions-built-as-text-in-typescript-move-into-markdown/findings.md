# AR0548 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A project cannot override a coordinator procedure

- Kind: feat
- Found by: 2026-11-10-worker-00e9fdaf (worker), 2026-11-10
- Where: `packages/core/src/roles.ts:128` (`sources`), `packages/delivery/src/delivery.ts:54`, `packages/manage/src/retro.ts:24`
- What: the ticket's Description says a project can override the moved wording, and its Done means asks the override path to cover these files "as it covers the other procedures". The prompt loader has an override only for a role file (`<rolesDir>/<role>.md`); every procedure under `packages/*/roles/coordinator/` (`review-limit.md`, `retro-ended.md`, `plan-ended.md`, and the eight files this ticket adds) is read straight from the package with `readFileSync(new URL(..., import.meta.url))`, so no project changes one short of editing Arthur's own package. The new files follow that same path, so they are as overridable as the others: not at all.
- Suggestion: one rule for all procedures, such as `<rolesDir>/coordinator/<name>.md` in the main project read in place of the package's file when present (never through a symlink, as `projectFile` reads), a function of the core's that each plugin asks through the host; `arthur roles` and the retro's list would name the override. Out: per-project procedures for projects other than the main one.
- Status: deferred (client summary)
