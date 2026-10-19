# AR0189 - Outcome

- Merged: 2026-10-19, `2bda2a3`
- Branch: h/2026-10-19-ar0189-youtrack-502e11ad
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.93, reviews $1.62; review rounds 2

## What went in

- The `youtrack` plugin (roadmap 44): instances `{ name?, urlEnv, tokenEnv }` (at most one unnamed), each project's `tracker` picks one, checked at load with refusals that name the variable, never its value; `timeoutSeconds` (default 30).
- `arthur youtrack issue|article list|get` reads from the project's instance; a timeout or an error gives one line.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 631/631 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0194 (F1), AR0195 (F2).
