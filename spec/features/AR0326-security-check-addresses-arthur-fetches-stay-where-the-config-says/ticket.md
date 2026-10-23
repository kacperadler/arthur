# AR0326 - Security check: addresses Arthur fetches stay where the config says

```json
{
  "id": "AR0326",
  "title": "Security check: addresses Arthur fetches stay where the config says",
  "date": "2026-10-23"
}
```

## Description

One area of the security check of our own code before the switch (AR0307), as a checklist: for each rule, where the code enforces it and which test proves it. It changes no code; each gap becomes a finding, and `h merge` turns each into a fix ticket.

## Goal

- Kind: risk
- Model: anthropic/claude-fable-5-1 (the owner, 2026-10-23), no cost limit; its review stays on the reviewer's default model.

The rule this area must hold: Every URL Arthur fetches (uptime sites, model providers, GitHub, YouTrack) is checked: a model provider is never a public host or a cloud metadata address; a site check cannot be pointed at loopback or metadata services unless the config says so.

Earlier notes to verify first (from AR0311, not yet checked; confirm each in the code, mark it confirmed, already covered, or not reproduced): F18 (the models plugin's private network takes two cloud metadata addresses: `packages/models/src/model-options.ts:27-30`).

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
