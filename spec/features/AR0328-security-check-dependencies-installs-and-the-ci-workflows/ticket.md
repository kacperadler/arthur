# AR0328 - Security check: dependencies, installs and the CI workflows

```json
{
  "id": "AR0328",
  "title": "Security check: dependencies, installs and the CI workflows",
  "date": "2026-10-23"
}
```

## Description

One area of the security check of our own code before the switch (AR0307), as a checklist: for each rule, where the code enforces it and which test proves it. It changes no code; each gap becomes a finding, and `h merge` turns each into a fix ticket.

## Goal

- Kind: security
- Model: anthropic/claude-fable-5-1 (the owner, 2026-10-23), no cost limit; its review stays on the reviewer's default model.

The rule this area must hold: Installs and merge checks run with the least they need (scope, install scripts); the CI workflows set the token's permissions and pin actions; `package-lock.json` is what `npm ci` installs.

Earlier notes to verify first (from AR0311, not yet checked; confirm each in the code, mark it confirmed, already covered, or not reproduced): F14 (installs and merge checks run outside every job scope, with install scripts on: `packages/projects/src/install.ts:36-37`, `packages/delivery/src/merge-checks.ts:46-63`), F16 (no `permissions:` and actions pinned by tag: `.github/workflows/ci.yml:1-12`, `.github/workflows/site.yml:9-25`).

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
