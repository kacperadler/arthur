# AR0036 - The lock's dead-holder takeover race has no test

```json
{
  "id": "AR0036",
  "title": "The lock's dead-holder takeover race has no test",
  "date": "2026-10-16"
}
```

## Description

Two or three sentences: what changes, and for whom.

## Goal

The board lock (entry 17) can rely on the lock: concurrent takers of a dead holder's lock and a stuck takeover guard are pinned by a test of real processes.

- Kind: bug | risk | cleanup | improvement

## Done means

- Observable result, and the test that proves it.
- `npm test` and `npm run check` pass.

## Scope

In:
- `path/to/file.ts`: what changes there.

Out:
- What this ticket does not do, and which ticket does.

## Decisions

- 2026-10-16: Source: F2 of AR0008
