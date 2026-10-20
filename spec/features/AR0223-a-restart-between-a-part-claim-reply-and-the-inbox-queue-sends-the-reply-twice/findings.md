# AR0223 - Findings

## F1. The reply filter could take the coordinator's own reply for a claim's reply

- Kind: risk
- Found by: 2026-10-20-review-ar0223-claim-repl-11310291 (review), 2026-10-20
- Where: `packages/orchestration/src/inbox.ts:45-47`
- What: the filter matches any `coordinator-replied` event that answers only this message, so if a message's file were back in `received/` after it was already queued and answered, the coordinator's final reply would be counted as a claim's reply.
- Suggestion: none now; it needs an already broken invariant, since `queue()` refuses to queue a message twice.
- Status: dropped (needs a broken invariant that queue() already prevents)
