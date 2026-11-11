# AR0686 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A ninth redundant comment came in after the plan

- Kind: refactor
- Found by: 2026-11-11-worker-79fbb88e (worker), 2026-11-11
- Where: `packages/dokploy/src/dokploy-postgres.ts:14`
- What: `// A list in Dokploy's answer, or none.` sits over the one-line `const listed = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);`, the same pair the plan removes from `dokploy-setup.ts` and `dokploy-source.ts`. The file came in with AR0681 (56ebaebd), after the plan's `ed1720e8`, so the approved list does not name it and this branch leaves it (the ticket: the worker removes exactly what the approved plan lists).
- Suggestion: remove that one comment line; nothing else changes.
- Status: open
