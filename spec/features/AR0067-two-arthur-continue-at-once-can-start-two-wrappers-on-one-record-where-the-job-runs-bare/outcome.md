# AR0067 - Outcome

- Merged: 2026-10-16, `9dfd852`
- Branch: h/2026-10-16-ar0067-one-continue-at-a-52c02319
- Reviews: review-1.md PASS
- Cost: worker $2.43, reviews $0.74; review rounds 1

## What went in

- `job-control.ts`: `arthur continue` takes the record by creating `<record>/continuing` (exclusive); a second continue is refused `<id>: being continued`; every refusal or failed launch frees it; `wrapper.ts` frees it once running. No core budget raise (`job-record.ts` compacted).

## Checks on main

- `npm run check`: passed.
- `npm test`: 262/262 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0070 (F1).
