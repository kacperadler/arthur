# AR0022 - Outcome

- Merged: 2026-10-16, `ebc6a89`
- Branch: h/2026-10-16-ar0022-env-guard-8ff85c28
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.56, reviews $1.92; review rounds 2

## What went in

- `packages/core/src/env-guard.ts`: the OMP extension that refuses a tool call naming a secrets file, as written, after the shell resolves quotes and expansions, and through unquoted globs; the one `sed -i` key form and look-alike names pass; exported as `@arthur/core/env-guard`.
- `shell-words.ts`: a bash word splitter, shared with entry 20.
- `wrapper.ts`: every run, the resume included, loads the guard.

## Checks on main

- `npm run check`: passed.
- `npm test`: 224/224 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0054 (F1).
