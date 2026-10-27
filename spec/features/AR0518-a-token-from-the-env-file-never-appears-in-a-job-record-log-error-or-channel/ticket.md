# AR0518 - A token from the env file never appears in a job record, log, error or channel message

```json
{
  "id": "AR0518",
  "title": "A token from the env file never appears in a job record, log, error or channel message",
  "date": "2026-10-27"
}
```

## Description

Part of AR0402's area 1 (secrets), cut as a defensive change with its test instead of an open review, after AR0402's review was refused twice by the provider.

## Goal

No value from the env file ever lands in a job's record or log, an error Arthur prints, or a message a channel sends; a value that would is replaced by the variable's name.

- Kind: security

## Done means

- A test runs a fake job and a failing plugin call with a fake token set in a temporary env file, then searches every file under the temporary home and every message the fake channel sent: the token's value appears nowhere; it fails before the change if any path copies it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/`: one place that replaces known secret values with their names before a record, a log line, an error or a notice is written.
- `packages/core/test/`: the test above.

Out:
- What a job may read: the env guard and the sandbox (AR0508, AR0512, AR0513).
- File modes: AR0517.

## Decisions

- 2026-10-27: Source: AR0402, refused twice by the provider
- 2026-10-27: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-27: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-27: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-27: AR0518 another round: the sweep copy names the log and result with the host hide, then review round 3; the owner: "AR-D194 1" (AR-D194)
