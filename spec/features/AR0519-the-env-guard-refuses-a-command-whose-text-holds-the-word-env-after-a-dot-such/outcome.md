# AR0519 - Outcome

- Merged: 2026-10-27, `0a1d4b83`
- Branch: arthur/2026-10-27-worker-7ea85a74
- Reviews: review-1.md PASS
- Cost: worker $2.02, reviews $1.07; review rounds 1

## What went in

- `packages/core/src/env-refusal.ts`: the guard's name match no longer takes the secrets file's name for a file when it follows a word and backslashes, as in a regex on Node's environment object (the shell reads that as a dotted name, which opens nothing); the name after a space or a slash, after a variable, and in option forms is still refused.
- `packages/core/test/env-guard.test.ts`: allowed rows for grep, sed, rg and an eval regex on Node's environment object; refused rows for the backslash forms that still name the file.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1157/1224 passed.

## Left open

- Tickets from findings: AR0534 (F1).
