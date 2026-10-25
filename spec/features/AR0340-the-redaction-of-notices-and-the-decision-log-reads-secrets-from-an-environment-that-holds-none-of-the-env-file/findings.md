# AR0340 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A blocked job's notice sends its question unredacted

- Kind: security
- Found by: 2026-10-25-worker-f639b3da (worker), 2026-10-25
- Where: `packages/orchestration/src/blocked-notice.ts:44`
- What: the notice `<job> asks [<id>]: <question>` carries the job's question as the job wrote it, while the decision log holds the same question redacted (`decision-hooks.ts:27`, `decision-log.ts:170`). A job question holding a value of the env file, or a token of any shape, reaches the phone. Reproduce: `fake.emit("job-state", { ..., to: "blocked", reason: "user: May I use <a value of host.secrets>?" })` on the fake host, as `decisions.test.ts` does, and read the `notice`.
- Suggestion: redact the question with `host.secrets` alone in the notice (`redact` would also cut job ids and commit hashes the owner needs to read, a product choice), or with the full rules; orchestration's line budget is full, so the import costs a line elsewhere. Out of AR0340: the notice never redacted anything, and the ticket names the redacting callers only.
- Status: ticket AR0341 (AR0427 was a duplicate of it, dropped)

## F2. Redaction runs twice on two paths, so part of an env-file secret can leak

- Kind: security
- Found by: 2026-10-25-review-3c2d06da (reviewer, non-blocking note), 2026-10-25
- Where: `packages/orchestration/src/inbox-extension.ts:116`, `packages/session/src/turn-extension.ts:44`
- What: the first pass with `[]` rewrites part of the secret; the second cannot match it whole.
- Status: ticket AR0428

## F3. `decision-class.ts:42` has no test with a value from the env file

- Kind: test
- Found by: 2026-10-25-review-ed206968, 2026-10-25-review-3c2d06da (reviewer, non-blocking notes), 2026-10-25
- Where: `packages/orchestration/src/decision-class.ts:42`
- What: `propose` back to `redact(…, [])` breaks no test.
- Status: dropped (close to unreachable: `propose` reads its texts from the already redacted log, and the reviewer saw a raw secret refused)

## F4. The `secrets` array is shared between plugins

- Kind: security
- Found by: 2026-10-25-review-3c2d06da (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/host.ts:42`
- What: `readonly` is compile-time only; a plugin could change what others redact.
- Status: dropped (plugins are the owner's own packages, reviewed like code; the core's line budget is full)

## F5. Unredacted copies stay in `turn-failed/` and `outbox/sent/`

- Kind: security
- Found by: 2026-10-25-review-ed206968 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/session/src/turn-extension.ts:44`, `packages/orchestration/src/inbox-extension.ts:116`
- What: raw text in the home folder (0700).
- Status: ticket AR0428

## F6. JSON-escaped, URL-encoded or base64 values are not matched

- Kind: security
- Found by: 2026-10-25-review-ed206968 (reviewer, non-blocking note), 2026-10-25
- Where: the redaction
- What: exact-value matching only; not introduced here.
- Status: dropped (how redaction works; a wider matcher is a design choice for the owner)

## F7. The inbox now redacts the "could not hand" notice too

- Kind: fix
- Found by: 2026-10-25-review-ed206968 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/orchestration/src/inbox.ts:182`
- What: a protective side change, unexplained by the worker.
- Status: dropped (protective; nothing to do)
