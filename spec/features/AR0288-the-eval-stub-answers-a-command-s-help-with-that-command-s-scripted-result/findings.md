# Findings

## F1. An orchestration inbox test overshoots its 30 s real-timer window under load

- Kind: risk
- Found by: 2026-10-22-review-ar0288-334451d7 (review note), 2026-10-22
- Where: `packages/orchestration/test/inbox.test.ts` (the 30 s real-timer tests near lines 308 and 326)
- What: in a full `npm test` run under load, one inbox test took 48 s against its 30 s window and failed; alone it passed in 33.5 s, and an uncontended full run passed. The file is untouched by AR0288.
- Suggestion: drive these waits by a fake clock or an injected delay instead of 30 s of real time, so the test neither overshoots under load nor costs half a minute.
- Status: ticket AR0293
