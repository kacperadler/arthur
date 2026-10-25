# AR0398 - A remote named as a machine's URL sends a job's push and fetch to another repository

```json
{
  "id": "AR0398",
  "title": "A remote named as a machine's URL sends a job's push and fetch to another repository",
  "date": "2026-10-25"
}
```

## Description

`gitOver` runs `git push <machine.ssh>:<home>/repos/<project>.git` and `git fetch` of the same, and Git reads that word first as the name of a remote. A job can write `[remote "gpu:/home/kacper/arthur-home/repos/acme.git"] url = ssh://elsewhere/x.git` (or `pushurl`) into the checkout's config, which `configRefusal` lets through (`remote.<name>.url`), so the base commit goes to another host and the sweep brings the job's branch back from another repository. Git 2.43 does it: with `[remote "gpu:/x/p.git"] url = evil::x` and `git-remote-evil` on PATH, `git push gpu:/x/p.git HEAD:refs/x` ran `git-remote-evil gpu:/x/p.git x`. AR0393 keeps a program from running there (`GIT_PROTOCOL_FROM_USER=0`); an `ssh` URL still passes.

## Goal

A job's push and fetch to another machine always reach that machine's repository, whatever remote a project's config names after its URL.

- Kind: security

## Done means

- The fix, with a test that proves it: `configRefusal` refuses a `remote.<name>.*` key whose name holds `:` (no `git remote add` makes one, as a ref name cannot hold it), or `gitOver` passes a URL no remote can be named; test that the push and the fetch go to the machine's repository with such a remote set.
- `npm test` and `npm run check` pass.

## Scope

In:
- `configRefusal` refuses a `remote.<name>.*` key whose name holds `:` (no `git remote add` makes one, as a ref name cannot hold it), or `gitOver` passes a URL no remote can be named; test that the push and the fetch go to the machine's repository with such a remote set.

## Decisions

- 2026-10-25: Source: F1 of AR0393
