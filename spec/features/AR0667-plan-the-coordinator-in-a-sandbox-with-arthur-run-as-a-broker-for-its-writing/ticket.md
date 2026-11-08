# AR0667 - Plan: the coordinator in a sandbox, with arthur run as a broker for its writing commands

```json
{
  "id": "AR0667",
  "title": "Plan: the coordinator in a sandbox, with arthur run as a broker for its writing commands",
  "date": "2026-11-08"
}
```

## Description

Option 3 of the AR0483 plan: the coordinator runs inside the job sandbox, and the `arthur` commands that write outside it are run by `arthur run` on its behalf, so steering by outside text can no longer push, move main, edit the config or read SSH keys.

## Goal

The approved AR0483 plan (spec/features/AR0483-the-coordinator-the-agent-that-reads-the-most-outside-text-runs-with-no-sandbox/plan.md at 380bf9ad, Option 3, steps a to e), after AR0664. Plan: yes. The plan job splits it into tickets and answers the plan's open questions with the owner: whether turning a plugin on becomes a command so the coordinator never writes `arthur.config.ts` (which `packages/core/src/config.ts:56` imports as code), and what the coordinator does on a host where the sandbox cannot be set up.
- Plan: yes

- Kind: security

## Done means

- `plan.md` in this folder: the follow-up tickets for steps (a) config changes by command, (b) board commits by command, (c) the broker in `arthur run`, (d) `supervise` through the job sandbox, (e) docs, each with its files, order and cost; the plan's open questions put to the owner.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- Building the steps: follow-up tickets after the owner approves the plan.
- Option 2 (a guard mode for the coordinator): not built, per the AR0483 plan.

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
