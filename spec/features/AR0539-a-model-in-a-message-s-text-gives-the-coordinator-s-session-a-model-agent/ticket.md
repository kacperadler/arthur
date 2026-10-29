# AR0539 - A `^<model>` in a message's text gives the coordinator's session a model agent

```json
{
  "id": "AR0539",
  "title": "A `^<model>` in a message's text gives the coordinator's session a model agent",
  "date": "2026-10-28"
}
```

## Description

F4 of AR0532 (spec/features/AR0532-a-job-final-message-naming-path-makes-the-coordinator-read-that-file-into-its/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/orchestration/src/hand-over.ts:14`; omp 18.3.0 `expandMentions` (`packages/tui/src/prompt/model-mention-syntax.ts`, pattern `/(^|\s)\^([^\s^]+)(?=\s|$)/g`)
- What: in the same prompt path as F1, omp replaces a `^<model selector>` after whitespace that names an available model with `<model agent="m<n>" name="<name>"/>` and adds that model to the session as an agent (`appendCustomEntry`), for any text not marked `synthetic`. So a job's message or a review could add a model agent to the coordinator's session; it reads no file. Read from the bundled source, not run.
- Suggestion: a word joiner before each such `^` in `handOver` (omp needs whitespace or the start of the text right before it), with its own test; left out here since the ticket is the file read.

## Goal

Text a job, a review or a channel message hands to the coordinator never adds a model agent to its session. Evidence: omp 18.3.0's prompt path replaces a caret followed by a model name after whitespace with a model agent (`expandMentions`, pattern `/(^|\s)\^([^\s^]+)(?=\s|$)/g`), and `packages/orchestration/src/hand-over.ts:14` escapes only the at-sign (F4 of AR0532).

- Kind: security

## Done means

- `handOver` puts a word joiner before each caret omp would read as a model mention; a test checks the handed-over text against omp's pattern and fails without the escape.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/hand-over.ts`, `packages/orchestration/test/inbox.test.ts`.

Out:
- The job side and the handoff (AR0537, AR0538).

## Decisions

- 2026-10-28: Source: F4 of AR0532
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
