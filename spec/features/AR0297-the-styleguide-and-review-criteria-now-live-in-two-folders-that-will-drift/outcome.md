# AR0297 - Outcome

- Merged: 2026-10-22, `bb00d85`
- Branch: h/2026-10-22-ar0297-29dfb450
- Reviews: review-1.md PASS
- Cost: worker $1.15, reviews $0.28; review rounds 1

## What went in

- `.agents/arthur/criteria/` and `.agents/harness/criteria/` (`styleguide.md`, `review.md`): a note says the two copies are kept the same until the switch, an edit of one made in the other.
- `spec/roadmap.md`: the switch removes `.agents/harness/` and the `rolesDir` pointing into it, and deletes the equality test, leaving `.agents/arthur/criteria/` the one copy.
- `test/arthur-criteria.test.ts`: fails with `<name>: make the same edit in both copies` when the copies differ; skipped once `.agents/harness/criteria/` is gone.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1035/1035 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
