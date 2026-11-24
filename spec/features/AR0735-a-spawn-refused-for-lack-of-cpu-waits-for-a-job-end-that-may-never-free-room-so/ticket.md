# AR0735 - A spawn refused for lack of CPU waits for a job end that may never free room, so the coordinator schedules retries by hand

```json
{
  "id": "AR0735",
  "title": "A spawn refused for lack of CPU waits for a job end that may never free room, so the coordinator schedules retries by hand",
  "date": "2026-11-24",
  "budget": 3
}
```

## Description

When a spawn or continue is refused because a machine is short of CPU, nothing tells the coordinator when the room comes back, so it adds one-off schedule entries by hand to try again. With this change the resources plugin records the refusal once and, on the first machine check that finds room again, wakes the coordinator with a message naming the machine and how many jobs fit.

## Goal

The coordinator learns when a machine that refused a job has room again, without polling.

Evidence (audit `spec/quality/2026-11-24.md`, proposal 2):
- `packages/resources/src/room.ts:96` refuses with `…; spawn again once a job ends`; `packages/resources/docs/resources.md:44` says the coordinator spawns again when a job ends. Nothing wakes it when CPU frees.
- On 2026-11-23 the coordinator committed five one-off retry entries (4beb74e2, e67f3bb7, 72d960d3, 463d213a, c9f8f6c2).
- `refused by resources: no room on local` appears 60 times in that day's coordinator log, each time short of cores.
- `packages/core/src/spawn-check.ts:23` throws the refusal and emits no event.

- Kind: feat

## Done means

- A spawn or continue refused for room on a machine is recorded once (an event `arthur run` sees from the CLI process); repeated refusals before room returns record nothing new.
- On the first machine round after that where the machine has room, one `coordinator-message` names the machine and how many jobs it has room for; no second message until a new refusal.
- `resources.md` and the refusal's wording describe this.
- Tests: the message after room returns, none while still short, one per refusal episode, and none for a refusal on disk or memory if those are kept apart. Each fails without the change.
- The project's checks pass.

## Scope

In:
- `packages/resources/src/`: the record of a refusal and the message on room.
- `packages/resources/docs/resources.md`.
- Tests in `packages/resources/test/`.

Out:
- A spawn queue, automatic spawning, and any change to how room is measured.

## Decisions

- 2026-11-24: Source: audit spec/quality/2026-11-24.md
- 2026-11-24: AR0735 approved: resources wakes the coordinator when a machine that refused a job has room again, budget $3; the owner: "AR-D716 1, AR-D717 1, PG-D184 1, PG-D182 1, AR-D718 1, AR-D719 1, AR-D720 1, PG-D183 1, ZF-D95 1, ZF-D107 2, ZF-D72 2" (AR-D720)
