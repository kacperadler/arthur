# AR0352 - Outcome

- Merged: 2026-10-25, `293b4ac4`
- Branch: arthur/2026-10-25-worker-82dd54ce
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $0.81, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/delivery-options.ts`: the default always-review list also names `.agents/**/roles/reviewer.md` and `.agents/**/criteria/review.md`, since `**` does not enter a dot folder; a branch that changes a project's own reviewer role or review criteria is always reviewed. The comment stays three lines, within delivery's line budget (1317).
- `packages/delivery/docs/commands/review-needed.md`: says `**` does not enter a dot folder unless the pattern names it, and lists the two entries; `arthur.config.example.ts` lists them too.
- `packages/delivery/test/review-needed.test.ts`: a branch changing only either file is answered `review: … is on the always-review list`; the default list holds both.
- Reviews: review-1 PASS; the merge's `npm test` then failed delivery's line budget (1318 over 1317) and main stayed as it was; the worker shortened the comment; review-2 PASS. Merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Findings: none; no findings.md on this ticket.

- Findings: F1, F2 dropped (findings.md).
