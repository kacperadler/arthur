# AR0505 - Findings

## F1. The new test pins the role's exact wording

- Kind: test
- Found by: 2026-10-27-review-e01be80f (review), 2026-10-27
- Where: `packages/orchestration/test/context.test.ts:84-90`
- What: the test checks the rule's words, as the file's other per-rule tests do.
- Status: dropped (the file's convention for role rules, and the ticket asked for it)

## F2. `telegram.md:67`, named in the ticket's Where, is unchanged

- Kind: docs
- Found by: 2026-10-27-review-e01be80f (review), 2026-10-27
- Where: `packages/telegram/docs/telegram.md:67`
- What: the channel doc already describes the mark; the ticket's scope left the channel side out.
- Status: dropped (out of scope by the ticket; nothing wrong in it)
