# AR0611 - The audit sees deferred findings, not only open ones, in a project whose findings mode is summary

```json
{
  "id": "AR0611",
  "title": "The audit sees deferred findings, not only open ones, in a project whose findings mode is summary",
  "date": "2026-11-03",
  "budget": 3
}
```

## Description

The nightly audit's prompt gets a new `### Deferred findings` section: every finding settled `deferred (client summary)` on a ticket merged since the last audited commit, one line each. In a project whose findings mode is `summary`, such as Arthur itself, security findings that workers and reviewers raise then reach the audit, which can propose them as tickets, instead of waiting for a client summary nobody reads.

## Goal

In `summary` mode, every open finding becomes `deferred (client summary)` at the merge, so the audit's "Open findings" is always `none` and the one nightly job meant to pick findings up never sees them.

- Kind: fix

Evidence:
- `packages/manage/src/audit.ts:52-63,80`: the audit's prompt lists only entries whose status is exactly `- Status: open`.
- `packages/findings/docs/findings.md:18`: in `summary` mode, the merge turns every open entry into `deferred (client summary)`.
- The auditor parsed the `findings.md` of the 47 tickets merged since the last audit: 104 entries, 0 open, 99 deferred (17 security, 5 risk, 24 fix). Its prompt said `### Open findings` = `none`.
- `packages/manage/roles/auditor.md:10` calls open findings "the best lead you have"; `docs/manage.md:64` documents the section.
- Deferred security findings were rescued into tickets by hand (AR-D395: AR0572 F1 became AR0591; AR0597 came from AR0593 F1). Still deferred with no ticket: AR0392 F1 to F3, AR0395 F1.
- The owner asked for findings not to become tickets by themselves (AR-D233), but for real risks to be ticketed (AR-D53). The audit, capped at 5 proposals, is where both hold.

## Done means

- The audit's prompt has a `### Deferred findings` section listing every `deferred (client summary)` entry of a ticket merged since the last audited commit (the window `stats` uses), each line with its ticket, number, kind, title and Where; `none` when there is none.
- A test in `packages/manage/test/audit.test.ts` with a deferred entry in that window and one before it fails if the section is removed or the window ignored.
- `packages/manage/roles/auditor.md` and `docs/manage.md` describe the section.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/manage/src/audit.ts`: the new section.
- `packages/manage/roles/auditor.md`, `docs/manage.md`: the section described.
- `packages/manage/test/audit.test.ts`.

Out:
- Changing the findings modes, or settling entries automatically.

## Decisions

- 2026-11-03: Source: audit spec/quality/2026-11-03.md
- 2026-11-03: AR0611 approved: the audit also sees findings set aside for later (deferred); after Group 2; the owner: "audit should see findings that were set aside for later" (AR-D466)
- 2026-11-04: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
