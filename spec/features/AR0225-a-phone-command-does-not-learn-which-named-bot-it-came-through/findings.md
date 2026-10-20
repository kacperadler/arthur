# AR0225 - Findings

## F1. "Telegram back while nothing new is sent" failed once under load

- Kind: risk
- Found by: 2026-10-20-ar0225-phone-command-nam-ca98ac01 (worker), 2026-10-20
- Where: `packages/telegram/test/` ("Telegram back while nothing new is sent: an answered poll sends what waits")
- What: failed once in a combined run of several test files, passed 3/3 alone and in the full run; this branch did not touch that path. [INFERENCE] timing under load.
- Suggestion: folded into AR0226, which is fixing the outbox's flaky retry test in the same file family.
- Status: fixed (7dc8ea3, in AR0226)
