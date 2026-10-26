# AR0388 - The user's systemd folder is guarded at `~/.config/systemd` only, not at `$XDG_CONFIG_HOME/systemd`

```json
{
  "id": "AR0388",
  "title": "The user's systemd folder is guarded at `~/.config/systemd` only, not at `$XDG_CONFIG_HOME/systemd`",
  "date": "2026-10-25"
}
```

## Description

`guardedPlaces` writes `systemd <home>/.config/systemd` whatever `XDG_CONFIG_HOME` holds. systemd's user manager reads units from `$XDG_CONFIG_HOME/systemd/user` when that is set, so with `XDG_CONFIG_HOME=/srv/cfg` a job's `write` of `/srv/cfg/systemd/user/x.service` passes the worktree guard [INFERENCE: systemd's unit search path per systemd.unit(5); not run here].

## Goal

A job cannot write systemd user units wherever systemd reads them: the guard covers `$XDG_CONFIG_HOME/systemd` as well as `~/.config/systemd`.

- Kind: security

## Done means

- The fix, with a test that proves it: add a second `systemd` line for `$XDG_CONFIG_HOME/systemd` when it differs, as AR0377 does for `gitxdg`, with a test that sets `XDG_CONFIG_HOME`.
- `npm test` and `npm run check` pass.

## Scope

In:
- add a second `systemd` line for `$XDG_CONFIG_HOME/systemd` when it differs, as AR0377 does for `gitxdg`, with a test that sets `XDG_CONFIG_HOME`.

## Decisions

- 2026-10-25: Source: F1 of AR0377
- 2026-10-27: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
