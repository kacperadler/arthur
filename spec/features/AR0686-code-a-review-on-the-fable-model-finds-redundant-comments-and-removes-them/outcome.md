# AR0686 - Outcome

- Merged: 2026-11-12, `e1847934`
- Branch: arthur/2026-11-11-worker-79fbb88e
- Reviews: review-1.md PASS
- Cost: worker $1.43, reviews $0.23; review rounds 1

## What went in

- `packages/core/src/job-records.ts`: the comment `// Returns the steer's number.` over `steer` is gone (`packages/core/src`: 7464 → 7463 lines, 1119 → 1118 comment lines).
- `packages/delivery/src/ci-wait.ts`: the comment `// The job ids with a wait.` over `waiting` is gone (`packages/delivery/src`: 2120 → 2119 lines, 336 → 335 comment lines).
- `packages/dokploy/src/dokploy-api.ts`: the comment over the one-line `field` is gone (`packages/dokploy/src`, three files together: 801 → 798 lines, 115 → 112 comment lines).
- `packages/dokploy/src/dokploy-setup.ts`: the comment `// A list in Dokploy's answer, or none.` over `listed` is gone.
- `packages/dokploy/src/dokploy-source.ts`: the comment `// A list in Dokploy's answer, or none.` over `listed` is gone.
- `packages/github/src/github-api.ts`: the comment over the one-line `field` is gone (`packages/github/src`: 1210 → 1209 lines, 172 → 171 comment lines).
- `packages/orchestration/src/decision-class.ts`: the comment `// Records the owner's revoke of class \`id\`.` over `revoke` is gone (`packages/orchestration/src`: 2710 → 2709 lines, 360 → 359 comment lines).
- `packages/youtrack/src/youtrack-api.ts`: the comment over the one-line `field` is gone (`packages/youtrack/src`: 672 → 671 lines, 92 → 91 comment lines). All of `packages/*/src`: 24724 → 24716 lines and 3420 → 3412 comment lines. Every other package and `test/structure.ts` (163 lines, 12 comment lines) are unchanged.
- `spec/features/AR0686-code-a-review-on-the-fable-model-finds-redundant-comments-and-removes-them/findings.md`: new; F1 (open) records the same redundant comment in `dokploy-postgres.ts:14`, which came in after the plan.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1715/1786 passed.

## Left open

- Deferred (client summary): F1. A ninth redundant comment came in after the plan
