# AR0427 - A blocked job's notice sends its question unredacted

```json
{
  "id": "AR0427",
  "title": "A blocked job's notice sends its question unredacted",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0340 (spec/features/AR0340-the-redaction-of-notices-and-the-decision-log-reads-secrets-from-an-environment-that-holds-none-of-the-env-file/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-f639b3da (worker), 2026-10-25
- Where: `packages/orchestration/src/blocked-notice.ts:44`
- What: the notice `<job> asks [<id>]: <question>` carries the job's question as the job wrote it, while the decision log holds the same question redacted (`decision-hooks.ts:27`, `decision-log.ts:170`). A job question holding a value of the env file, or a token of any shape, reaches the phone. Reproduce: `fake.emit("job-state", { ..., to: "blocked", reason: "user: May I use <a value of host.secrets>?" })` on the fake host, as `decisions.test.ts` does, and read the `notice`.
- Suggestion: redact the question with `host.secrets` alone in the notice (`redact` would also cut job ids and commit hashes the owner needs to read, a product choice), or with the full rules; orchestration's line budget is full, so the import costs a line elsewhere. Out of AR0340: the notice never redacted anything, and the ticket names the redacting callers only.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0340
