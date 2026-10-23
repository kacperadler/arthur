# AR0206 - Roadmap 46: YouTrack comments, attachments, and the rules for jobs

```json
{
  "id": "AR0206",
  "title": "Roadmap 46: YouTrack comments, attachments, and the rules for jobs",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 46 in `spec/roadmap.md`, the last youtrack entry, and with it the finding tickets AR0204 and AR0205, which touch the same files.

## Goal

The specification is roadmap entry 46: its Delivers and Done means with every edge case, plus the Goals of AR0204 and AR0205.

- Kind: feat
- Budget: 12

## Done means

- Everything that entry 46's Delivers and Done means list, each refusal and edge case in its own test.
- AR0204: `issue update` refuses a description changed since it was read, with a test.
- AR0205: the coordinator's role says when it may write to YouTrack.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time, and use only loopback ports chosen by the OS.
- README's table and `arthur.mmd` show 46 as built.
- `npm test` and `npm run check` pass, and the work is committed. The coordinator pushes the branch.

## Scope

In:
- `packages/youtrack`, its docs and tests;
- orchestration's coordinator role, for AR0205;
- README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out: the core and every other plugin.

## Decisions

- 2026-10-19: The coordinator starts this under the owner's 85% usage ceiling, with findings built alongside, as the owner said.
- 2026-10-19: The coordinator accepts every job of a YouTrack project getting the job rules, and a job's YouTrack write refused through ARTHUR_JOB (3 lines in youtrack-command.ts). The coordinator writes to YouTrack only when the owner asks, until the owner says otherwise.
