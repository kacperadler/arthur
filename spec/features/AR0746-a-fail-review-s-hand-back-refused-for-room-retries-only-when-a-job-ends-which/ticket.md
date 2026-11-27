# AR0746 - A FAIL review's hand-back refused for room retries only when a job ends, which may never happen

```json
{
  "id": "AR0746",
  "title": "A FAIL review's hand-back refused for room retries only when a job ends, which may never happen",
  "date": "2026-11-27",
  "budget": 9.69
}
```

## Description

After a FAIL review, delivery hands the branch back to its worker; when that continue is refused for lack of room, delivery keeps the step and tries again only when some job ends. With no job running, nothing ever ends, so the branch is never continued. After this change resources emits an event when it says a machine has room again, and delivery runs its kept steps on it as it does on a job's end.

## Goal

When nothing else is running, a branch that failed review is never continued or reviewed again on its own. The coordinator gets a message that does not mention the hand-back and is left to guess.

Evidence (audit 2026-11-27, F3 of AR0735):

- `packages/delivery/src/hand-back.ts:9,68-71`: a refusal by another plugin (resources' `no room on <machine>`) keeps the step "for the next `job-ended`". `ended()` is the only retry after `start`.
- `packages/resources/src/room.ts:88-95`: once room is back, resources only sends the coordinator a text, "start what waits for it". It emits no event, and nothing in `packages/delivery/src` listens for it.
- AR0735 was made because a spawn refused for CPU "waits for a job end that may never free room". The hand-back still has that problem.

- Kind: fix

## Done means

1. A new test in `packages/delivery/test/hand-back.test.ts` refuses a hand-back's continue for room, ends no job, emits the room event on the fake host, and asserts the continue then starts; it fails on main today.
2. `packages/resources/src/room.ts` emits that event at the same moment it sends the coordinator its room message, once per message.
3. A kept step already run on a `job-ended` is not run a second time by the room event.
4. `npm test` and `npm run check` pass.

## Scope

In:
- `packages/resources/src/room.ts`: emit an event when it tells the coordinator a machine has room again.
- `packages/delivery/src/hand-back.ts`: run the kept steps on that event, as on `job-ended`.
- `packages/delivery/test/hand-back.test.ts`: the tests of Done means 1 and 3.

Out:
- Telling a project agent that room is back: F1 of AR0735.
- Placement across machines: F2 of AR0735.

## Decisions

- 2026-11-27: Source: audit spec/quality/2026-11-27.md
- 2026-11-27: Source: F3 of AR0735
