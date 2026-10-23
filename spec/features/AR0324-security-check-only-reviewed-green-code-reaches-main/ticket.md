# AR0324 - Security check: only reviewed, green code reaches main

```json
{
  "id": "AR0324",
  "title": "Security check: only reviewed, green code reaches main",
  "date": "2026-10-23"
}
```

## Description

One area of the security check of our own code before the switch (AR0307), as a checklist: for each rule, where the code enforces it and which test proves it. It changes no code; each gap becomes a finding, and `h merge` turns each into a fix ticket.

## Goal

- Kind: security
- Model: anthropic/claude-fable-5-1 (the owner, 2026-10-23), no cost limit; its review stays on the reviewer's default model.

The rule this area must hold: Only a branch whose exact tip a review passed and whose CI passed reaches main; a review's PASS rests on what the coordinator wrote, small changes to what runs on the VPS are still reviewed.

Earlier notes to verify first (from AR0311, not yet checked; confirm each in the code, mark it confirmed, already covered, or not reproduced): F6 (a review spawn's `Commit:` line is taken as written: `packages/delivery/src/delivery.ts:52-58,109-125`, `packages/delivery/src/merge-command.ts:132-138`, `packages/delivery/src/review-needed.ts:37`), F11 (`review-needed` skips small changes to Arthur's own files: `packages/delivery/src/delivery-options.ts:16`, `packages/delivery/src/review-needed.ts:53-84`), F13 (`--auto` takes CI passed on an older commit: `packages/delivery/src/auto-merge.ts:56-68`).

## Done means

- `check.md` in this folder: a table, one row per rule of this area (the rule above split into its parts, plus any the code itself states): the rule, where the code enforces it (file:line), the test that proves it (file and test name, or none), and the verdict: holds, holds without a test, or gap.
- Each gap and each confirmed earlier note is a `findings.md` entry: Kind, severity (critical, high, medium, low), Where (file:line), the rule, the input the check does not cover in one sentence, and the fix with the test it needs. Written as a missing check, never as steps of an attack; no exploit code, no runs against the live VPS, the owner's bot, real secrets or a client repository.
- Nothing outside this ticket's folder changes; `npm test` and `npm run check` pass.

## Scope

In:
- Reading the code, tests and docs of this area.

Out:
- Fixes: each finding becomes its own ticket at the merge.
- The other areas, each its own ticket.

## Decisions

- 2026-10-23: The owner: the security audit as ten small checklist checks, one per area, with AR0311's notes as input, on Fable with no cost limit.
