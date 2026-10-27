# AR0467 - A merge check that runs git inside an owner clone in the checkout deletes that clone history

```json
{
  "id": "AR0467",
  "title": "A merge check that runs git inside an owner clone in the checkout deletes that clone history",
  "date": "2026-10-26"
}
```

## Description

Since AR0463, after each step of `arthur merge` every `.git` a step made or changed is removed (AR-D101). A check that only runs git inside one of the owner's own clones in main's checkout refreshes its `index`, so that clone's `.git` is removed, its history with it. The owner should not lose a clone's history to a test that read it.

## Goal

Source: note 6 of AR0463's review-2 and the worker's final message: `packages/delivery/src/merge-checks.ts` (`stamp`) compares the inode and change time of every entry inside a `.git`, so an `index` refresh counts as a change. Find a rule that still removes a planted fsmonitor or hook (config, hooks, a new `.git`) but keeps a clone whose only change is its index or other files git itself rewrites on a read, or moves such a `.git` aside instead of deleting it.

- Kind: fix

## Done means

- A merge step that runs `git status` in an owner's clone keeps that clone and its history; a step that writes `core.fsmonitor` or a hook there still has it removed or made harmless; tests for both in `packages/delivery/test/merge-checks.test.ts`.

## Scope

In:
- `packages/delivery/src/merge-checks.ts`, its test, `packages/delivery/docs/commands/merge.md`.

Out:
- A repository under another name or a symlink to one: AR0466.

## Decisions

- 2026-10-27: Source: F3 of AR0463
- 2026-10-27: AR0467 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D124)
- 2026-10-27: AR0467: delivery line budget 1552 -> 1557; the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D144)
