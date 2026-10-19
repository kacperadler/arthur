# AR0149 - The free-resources check runs on its own 60 s timer, not at each machines check

```json
{
  "id": "AR0149",
  "title": "The free-resources check runs on its own 60 s timer, not at each machines check",
  "date": "2026-10-18"
}
```

## Description

entry 34 says free CPU and memory are read "at every machine check". The machines plugin emits an event only when a machine's state changes, and the resources plugin may not import it, so resources checks every machine itself at the start of `arthur run` and every 60 s (the default of `machines`' `check.everySeconds`), and again on demand when a check is 2 minutes old. A `check.everySeconds` other than 60 makes two cadences, two ssh calls per machine per round.

## Goal

The free-resources reading follows each machine check, so placement never uses a reading older than the machines plugin's own.

- Kind: improvement

Evidence:
- `packages/resources/src/room.ts` (`CHECK_SECONDS`), `packages/machines/src/machines.ts` (`round`)
- Found by: 2026-10-18-ar0142-29f3b669 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: one host-level hook per round (for example `collect("machines.checked", name)` from the machines plugin's round, or the round's command extended with the `node -e` numbers), so one ssh call per machine and round serves both; out: any change to how room is computed.
- `npm test` and `npm run check` pass.

## Scope

In:
- one host-level hook per round (for example `collect("machines.checked", name)` from the machines plugin's round, or the round's command extended with the `node -e` numbers), so one ssh call per machine and round serves both; out: any change to how room is computed.

## Decisions

- 2026-10-18: Source: F1 of AR0142
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
- 2026-10-19: Left out of the resources batch: carrying the numbers in the machines check changes two plugins' protocol. Built with the next roadmap entry that changes machines or resources.
- 2026-10-19: The owner: close what is open today; built now with AR0217.
