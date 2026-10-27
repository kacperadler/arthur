# AR0534 - Delivery's review-needed reads `process\.env` in a regex as the secrets file too

```json
{
  "id": "AR0534",
  "title": "Delivery's review-needed reads `process\\.env` in a regex as the secrets file too",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0519 (spec/features/AR0519-the-env-guard-refuses-a-command-whose-text-holds-the-word-env-after-a-dot-such/findings.md).

- Kind: fix
- Found by: 2026-10-27-worker-7ea85a74 (worker), 2026-10-27
- Where: `packages/delivery/src/review-needed.ts:15`
- What: `DOT_ENV = /(?<!\w)\.env\b/` matches `.env` after a backslash, so a changed source line holding a regex such as `/process\.env\.(\w+)/` gets `review: the diff mentions .env in <path>`, though its doc (`packages/delivery/docs/commands/review-needed.md:17`) says `process.env` is not `.env`. The same miss AR0519 fixed in the core's env guard. [INFERENCE] from the regex; not run.
- Suggestion: `(?<![\w.]\\*)` in place of `(?<!\w)`, as `packages/core/src/env-refusal.ts` now has, with a row in its test; nothing else changes.

## Goal

`arthur review-needed` stops counting a regex on Node's environment object in a diff as a mention of the secrets file, as the core's env guard already does since AR0519. Evidence: `packages/delivery/src/review-needed.ts:15` matches the name after a backslash, while its doc says such a regex is not the file.

- Kind: fix

## Done means

- The match in `review-needed.ts` uses the same lookbehind as `packages/core/src/env-refusal.ts`; a test row: a changed line with such a regex needs no review for that reason, and a line naming the file itself still does; the row fails without the fix.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/review-needed.ts` and its test.

Out:
- The core's env guard: done in AR0519.

## Decisions

- 2026-10-27: Source: F1 of AR0519
