# Findings

## F1. No test pins `--constructor` as an unknown flag

- Kind: test gap
- Found by: 2026-10-16-review-ar0074-ar0074-cor-38efb310 (review), 2026-10-16
- Where: `packages/core/src/flags.ts:9`
- What: `Object.hasOwn` keeps prototype names (`--constructor`, `--__proto__`) unknown; checked by hand, but `name in checks` still passes every test.
- Suggestion: one test case in the next ticket that touches `flags.ts`.
- Status: deferred (the human asked for fewer small tickets; checked by hand)

