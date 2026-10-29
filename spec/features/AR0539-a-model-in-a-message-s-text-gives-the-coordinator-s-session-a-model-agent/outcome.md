# AR0539 - Outcome

- Merged: 2026-10-28, `32736d04`
- Branch: arthur/2026-10-28-worker-54510057
- Reviews: review-1.md PASS
- Cost: worker $1.02, reviews $0.43; review rounds 1

## What went in

- A `^` with a model name in a message handed to the coordinator (a job's message, a channel message) no longer gives its session a model agent: a word joiner now goes before each `^` at a line start or after whitespace, in the same step that already escapes an at-sign before a path.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1166/1233 passed.

## Left open

- Findings: F1 dropped (a comment cut to keep the line budget).
