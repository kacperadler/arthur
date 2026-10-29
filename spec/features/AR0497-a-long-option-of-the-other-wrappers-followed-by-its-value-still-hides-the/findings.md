# AR0497 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. A value-taking option that is a prefix of a no-value option would pass silently

- Kind: security
- Found by: 2026-10-29-review-93bf60c6 (review), 2026-10-29
- Where: `packages/core/src/worktree-guard.ts:54`
- What: the prefix rule does not prefer an option whose whole name the word spells; correct today only because no listed pair breaks it, which the comment at `:17` alone holds.
- Status: deferred (client summary)

## F2. An ambiguous sudo prefix is now read as `--chdir`

- Kind: fix
- Found by: 2026-10-29-review-93bf60c6 (review), 2026-10-29
- Where: `packages/core/src/worktree-guard.ts:54`
- What: `sudo --ch dir` is read as `--chdir`; real sudo rejects the ambiguous prefix and runs nothing, so no write hides.
- Status: deferred (client summary)
