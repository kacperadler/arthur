# AR0393 - A remote's `url` can name a transport whose helper runs from PATH

```json
{
  "id": "AR0393",
  "title": "A remote's `url` can name a transport whose helper runs from PATH",
  "date": "2026-10-25"
}
```

## Description

`remote.origin.url = <transport>::<address>` makes `github.push` run `git-remote-<transport>`, a program found on PATH, not one the config names; `ext::` stays off as long as `protocol.ext.allow` cannot be set in the repository's config (it is outside the set). Named as a limit in `docs/deploy.md`. [INFERENCE] from Git's gitremote-helpers documentation; not run here.

## Goal

A remote URL in a project's config cannot make Arthur's push or fetch run a program (`ext::` and other helper transports refused or disabled).

- Kind: security

## Done means

- The fix, with a test that proves it: refuse a `remote.*.url` or `pushurl` of the form `<word>::` in `configRefusal`, or run the push with `GIT_PROTOCOL_FROM_USER=0`.
- `npm test` and `npm run check` pass.

## Scope

In:
- refuse a `remote.*.url` or `pushurl` of the form `<word>::` in `configRefusal`, or run the push with `GIT_PROTOCOL_FROM_USER=0`.

## Decisions

- 2026-10-25: Source: F2 of AR0380
