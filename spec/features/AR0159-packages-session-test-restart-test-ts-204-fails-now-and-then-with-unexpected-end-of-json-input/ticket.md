# AR0159 - packages/session/test/restart.test.ts:204 fails now and then with "Unexpected end of JSON input"

```json
{
  "id": "AR0159",
  "title": "packages/session/test/restart.test.ts:204 fails now and then with \"Unexpected end of JSON input\"",
  "date": "2026-10-19"
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

- Observable result, and the test that proves it.
- `npm test` and `npm run check` pass.

## Scope

In:
- `path/to/file.ts`: what changes there.

Out:
- What this ticket does not do, and which ticket does.

## Decisions

- 2026-10-19: Source: F1 of AR0127
