# AR0175 - A `/restart` whose restart throws in the tick tells the owner nothing

```json
{
  "id": "AR0175",
  "title": "A `/restart` whose restart throws in the tick tells the owner nothing",
  "date": "2026-10-19"
}
```

## Description

`/restart` with a coordinator running answers `...; Restarted. follows` and leaves the request for the tick. When the tick's `restart()` then throws (`restarted.json` cannot be written, or `coordinator.restart` throws), `settle` has already removed `request.json`, so after AR0148 the only trace is `session: restart failed: <first line>` in `arthur run`'s log, printed once per distinct error: no notice reaches the channel, `Restarted.` never comes, and a second `/restart` that fails the same way prints nothing new. Seen by reading the lines; not reproduced through a channel [INFERENCE].

## Goal

When a `/restart` fails inside the session's tick, the owner is told on his channel, instead of only a line in the log he does not see.

- Kind: bug

Evidence:
- `packages/session/src/restart.ts:93-106` (`settle`), `packages/session/src/restart.ts:22-25` (`restart`)
- Found by: 2026-10-19-ar0148-daa7de8b (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: when `restart()` throws for a `/restart` (not the night's fresh start), emit a `notice` `restart: not done: <first line>` before rethrowing, so the owner who asked hears it; the night's fresh start stays as it is (logged, the next night tries again).
- `npm test` and `npm run check` pass.

## Scope

In:
- when `restart()` throws for a `/restart` (not the night's fresh start), emit a `notice` `restart: not done: <first line>` before rethrowing, so the owner who asked hears it; the night's fresh start stays as it is (logged, the next night tries again).

## Decisions

- 2026-10-19: Source: F1 of AR0148
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
