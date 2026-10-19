# AR0159 - packages/session/test/restart.test.ts:204 fails now and then with "Unexpected end of JSON input"

```json
{
  "id": "AR0159",
  "title": "packages/session/test/restart.test.ts:204 fails now and then with \"Unexpected end of JSON input\"",
  "date": "2026-10-19",
  "after": [
    "AR0153"
  ]
}
```

## Description

one full-suite run failed there with `SyntaxError: Unexpected end of JSON input`; the isolated rerun passed. Likely the test or the plugin reads `request.json` while it is being written (a write that is not atomic, or a read racing it) [INFERENCE].

## Goal

The session restart test passes on every run, so CI and reviews stop failing on it by chance.

- Kind: bug

Evidence:
- `packages/session/test/restart.test.ts:204` (entry 36, AR0144)
- Found by: 2026-10-18-review-ar0127-1e955037 (review), 2026-10-18

## Done means

- `packages/session/test/restart.test.ts` passes 30 full runs in a row under load (e.g. 4 suites in parallel), where before it failed with `Unexpected end of JSON input` at least once; the cause (a non-atomic write of `request.json`, or the test reading it mid-write) is fixed at its source, the write made atomic (write a temp file, then rename) if it is the plugin's.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/session/src/session.ts`
- `packages/session/test/restart.test.ts`

## Decisions

- 2026-10-19: Source: F1 of AR0127
- 2026-10-19: Pre-approved by policy (h ticket status --autopilot)
- 2026-10-19: Coordinator: superseded by AR0167, merged: the fake agent now writes each notes file with its first line at once (ba75b20, the cause at its source) and main's restart.test.ts has the same waits; the branch's remaining lines() change is no longer needed. Dropped; branch not merged.
