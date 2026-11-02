# AR0590 - AR0589 T3: a job cannot read the shared home .arthur/ of other projects

```json
{
  "id": "AR0590",
  "title": "AR0589 T3: a job cannot read the shared home .arthur/ of other projects",
  "date": "2026-10-30"
}
```

## Description

Ticket 3 of the approved plan of AR0589 (`spec/features/AR0589-plan-each-project-keeps-all-its-plugin-settings-in-one-place-of-arthur-config-ts/plan.md`, approved in AR-D393, plan.md at 245bd882), its "Not available directly" item B. After AR0589's ticket 2 a job of one project cannot read another project's checkout, folder or job worktrees, but it can still read the shared home `.arthur/`: the event log mixes every project's events and the owner's messages, `arthur jobs` reads every record, and the CLI inside a job runs every plugin's setup, which reads that plugin's folder under the home (`packages/core/src/host.ts:62-70`).

## Goal

A job of shop1 reads nothing of shop2 under `.arthur/`: no other project's job records, events, owner messages or plugin state, while the in-job commands its role names still work.

- Kind: security

## Done means

- A test where a job of shop1, with a shop2 job record, events and plugin state in the home, gets Permission denied on each, while `arthur jobs`, the board, findings and `arthur ci` inside the job still answer for shop1.
- Each plugin's setup that runs inside a job is audited and named in the final message, with what it reads.
- The plan's line budget for this part, measured and named.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`, `packages/core/src/host.ts`, `packages/core/src/cli.ts`, the in-job setups the audit names, their tests, `docs/deploy.md` "Threat model".

Out:
- The config shape and the project folders: AR0589 tickets 1 and 2.

## Decisions

- 2026-10-30: Source: the approved plan of AR0589 (AR-D393)
