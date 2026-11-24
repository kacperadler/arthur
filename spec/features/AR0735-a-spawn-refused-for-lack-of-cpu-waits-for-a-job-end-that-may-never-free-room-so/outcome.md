# AR0735 - Outcome

- Merged: 2026-11-24, `19a44ba4`
- Branch: arthur/2026-11-24-worker-32983572
- Reviews: review-1.md PASS
- Cost: worker $5.39, reviews $0.83; review rounds 1

## What went in

- packages/resources/src/room.ts: records a refusal for room once per machine as `machines/<name>.refused` and `room-refused`; the check of `local` and each machines round emit one `coordinator-message` when that machine has room again; the refusal says the coordinator is told.
- packages/resources/docs/resources.md: the new refusal wording and a "Room again" bullet describing the record, the message and when it is sent.
- packages/resources/test/room.test.ts: two new tests for the record and the message, a no-message assertion in the start test, and the new refusal wording.
- packages/resources/test/disk.test.ts: the new refusal wording.
- test/room-placement.test.ts: the new refusal wording.
- test/structure.test.ts: the resources line budget is 661, up from 638.
- spec/roadmap.md: entry 34's Done means names the `room-refused` record and the message to the coordinator (AR0735).
- spec/features/AR0735-a-spawn-refused-for-lack-of-cpu-waits-for-a-job-end-that-may-never-free-room-so/findings.md: new; F1 to F4, open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1855/1926 passed.

## Left open

- Deferred (client summary): F1. A project agent whose spawn was refused for room is not the one told when the room is back
- Deferred (client summary): F2. A placed spawn refused for room waits for the machine placement picked, though another may get room first
- Deferred (client summary): F3. Delivery's hand-back refused for room still waits for a job's end
- Deferred (client summary): F4. The vision's interface line for resources names neither `room-refused` nor the message on room
