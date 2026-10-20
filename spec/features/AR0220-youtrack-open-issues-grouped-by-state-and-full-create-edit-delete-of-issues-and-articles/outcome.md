# AR0220 - Outcome

- Merged: 2026-10-20, `e037b36`
- Branch: h/2026-10-20-ar0220-youtrack-grouped-51fb6847
- Reviews: review-1.md PASS
- Cost: worker $3.94, reviews $0.88; review rounds 1

## What went in

- `packages/youtrack/src/youtrack-command.ts`: `issue list` prints unresolved issues under a heading per State with its count, in the State bundle's order, `(no state)` last, `--all` adding resolved states; `issue delete` and `article delete`; the usage line and header say delete is for the coordinator, never a job.
- `packages/youtrack/src/youtrack-api.ts`: an HTTP DELETE helper with YouTrack's error in one line.
- `packages/youtrack/src/youtrack-attachments.ts`: `attachment add <id> <file>` uploads a file, `attachment delete <id> <attachment>` removes one; `issue attachments` lines start with the attachment id.
- `packages/youtrack/docs/commands/youtrack.md`, `spec/roadmap.md` entry 45 and row Y1, `README.md`: deleting allowed for the coordinator only.
- Tests against the fake server for grouping, deletes, attachments, and refusals (outside project, inside a job).

## Checks on main

- `npm run check`: passed.
- `npm test`: 741/741 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1, F2 dropped (review notes, no change needed). AR0222 (the rest of full YouTrack management) waits for the owner's approval.
