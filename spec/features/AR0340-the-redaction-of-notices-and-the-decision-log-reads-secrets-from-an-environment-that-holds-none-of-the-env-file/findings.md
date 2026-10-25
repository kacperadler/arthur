# AR0340 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A blocked job's notice sends its question unredacted

- Kind: security
- Found by: 2026-10-25-worker-f639b3da (worker), 2026-10-25
- Where: `packages/orchestration/src/blocked-notice.ts:44`
- What: the notice `<job> asks [<id>]: <question>` carries the job's question as the job wrote it, while the decision log holds the same question redacted (`decision-hooks.ts:27`, `decision-log.ts:170`). A job question holding a value of the env file, or a token of any shape, reaches the phone. Reproduce: `fake.emit("job-state", { ..., to: "blocked", reason: "user: May I use <a value of host.secrets>?" })` on the fake host, as `decisions.test.ts` does, and read the `notice`.
- Suggestion: redact the question with `host.secrets` alone in the notice (`redact` would also cut job ids and commit hashes the owner needs to read, a product choice), or with the full rules; orchestration's line budget is full, so the import costs a line elsewhere. Out of AR0340: the notice never redacted anything, and the ticket names the redacting callers only.
- Status: open
