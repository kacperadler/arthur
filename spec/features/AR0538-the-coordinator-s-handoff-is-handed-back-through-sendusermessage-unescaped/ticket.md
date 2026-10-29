# AR0538 - The coordinator's handoff is handed back through `sendUserMessage` unescaped

```json
{
  "id": "AR0538",
  "title": "The coordinator's handoff is handed back through `sendUserMessage` unescaped",
  "date": "2026-10-28"
}
```

## Description

F3 of AR0532 (spec/features/AR0532-a-job-final-message-naming-path-makes-the-coordinator-read-that-file-into-its/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/session/src/handoff-extension.ts:64`
- What: after a restart or compaction the session plugin quotes the coordinator's handoff file and sends it with `pi.sendUserMessage(..., { attribution: "agent" })`, the path F1 describes. A handoff that copies an `@<path>` from a message it summed up (the inbox now hands it `\u2060@`, which a model may still write back as a plain `@`) makes omp read that file into the next session.
- Suggestion: put the word joiner before each such `@` of the quoted lines there too, with a test through the extension; out of this ticket's Scope (the session plugin).

## Goal

The coordinator's handoff, handed back after a restart or a compaction, never makes omp read a file. Evidence: `packages/session/src/handoff-extension.ts:64` sends the handoff's lines with `pi.sendUserMessage` unescaped, the path AR0532 escaped for the inbox (F3 of AR0532).

- Kind: security

## Done means

- Each at-sign omp would expand in the quoted handoff gets a word joiner, as in `hand-over.ts`; a test through the extension checks the exact text sent and fails without the escape.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/session/src/handoff-extension.ts`, its test in `packages/session/test/`.

Out:
- The inbox (AR0532) and a job's task and continue (AR0537).

## Decisions

- 2026-10-28: Source: F3 of AR0532
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
