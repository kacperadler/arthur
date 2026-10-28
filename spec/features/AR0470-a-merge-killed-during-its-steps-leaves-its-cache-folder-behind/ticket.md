# AR0470 - A merge killed during its steps leaves its cache folder behind

```json
{
  "id": "AR0470",
  "title": "A merge killed during its steps leaves its cache folder behind",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0454 (spec/features/AR0454-the-writable-package-caches-carry-branch-code-out-of-the-sandbox/findings.md).

- Kind: fix
- Found by: 2026-10-26-worker-b75a162b (worker), 2026-10-26
- Where: `packages/delivery/src/merge-command.ts` (`rmSync(cache, ...)` in `finally`)
- What: the merge's cache folder, `<delivery folder>/cache-<random>`, is removed in a `finally`, which a SIGKILL of `arthur merge` (or a crash of the machine) never reaches; the folder then stays, with whatever the branch's install wrote into it. No later merge reads it (each makes its own with `mkdtemp`), so it costs disk only [INFERENCE: from the code, not run].
- Suggestion: at the start of each merge, delivery removes the `cache-*` folders of its own folder older than a day (a younger one may be another merge's, running); out: reusing one.

## Goal

A merge killed during its steps leaves its `cache-*` folder, with what the branch's install wrote, in delivery's folder for good (finding above).

- Kind: fix

## Done means

- At each merge's start, delivery removes its own `cache-*` folders older than a day and keeps younger ones; a test in `packages/delivery/test/merge.test.ts` with an old and a young folder.

## Scope

In:
- `packages/delivery/src/merge-command.ts`, its test.

Out:
- Reusing a cache folder.

## Decisions

- 2026-10-27: Source: F2 of AR0454
- 2026-10-27: AR0470 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D133)
- 2026-10-28: AR0470 another round: the worker adds a test that the sweep keeps an old cache_ entry below the top level, then review round 3; the owner: "AR-D219 1 AR-D220 1" (AR-D220)
