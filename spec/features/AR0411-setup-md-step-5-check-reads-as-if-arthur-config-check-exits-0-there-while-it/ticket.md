# AR0411 - setup.md step 5 check reads as if `arthur config check` exits 0 there, while it exits 1 until step 6

```json
{
  "id": "AR0411",
  "title": "setup.md step 5 check reads as if `arthur config check` exits 0 there, while it exits 1 until step 6",
  "date": "2026-10-25"
}
```

## Description

F4 of AR0307 (spec/features/AR0307-the-switch-arthur-runs-on-the-vps-and-takes-its-own-tickets/findings.md): step 5's Check says `arthur config check` "refuses nothing", while at that step it exits 1, since the variable step 6 sets is still missing.

## Goal

The Check of docs/setup.md step 5 (line 110) says what `arthur config check` prints and its exit code at that step, so a reader does not take exit 1 for a broken config. Evidence: the first review of AR0307 (2026-10-25-review-fce9638a, pruned) saw it exit 1 there.

- Kind: docs

## Done means

- docs/setup.md step 5's Check says it exits 1 with the one variable `missing` until step 6; the project's checks pass.

## Scope

In:
- `docs/setup.md`: step 5's Check.

Out:
- Changing `arthur config check`'s exit code.

## Decisions

- 2026-10-25: Source: F4 of AR0307
- 2026-10-25: AR0411 approved by the owner; worker starts in turn; the owner: "ok, go with AR0407 now, and i approve the AR0408–AR0411 tasks, you can go to a 60% usage so when you complete this tasks take another one, always go with your recommendations and do not ask me about them, go to 60% usage and complete as many tasks as you can" (AR-D10)
