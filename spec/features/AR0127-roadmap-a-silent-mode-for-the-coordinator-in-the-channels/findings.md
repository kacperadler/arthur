# AR0127 - Findings

## F1. packages/session/test/restart.test.ts:204 fails now and then with "Unexpected end of JSON input"

- Kind: bug
- Found by: 2026-10-18-review-ar0127-1e955037 (review), 2026-10-18
- Where: `packages/session/test/restart.test.ts:204` (entry 36, AR0144)
- What: one full-suite run failed there with `SyntaxError: Unexpected end of JSON input`; the isolated rerun passed. Likely the test or the plugin reads `request.json` while it is being written (a write that is not atomic, or a read racing it) [INFERENCE].
- Status: ticket AR0159
