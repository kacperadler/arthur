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

- `user:terminal:kacper` is `user:terminal:alice` in that test; every test fixture and the spawn docs example use made-up names; `grep -rni kacper packages docs test arthur.config.example.ts .agents` finds only Arthur's own repository URL, which stays (AR-D669).
- The activity tests pass.

## Scope

In:
- `packages/activity/test/log-command.test.ts`

Out:
- No code change.

## Decisions
- 2026-11-13: AR0704 approved: the activity test fixture uses a made-up account name; the owner: "AR-D668: approve" (AR-D668)
- 2026-11-13: AR0704 widens: every test fixture and the spawn docs example that name kacper get made-up names; the repository URL stays and leaves the grep; the owner: "AR-D669 1" (AR-D669)

