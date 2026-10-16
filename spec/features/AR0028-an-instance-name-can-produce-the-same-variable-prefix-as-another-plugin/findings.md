
## F1. Owner lookup takes the first longer prefix, not the longest

- Status: ticket AR0030
- Source: review-1.md of AR0028
- `nameProblem` in `packages/core/src/env.ts` picks the first matching longer prefix in `owners` order; with three or more nested levels it could name the wrong owner. Make it pick the longest, with a three-level test.
