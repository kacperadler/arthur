# AR0465 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. If `show-options` fails after `show-environment` worked, the name could overwrite `update-environment[0]`

- Kind: fix
- Found by: 2026-10-27-review-95de6ae2 (review), 2026-10-27
- Where: `packages/orchestration/src/coordinator.ts:146-147`
- What: `free` becomes 0 when `show-options` fails, so the name would land on index 0 and `restore` would unset the owner's entry there; only if the server exits between the two calls.
- Status: dropped (a server that exited fails the next `set-option`, which refuses the start, and holds no option any more; the worker's reading, not contradicted by review 2)

## F2. While the indices are set, another client's new session on the same server copies the name from its own environment

- Kind: chore
- Found by: 2026-10-27-review-95de6ae2 (review), 2026-10-27
- Where: `packages/orchestration/src/coordinator.ts`
- What: for the moment between `set-option` and `restore`.
- Status: dropped (harmless and expected from the approach: that client's own value)
