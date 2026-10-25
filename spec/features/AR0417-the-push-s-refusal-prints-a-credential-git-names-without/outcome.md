# AR0417 - Outcome

- Merged: 2026-10-25, `9ffac56c`
- Branch: arthur/2026-10-25-worker-0786d1ba
- Reviews: review-1.md PASS
- Cost: worker $0.35, reviews n/a; review rounds 1

## What went in

- `packages/github/src/github-git.ts`: a push's refusal also replaces every word holding an `@` in git's line with `origin`, so a credential git prints without quotes or `://` (`arthur:s3cret@127.0.0.1`) never shows.
- `packages/github/test/github.test.ts`: a push to a `git://` origin with userinfo is refused naming `origin`, never `s3cret`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1108/1108 passed.

## Left open

- Findings: F1, F2, review notes, dropped (see findings.md).
