# AR0453 - A test's sandboxed job walks the whole temporary folder to hide its env file

```json
{
  "id": "AR0453",
  "title": "A test's sandboxed job walks the whole temporary folder to hide its env file",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0443 (spec/features/AR0443-a-job-s-scope-marks-it-only-for-a-home-that-holds-its-record-so-a-config-of-the/findings.md).

- Kind: perf
- Found by: 2026-10-26-worker-1bf07670 (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts:37` (the walk), `packages/core/src/testing.ts:133` and the tests' `jobRunner(home, root, join(root, "env"), ...)`
- What: a test's env file lies under `/tmp`, so every sandboxed job of a test grants a read rule on each entry of `/tmp`, about 31800 on this host (`python3` listing of `/tmp`). Measured with `sandboxed(["/tmp/ar0443-probe"], hidden, "true", ...)`: probe 356 ms and run 346 ms with a hidden file under `/tmp`, against 23 and 21 ms with none or one under `/var/lib`. The probe and the start each pay it, so each job run of a test costs about 0.7 s more; the real env file (`~/.config/arthur/.env`) walks a few dozen entries.
- Suggestion: let the probe check the sandbox without the walk (it only finds the agent), or have the test kit put its jobs' env file in a folder with few entries above it, such as a temporary folder made outside `/tmp`'s crowded level. Out: dropping the walk, which is the bound.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: perf

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F1 of AR0443
