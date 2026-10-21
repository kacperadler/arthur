# AR0271 - Two processes checking one machine at once can both say the same news

```json
{
  "id": "AR0271",
  "title": "Two processes checking one machine at once can both say the same news",
  "date": "2026-10-21"
}
```

## Description

whether a failure `notice` or a `disk-low` is new is read from the check kept in `.arthur/resources/machines/<name>.json` before this check writes its own. `arthur run`'s check and an `arthur spawn` in another process that check the same machine at the same moment both read the earlier check, so both can emit `disk-low` and its notice for one fall (and both the failure notice, as since entry 34). [INFERENCE: from the lines; not reproduced.]

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/resources/src/machine-free.ts` (`checkSample`)
- Found by: 2026-10-21-ar0262-roadmap-69-disk-f-82a16dc2 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: decide and write the transition under a lock per machine file (the core's `withLock`), so only one writer sees the old state. Out: the cadence of the checks.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide and write the transition under a lock per machine file (the core's `withLock`), so only one writer sees the old state. Out: the cadence of the checks.

## Decisions

- 2026-10-21: Source: F3 of AR0262
