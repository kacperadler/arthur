# AR0197 - Outcome

- Merged: 2026-10-19, `4919c0a`
- Branch: h/2026-10-19-ar0197-youtrack-e4f38f0b
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $6.69, reviews $1.72; review rounds 2

## What went in

- Writing to YouTrack (roadmap 45): `issue create|update` from a file (first line the summary), `article create|update` (an update refuses an article changed since the version read), `issue set <id> <field> <value>` in each field type's shape, `issue work <id> <minutes> [<text>]`; every refusal comes before any call.
- `issue list` shows unresolved issues by default and every issue with `--all` (AR0195, the owner's decision).
- The coordinator's role names `arthur youtrack` (AR0194).

## Checks on main

- `npm run check`: passed.
- `npm test`: 653/653 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0204 (F1), AR0205 (F2).
