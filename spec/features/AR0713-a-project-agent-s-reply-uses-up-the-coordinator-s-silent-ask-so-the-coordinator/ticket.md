# AR0713 - A project agent's reply uses up the coordinator's silent ask, so the coordinator's decision question is held and never sent

```json
{
  "id": "AR0713",
  "title": "A project agent's reply uses up the coordinator's silent ask, so the coordinator's decision question is held and never sent",
  "date": "2026-11-17",
  "budget": 4
}
```

## Description

While silent mode is on, `arthur silent ask` lets one reply through so a decision reaches the owner. The ask is one shared file for every session, so the first reply from any session after it, a project agent's job-end reply included, uses it up: that reply goes out, and the coordinator's decision question is held. After this, each ask belongs to the session that ran it, and a project agent's role tells it to use `arthur silent ask` for a decision.

## Goal

Silent mode has one rule it must keep: a decision always reaches the owner. Now that project agents exist, a busy project can quietly swallow the coordinator's merge or plan question.

Evidence (audit 2026-11-17):
- `packages/orchestration/src/silent.ts:113`: `arthur silent ask` writes one shared `silent-ask` time into orchestration's own folder, whichever session runs it.
- `packages/orchestration/src/inbox.ts:175`: `sweep` checks each session's outbox, project agents included, against that one file (`held(host.folder, name)`). The first reply from any session written after the ask removes the file (`silent.ts:94-99`).
- A throwaway script with `fakeHost` and `inbox()`: silent on, an ask at 1000, then shop's agent's reply to a job's end (`1500-000001.json`) swept, then the coordinator's question (`2000-000001.json`). Output: `replied: ["Shop: the job ended."]`, `coordinator held: [ '2000-000001.json' ]`, `ask left: false`.
- `packages/orchestration/roles/project.md` never mentions silent mode or `arthur silent ask`.

- Kind: fix

## Done means

- An `arthur silent ask` run in one session lets through only that session's next reply; another session's reply written after it is still held while silent is on.
- A test in `packages/orchestration/test/` sweeps a project agent's reply and then the coordinator's question after one coordinator ask: the agent's reply is held and the question is sent. It fails before the change.
- `packages/orchestration/roles/project.md` tells the agent to run `arthur silent ask` in a turn that asks the owner for a decision while silent is on.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/silent.ts`: the ask is kept per session (for example a `silent-ask` file in each session's folder).
- `packages/orchestration/src/inbox.ts`: `sweep` reads the ask of the session whose outbox it sweeps.
- `packages/orchestration/roles/project.md`: one line on `arthur silent ask` for a decision.
- The test of the race in `packages/orchestration/test/`.

Out:
- The global on/off switch and the grants, which stay as they are.

## Decisions

- 2026-11-17: Source: audit spec/quality/2026-11-17.md
- 2026-11-23: AR0713 approved: a silent-mode pass belongs to the session that asked for it, budget $10; the owner: "another project's decision another project's decision AR-D703 AR-D704 AR-D705 AR-D706 AR-D707 another project's decision yes" (AR-D703)
- 2026-11-23: AR0713 budget raised from $10 to $15; it commits its staged merge, reruns the checks and merges; the owner: "AR-D714 1" (AR-D714)
