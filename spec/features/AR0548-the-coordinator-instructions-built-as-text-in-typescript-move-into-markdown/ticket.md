# AR0548 - The coordinator instructions built as text in TypeScript move into Markdown procedures

```json
{
  "id": "AR0548",
  "title": "The coordinator instructions built as text in TypeScript move into Markdown procedures",
  "date": "2026-10-28"
}
```

## Description

The fixed wording of the instructions Arthur sends the coordinator in a few messages moves from TypeScript strings into Markdown procedures, so the retro reads them and a project can override them; the live details (ids, branches, runs) are still filled in by the code. The owner asked for it (AR-D250).

## Goal

A few messages that instruct the coordinator keep their fixed wording as text in TypeScript, so the retro, which reads the role files and procedures under each package's `roles/`, never sees them, and a project cannot override them:
- the handoff request before a compaction or a restart (`packages/session/src/handoff-extension.ts`);
- the `Why:` line of a failed CI run (`packages/github/src/github.ts`);
- the hand-back line of a FAIL review (`packages/delivery/src/delivery.ts`);
- the reminder when a reply was not sent (`AGAIN`, `packages/orchestration/src/inbox-extension.ts`).

- Kind: refactor

## Done means

- The fixed wording of each message above lives in a Markdown file under its package's `roles/coordinator/`, with named placeholders for the live parts; the code fills them in and sends the same text as today, word for word.
- A test per message compares the sent text with today's text for one set of live values.
- The prompt loader's override path covers these files as it covers the other procedures, and the retro's list of role files includes them.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/session/src/handoff-extension.ts`, `packages/github/src/github.ts`, `packages/delivery/src/delivery.ts`, `packages/orchestration/src/inbox-extension.ts`, and a new Markdown file per message under each package's `roles/coordinator/`.
- Their tests.

Out:
- Short notices that are only live data (a job's end, a CI result line): they stay in the code.
- A root AGENTS.md and new roles: AR0549.

## Decisions
- 2026-10-28: AR0548 approved, after AR0539; the owner: "AR-D250 2" (AR-D253)

