# AR0146 - Caps per feature on CPU and memory are not held, and not said, on a machine without a user manager

```json
{
  "id": "AR0146",
  "title": "Caps per feature on CPU and memory are not held, and not said, on a machine without a user manager",
  "date": "2026-10-18"
}
```

## Description

a job that runs bare (macOS, a container) has no ticket slice; the once-per-machine `notice` names only a job's own caps. Documented in `packages/resources/docs/resources.md`, not told.

## Goal

On a machine without a user manager (macOS), a ticket's CPU and memory caps are either held another way or Arthur says plainly they are not held.

- Kind: feat

Evidence:
- `packages/core/src/job-scope.ts:44-48`
- Found by: 2026-10-18-ar0141-99f8f735 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: extend the notice's condition and text to a job with `feature` caps.
- `npm test` and `npm run check` pass.

## Scope

In:
- extend the notice's condition and text to a job with `feature` caps.

## Decisions

- 2026-10-18: Source: F2 of AR0141
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
