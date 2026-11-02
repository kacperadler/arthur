# AR0581 - Outcome

- Merged: 2026-10-30, `e45aba3d`
- Branch: arthur/2026-10-30-worker-f5583304
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $6.38, reviews $1.49; review rounds 2

## What went in

- `tsconfig.json`: `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch` on; `packages/delivery/test/merge-checks.test.ts` and `packages/youtrack/test/youtrack.test.ts` lose the two unused names.
- `packages/github/test/github-shapes.json` (new): the keys of each GitHub REST example, plus the keys its schema requires, from the description pinned at `c66e2980`, with its URL and date; `packages/github/test/fake-shapes.test.ts` (new) calls every JSON route of the fake and compares the keys at every depth; `fake-github.ts` answers in those shapes (a job has `created_at`).
- `packages/telegram/test/telegram-shapes.json` (new) and `fake-shapes.test.ts` (new): the Bot API field tables; a field the docs require fails when removed; `fake-bot-api.ts`: a Video has `width`, `height`, `duration`.
- `packages/youtrack/test/youtrack-shapes.json` (new) and `fake-shapes.test.ts` (new): the OpenAPI entities; a key the plugin asks for, and `$type`, fail when removed; the fake moves from `youtrack.test.ts` into `fake-youtrack.ts`.
- `.agents/arthur/criteria/review.md`: a fake that answers in a shape its documentation does not show is one whose shape test fails or leaves out a route.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1260/1341 passed.

## Left open

- Deferred (client summary): F1. The YouTrack plugin asks for a user's `name`, which the OpenAPI User does not have
- Deferred (client summary): F2. The fake YouTrack answers keys the request did not ask for
- Deferred (client summary): F3. Error answers of the fake GitHub are not shape-checked
- Deferred (client summary): F4. Two guards of the shape tests matter only when a fake is broken, and survive mutation.
- Deferred (client summary): F5. The label and team item keys of a GitHub pull request are recorded but never compared.
