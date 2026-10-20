# AR0222 - Outcome

- Merged: 2026-10-20, `a639c13`
- Branch: h/2026-10-20-ar0222-youtrack-full-man-76c0110c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.35, reviews $1.35; review rounds 2

## What went in

- `packages/youtrack/src/youtrack-command.ts`: `issue list --query` and `article list --query` search with YouTrack's query language inside the project, grouped by state; items from another project dropped; usage line with every new verb.
- `packages/youtrack/src/youtrack-links.ts`: `issue links`, `issue link <id> <type> <other>`, `issue unlink`, the other issue in the same project.
- `packages/youtrack/src/youtrack-write.ts`: `issue tag` (creates an unknown tag) and `issue untag`, `issue move <id> <project>`, `article create --parent`, `article move --parent`.
- `packages/youtrack/src/youtrack-work.ts`: `issue work list|edit|delete`.
- `packages/youtrack/src/youtrack-comments.ts`, `youtrack-attachments.ts`: comments and attachments on articles too; an article's comment delete is permanent (YouTrack has no restorable mark there).
- `packages/youtrack/docs/commands/youtrack.md`, `spec/roadmap.md` entry 45 and row Y1, README: the new verbs; `test/structure.test.ts`: youtrack budget 659.

## Checks on main

- `npm run check`: passed.
- `npm test`: 767/767 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; the reviews left no notes.
