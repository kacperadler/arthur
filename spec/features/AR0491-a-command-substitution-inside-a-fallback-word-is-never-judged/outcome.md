# AR0491 - Outcome

- Merged: 2026-10-29, `45222bfd`
- Branch: arthur/2026-10-29-worker-088efe1b
- Reviews: review-1.md PASS
- Cost: worker $1.21, reviews $0.59; review rounds 1

## What went in

- `packages/core/src/shell-words.ts`: a `$(...)` or backtick inside a fallback word (`${x:-...}`, `=`, `+`, `?` and their `:` forms), quoted or not, nested too, is parsed once and judged before the command it sits in; the fallback's own words stay one word.
- `packages/core/test/worktree-guard.test.ts`: every operator, quoted and unquoted, a backtick, a nested fallback and a `cd` that does not last, each refused as the main checkout.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1211/1279 passed.

## Left open

- Deferred (client summary): F1. The pattern operators (`#`, `%`, `/`, `^`, `,`, substrings) still hide a substitution from the guard
- Deferred (client summary): F2. An escaped `$` in an unquoted fallback is refused as the main checkout, not as unknown
