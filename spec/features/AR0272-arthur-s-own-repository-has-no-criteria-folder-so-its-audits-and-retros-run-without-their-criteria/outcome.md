# AR0272 - Outcome

- Merged: 2026-10-22, `8d5d6bd`
- Branch: h/2026-10-22-ar0272-7e470561
- Reviews: review-1.md PASS
- Cost: worker $1.76, reviews $0.57; review rounds 1

## What went in

- `.agents/arthur/criteria/` (`audit.md`, `retro.md`, `autopilot.md`, `styleguide.md`, `review.md`): Arthur's own repository has its criteria, copies of what manage, orchestration and the harness ship, so its audits and retros read what is worth a proposal.
- `arthur.config.example.ts`: the `arthur` project no longer points `criteriaDir` at the harness's bare criteria; only `rolesDir` stays.
- `test/arthur-criteria.test.ts`: the roles read exactly these five files, no role prompt warns, and every heading has text under it.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1022/1022 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0297 (F1).
