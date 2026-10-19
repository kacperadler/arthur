# AR0149 - Outcome

- Merged: 2026-10-19, `ea8aa95`
- Branch: h/2026-10-19-ar0149-resources-pair-f2e0e6b4
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.06, reviews $2.14; review rounds 2

## What went in

- Free CPU and memory are read in each machines check round (`machines.round`), so placement never uses a reading older than that check; a failing `node -e` takes the machine offline with its line (AR0149).
- A ticket's slice with a memory cap gets `MemorySwapMax=0`, `infinity` without one; the joint slice is unchanged (AR0217).

## Checks on main

- `npm run check`: passed.
- `npm test`: 731/731 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0218 (F1).
