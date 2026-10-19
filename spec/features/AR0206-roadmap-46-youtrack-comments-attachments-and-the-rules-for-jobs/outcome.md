# AR0206 - Outcome

- Merged: 2026-10-19, `00b089f`
- Branch: h/2026-10-19-ar0206-youtrack-285a58cd
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.59, reviews $1.88; review rounds 2

## What went in

- YouTrack comments and attachments (roadmap 46): `comment list|add|edit|delete` (delete only marks it deleted, restorable); `issue attachments <id>` saves every file into `.arthur/youtrack/<id>/` under a safe name (no climbing out, no absolute path, no control characters), and refuses before any download when a file is on another server.
- `issue update` refuses a description changed since it was read (AR0204).
- Every job of a YouTrack project gets the job rules, and a job's write to YouTrack is refused; the coordinator writes only when the owner asks (AR0205).

## Checks on main

- `npm run check`: passed.
- `npm test`: 674/674 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
