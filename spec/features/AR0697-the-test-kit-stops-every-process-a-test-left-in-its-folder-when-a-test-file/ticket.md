# AR0697 - The test kit stops every process a test left in its folder when a test file exits

```json
{
  "id": "AR0697",
  "title": "The test kit stops every process a test left in its folder when a test file exits",
  "date": "2026-11-11"
}
```

## Description

When a test file exits, the test kit stops every process a test left whose working folder or arguments lie in the kit's own temporary folder, so leaked fake agents and blocking fixture tests no longer run on for an hour.

## Goal

Six leaks found by hand with `ps`, all deferred: a fake agent started with `-e …/handoff-extension.ts` still running 15 to 54 minutes later (AR0632 F1, AR0668 F2, AR0691 F4), and a fixture's blocking `node --test packages/a/test/limit.test.ts` still running 15 to 44 minutes later (AR0637 F1, AR0658 F2, AR0689 F1). Each had its command line or working folder under `/tmp/arthur-test-*`, the kit's folder. Retro 2026-11-11, proposal 5.

- Kind: chore

## Done means

- The kit's `process.on("exit")` handler kills, by pid, each process (not itself) whose `/proc/<pid>/cwd` or cmdline lies under the kit's root, before removing the root.
- A test in `packages/core/test/` starts a test file that leaves a `sleep` in the kit's folder, lets it exit, and asserts that pid is gone; it fails before the change. A process outside the folder is left alone (same test).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/testing.ts`: the exit handler.
- `packages/core/test/`: the test above.

Out:
- A test process killed with SIGKILL runs no exit hook; not covered here.
- The tests that leak: each finding stays its own.

## Decisions

- 2026-11-11: Source: retro spec/retro/2026-11-11.md
