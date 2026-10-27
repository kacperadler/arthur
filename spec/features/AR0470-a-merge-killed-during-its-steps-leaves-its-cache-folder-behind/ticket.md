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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: fix

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F2 of AR0454
