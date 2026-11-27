# AR0736 - arthur silent --help says every held reply goes to the coordinator outbox

```json
{
  "id": "AR0736",
  "title": "arthur silent --help says every held reply goes to the coordinator outbox",
  "date": "2026-11-24"
}
```

## Description

The help page of `arthur silent` says a held reply goes to the coordinator's `outbox/held/` folder, but a project agent's held reply goes to that agent's own folder. Someone looking for a held agent reply would look in the wrong place. This fixes the one sentence.

## Goal

The help names each session's own held folder.

Evidence (audit `spec/quality/2026-11-24.md`, proposal 3):
- `packages/orchestration/docs/commands/silent.md:32`: "`arthur run` moves it to `<home>/orchestration/outbox/held/` instead of sending it".
- `packages/orchestration/src/inbox.ts:170-180`: `sweep` moves each session's reply into its own `outbox/held`; for a project agent that is `<home>/orchestration/agents/<project>/outbox/held/`.
- AR0713's `review-2.md` noted the same drift.

- Kind: docs

## Done means

- `silent.md:32` names the coordinator's `<home>/orchestration/outbox/held/` and a project agent's `<home>/orchestration/agents/<project>/outbox/held/`.
- No other doc says every held reply goes to the coordinator's folder (a search for `outbox/held` finds none that does).
- The project's checks pass.

## Scope

In:
- `packages/orchestration/docs/commands/silent.md`: that sentence.

Out:
- Any code change.

## Decisions

- 2026-11-24: Source: audit spec/quality/2026-11-24.md
- 2026-11-24: Pre-approved by policy: docs from audit spec/quality/2026-11-24.md, 1 Scope file, budget $1 of the $3 cap
- 2026-11-24: AR0736 budget raised from $1 to $3; it commits its edit and runs the checks; the owner: "AR-D716 1, AR-D717 1, another project's decision 1, another project's decision 1, AR-D718 1, AR-D719 1, AR-D720 1, another project's decision 1, another project's decision 1, another project's decision 2, another project's decision 2" (AR-D718)
- 2026-11-24: The owner approved AR0736's budget of $3; it commits its edit and runs the checks; the owner: "AR-D723 1, AR-D724 1" (AR-D724)
