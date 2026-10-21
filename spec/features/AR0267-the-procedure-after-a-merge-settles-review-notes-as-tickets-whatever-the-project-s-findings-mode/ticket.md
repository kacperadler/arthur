# AR0267 - The procedure after a merge settles review notes as tickets whatever the project's findings mode

```json
{
  "id": "AR0267",
  "title": "The procedure after a merge settles review notes as tickets whatever the project's findings mode",
  "date": "2026-10-21"
}
```

## Description

step 2 tells the coordinator to copy the reviews' non-blocking notes into `findings.md` and settle each as a planning ticket or `dropped`. In a project whose `findings.mode` is `summary` (a client's) those notes become board tickets anyway, and in a `grouped` project one ticket each, so the mode only governs the entries a worker wrote before the merge.

## Goal

The procedure after a merge settles review notes the way the project's findings mode says, not always as tickets.
- Kind: improvement

Evidence:
- `packages/delivery/roles/coordinator/after-merge.md:6`
- Found by: AR0263 worker (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: step 2 names the mode: settle the notes as the merge settled the open entries (its `- Tickets from findings:` or `- Deferred (client summary):` lines say which), one more line in delivery's procedure; the findings plugin itself unchanged.
- `npm test` and `npm run check` pass.

## Scope

In:
- step 2 names the mode: settle the notes as the merge settled the open entries (its `- Tickets from findings:` or `- Deferred (client summary):` lines say which), one more line in delivery's procedure; the findings plugin itself unchanged.

## Decisions

- 2026-10-21: Source: F1 of AR0263
- 2026-10-21: Approved by the owner (Telegram).
