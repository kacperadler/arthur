# AR0682 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A cron field out of its range passes `postgres backup` and Dokploy never runs the backup

- Kind: fix
- Found by: 2026-11-11-worker-ecc8d982 (worker), 2026-11-11
- Where: `packages/dokploy/src/dokploy-postgres.ts:103`
- What: `--schedule` is checked as the plan says, five fields of the cron alphabet (digits, letters, `*`, `,`, `/`, `?`, `#`, `-`), not each field's range. `arthur dokploy postgres backup <postgres> --destination s3-main --schedule "99 3 * * *"` passes, `backup.create` stores it, and Dokploy's `scheduleBackup` hands it to node-schedule, whose `scheduleJob` returns null for a rule it cannot parse [INFERENCE: from node-schedule's documented behavior, not run here]; the backup is listed as enabled and never runs, with no error.
- Suggestion: check each field against its range (minute 0-59, hour 0-23, day 1-31, month 1-12 or JAN-DEC, weekday 0-7 or SUN-SAT) with its lists, ranges and steps, before any request; leave Dokploy's own validation out.
- Status: open
