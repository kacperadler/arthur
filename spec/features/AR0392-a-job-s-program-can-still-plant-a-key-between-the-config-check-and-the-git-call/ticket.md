# AR0392 - A job's program can still plant a key between the config check and the git call

```json
{
  "id": "AR0392",
  "title": "A job's program can still plant a key between the config check and the git call",
  "date": "2026-10-25"
}
```

## Description

the check reads the repository's own config with one `git config --list`, then the git call reads it again. A running job's program that rewrites `.git/config` in a loop (a filter plus `.git/info/attributes`) can land its key in that gap, and the merge, checkout or push runs it. Named as a limit in `docs/deploy.md`, "Threat model". [INFERENCE] from the two reads; no race was run.

## Goal

A key a job's program writes between the config check and Arthur's git call cannot make that call run a program.

- Kind: security

## Done means

- The fix, with a test that proves it: pass the values of the keys Git reads by a fixed name with `-c` as well (`credential.helper=` resets the list, `core.sshCommand`, `gpg.program`, `commit.gpgSign=false`, `protocol.allow=never` for `ext`), which closes the gap for them; drivers named by an attribute (`filter.<name>`, `merge.<name>`) stay behind the check.
- `npm test` and `npm run check` pass.

## Scope

In:
- pass the values of the keys Git reads by a fixed name with `-c` as well (`credential.helper=` resets the list, `core.sshCommand`, `gpg.program`, `commit.gpgSign=false`, `protocol.allow=never` for `ext`), which closes the gap for them; drivers named by an attribute (`filter.<name>`, `merge.<name>`) stay behind the check.

## Decisions

- 2026-10-25: Source: F1 of AR0380
