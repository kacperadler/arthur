# AR0704 - A test fixture names the owner's real account, user:terminal:kacper, in the public repository

```json
{
  "id": "AR0704",
  "title": "A test fixture names the owner's real account, user:terminal:kacper, in the public repository",
  "date": "2026-11-13"
}
```

## Description

`packages/activity/test/log-command.test.ts:48` uses `user:terminal:kacper`, the owner's real OS account, as a fixture actor. The repository is public; a made-up name keeps it about Arthur alone.

## Goal

Found by the AR0530 review (2026-11-13-review-017fcc52, note 4). The vision: what reaches GitHub is about Arthur alone.

- Kind: test

## Done means

- `user:terminal:kacper` is `user:terminal:alice` in that test; `grep -rn kacper packages/*/test` finds nothing.
- The activity tests pass.

## Scope

In:
- `packages/activity/test/log-command.test.ts`

Out:
- No code change.

## Decisions

