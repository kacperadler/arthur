# AR0491 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. The pattern operators still hide a substitution from the guard

- Kind: security
- Found by: 2026-10-29-review-25637713 (review), 2026-10-29
- Where: `packages/core/src/shell-words.ts:90`
- What: `echo ${x#$(rm ../../acme/README.md)}` and `echo ${x/a/$(...)}` pass with `undefined`; the fallback pattern only matches `:?[-=+?]`, so `#`, `%`, `/`, `^`, `,` and substring words are never parsed. Older than this branch.
- Status: deferred (client summary)

## F2. An escaped `$` in an unquoted fallback is refused as the main checkout, not as unknown

- Kind: fix
- Found by: 2026-10-29-review-25637713 (review), 2026-10-29
- Where: `packages/core/src/shell-words.ts:90`
- What: `${x:-\$(rm ...)}` leaves `(...)`, read as a subshell; refused either way, only overcautious.
- Status: deferred (client summary)
